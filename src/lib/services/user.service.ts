// Типизация восстановлена для обеспечения безопасности типов

import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { db } from '@/lib/db';
import type {
  CreateUserInput,
  CreateBonusInput,
  CreateTransactionInput,
  User,
  Bonus,
  Transaction,
  UserBalance,
  BonusType,
  TransactionType,
  UserWithBonuses
} from '@/types/bonus';
import { ProjectService } from './project.service';
import { BonusLevelService } from './bonus-level.service';
import { ReferralService } from './referral.service';
import { ReferralCommissionService } from './referral-commission.service';
import { PartnerNotificationService } from './partner-notification.service';
import { PartnerOrganizationService } from './partner-organization.service';
import { PartnerTeamService } from './partner-team.service';
import { ReferrerAssignmentService } from './referrer-assignment.service';
import {
  sendBonusNotification,
  sendBonusSpentNotification
} from '@/lib/telegram/notifications';
import { logger } from '@/lib/logger';
import { resolveWelcomeRewardSettings } from './welcome-reward-settings';

export class UserService {
  // Создание нового пользователя с поддержкой UTM меток и реферальной системы
  static async createUser(data: CreateUserInput): Promise<User> {
    try {
      // Нормализуем телефон и email перед сохранением
      let normalizedPhone: string | null = data.phone || null;
      if (normalizedPhone) {
        try {
          const { normalizePhone } = await import('@/lib/phone');
          normalizedPhone = normalizePhone(normalizedPhone) || normalizedPhone;
        } catch {
          // no-op
        }
        // Если после нормализации получилась пустая строка, ставим null
        if (!normalizedPhone || normalizedPhone.trim() === '') {
          normalizedPhone = null;
        }
      }
      const normalizedEmail = (data.email || '').trim();

      // Получаем проект для определения режима работы
      const project = await db.project.findUnique({
        where: { id: data.projectId },
        select: { operationMode: true }
      });

      // Определяем isActive на основе operationMode проекта
      // WITHOUT_BOT: автоматическая активация (isActive = true)
      // WITH_BOT: требуется активация через Telegram (isActive = false)
      const isActive = project?.operationMode === 'WITHOUT_BOT';

      logger.info('Определен режим проекта для создания пользователя', {
        projectId: data.projectId,
        operationMode: project?.operationMode || 'WITH_BOT',
        resolvedIsActive: isActive,
        component: 'user-service/createUser'
      });

      // Ищем рефера только по utm_ref (теперь используем utmSource как utm_ref)
      let referrerId: string | undefined;
      if (data.utmSource) {
        const referrer = await ReferralService.findReferrer(
          data.projectId,
          data.utmSource
        );
        if (referrer) {
          referrerId = referrer.id;
        }
      }

      const organizationId =
        data.organizationId ??
        (await PartnerOrganizationService.resolveOrganizationIdForRegistration({
          projectId: data.projectId,
          utmOrgSlug: data.utmOrg,
          referrerId
        }));

      const partnerFlags = await PartnerTeamService.getProjectPartnerFlags(
        data.projectId
      );
      const pendingReferral =
        Boolean(referrerId) &&
        Boolean(partnerFlags?.referralJoinRequiresApproval) &&
        Boolean(partnerFlags?.enablePartnerTeamManagement);

      // Если бот ещё не подтвердил контакт (WITH_BOT, isActive=false здесь),
      // заявку на вступление создаём НЕ сейчас, а позже — из
      // resolvePendingReferralOnActivation(), когда пользователь привяжет
      // telegramId/maxId. Раньше заявка уходила рефереру сразу при веб-
      // регистрации: менеджер мог одобрить её до того, как заявитель вообще
      // открыл бота, а уведомление об одобрении тихо терялось —
      // notifyApplicantAboutJoinDecision молча выходит, если у пользователя
      // нет ни telegramId, ни maxId (partner-notification.service.ts).
      // Для WITHOUT_BOT (isActive уже true, подтверждать нечего) поведение
      // не меняется — заявка создаётся сразу, как и раньше.
      const pendingReferralMetadata =
        pendingReferral && !isActive && referrerId
          ? { referrerId, organizationId: organizationId ?? null }
          : null;

      const {
        utmOrg: _utmOrg,
        organizationId: _inputOrgId,
        ...userFields
      } = data;

      const user = await db.user.create({
        data: {
          ...userFields,
          email: normalizedEmail,
          phone: normalizedPhone,
          // При ожидании одобрения откладываем только партнёрскую связь с
          // реферером. Клиент уже должен быть виден в организации: это нужно
          // для истории покупок, скидки организации и аналитики QR.
          referredBy: pendingReferral ? undefined : referrerId,
          organizationId,
          isActive,
          totalPurchases: 0,
          currentLevel: 'Базовый',
          ...(organizationId
            ? {
                organizationMemberships: {
                  create: {
                    projectId: data.projectId,
                    organizationId,
                    level: null
                  }
                }
              }
            : {}),
          ...(pendingReferralMetadata
            ? {
                metadata: {
                  ...(data.utmOrg ? { utmOrg: data.utmOrg } : {}),
                  pendingReferral: pendingReferralMetadata
                }
              }
            : data.utmOrg
              ? { metadata: { utmOrg: data.utmOrg } }
              : {})
        },
        include: {
          project: true,
          bonuses: true,
          transactions: true
        }
      });

      // `utm_org` может прийти без персонального `utm_ref` (например, с QR
      // на стойке клуба). Membership создаётся вложенно вместе с user выше:
      // обе записи атомарны и не могут разойтись при частичном сбое. Даже
      // при ожидающем одобрении пользователь остаётся клиентом (level=null).

      // Реферальные коды больше не используются для ссылок — пропускаем генерацию

      logger.info('Создан новый пользователь', {
        userId: user.id,
        projectId: data.projectId,
        hasReferrer: !!referrerId,
        pendingReferral,
        utmSource: data.utmSource,
        isActive,
        operationMode: project?.operationMode || 'WITH_BOT',
        component: 'user-service'
      });

      if (referrerId) {
        if (pendingReferral) {
          if (!pendingReferralMetadata) {
            // isActive уже true (WITHOUT_BOT) — нет события "подтверждение
            // контакта", на которое можно отложить; создаём заявку сразу,
            // как и раньше.
            await PartnerTeamService.createJoinRequest({
              projectId: data.projectId,
              userId: user.id,
              referrerId,
              organizationId: organizationId ?? null
            });
          }
          // Иначе заявка будет создана позже, из
          // resolvePendingReferralOnActivation() при подтверждении контакта.
        } else {
          try {
            await ReferralCommissionService.syncAttributionForInvitedUser({
              invitedUserId: user.id,
              projectId: data.projectId,
              referrerId,
              organizationId: organizationId ?? null
            });
          } catch (attrError) {
            logger.error('Ошибка создания referral attribution', {
              userId: user.id,
              projectId: data.projectId,
              error:
                attrError instanceof Error
                  ? attrError.message
                  : 'Неизвестная ошибка',
              component: 'user-service'
            });
          }

          void PartnerNotificationService.notifyAncestorsAboutNewMember(
            user.id,
            data.projectId
          );
        }
      }

      // Начисляем приветственные бонусы если настроено
      try {
        const fullProject = await db.project.findUnique({
          where: { id: data.projectId },
          include: { referralProgram: true }
        });

        if (fullProject) {
          const welcomeReward = resolveWelcomeRewardSettings(
            fullProject,
            fullProject.referralProgram
          );

          // Начисляем только если тип BONUS и сумма > 0
          if (welcomeReward.type === 'BONUS' && welcomeReward.amount > 0) {
            await BonusService.awardBonus({
              userId: user.id,
              amount: welcomeReward.amount,
              type: 'WELCOME',
              description: `Приветственный бонус`,
              metadata: {
                source: 'registration',
                welcomeBonus: true
              }
            });

            logger.info('Начислены приветственные бонусы', {
              userId: user.id,
              projectId: data.projectId,
              amount: welcomeReward.amount,
              settingsSource: welcomeReward.source,
              component: 'user-service'
            });
          }
        }
      } catch (error) {
        logger.error('Ошибка начисления приветственных бонусов', {
          userId: user.id,
          projectId: data.projectId,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          component: 'user-service'
        });
        // Не бросаем ошибку - пользователь уже создан
      }

      // Автоматическое связывание с МойСклад Direct (неблокирующе)
      if (normalizedPhone) {
        try {
          const { SyncService } = await import(
            '@/lib/moysklad-direct/sync-service'
          );
          const syncService = new SyncService();

          const linked = await syncService.findAndLinkCounterparty(user.id);

          if (linked) {
            logger.info('Пользователь автоматически связан с МойСклад', {
              userId: user.id,
              projectId: data.projectId,
              phone: normalizedPhone,
              component: 'user-service'
            });
          }
        } catch (error) {
          logger.error('Ошибка автосвязывания с МойСклад', {
            userId: user.id,
            projectId: data.projectId,
            error:
              error instanceof Error ? error.message : 'Неизвестная ошибка',
            component: 'user-service'
          });
          // Не блокируем создание пользователя
        }
      }

      return user as any;
    } catch (error) {
      logger.error('Ошибка создания пользователя', {
        data,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'user-service'
      });
      throw error;
    }
  }

  /**
   * Резолвит отложенную привязку реферера/организации после подтверждения
   * контакта в боте (см. pendingReferralMetadata в createUser). На этот
   * момент у пользователя гарантированно есть канал для уведомлений
   * (telegramId/maxId), так что заявку на вступление — или прямую
   * привязку, если флаг требования одобрения выключили, пока пользователь
   * ждал, — можно безопасно создать. Переиспользует ту же логику "заявка
   * vs прямая привязка", что и linkReferralWithPolicy (поздняя
   * re-attribution по UTM с заказа) — единая точка принятия решения, не
   * дублируем её здесь.
   *
   * Вызывается из ВСЕХ мест, где пользователь может привязать
   * telegramId/maxId: router-integration.ts (contact-обработчик активного
   * bot-flow), query-executor.ts (`activate_user`, дефолтный шаблон
   * loyalty-system), и action-handlers.ts (`action.link_telegram_account`,
   * нода, доступная в визуальном конструкторе воркфлоу для кастомных
   * сценариев).
   *
   * Idempotent — если `pendingReferral` в metadata нет (обычная
   * регистрация без реф. ссылки, WITHOUT_BOT, или уже резолвнуто раньше),
   * тихо ничего не делает.
   */
  static async resolvePendingReferralOnActivation(
    userId: string
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          projectId: true,
          metadata: true,
          referredBy: true,
          organizationId: true,
          partnerRole: true
        }
      });
      if (!user) return;

      const metadata = (user.metadata as Record<string, any> | null) ?? {};
      const pending = metadata.pendingReferral as
        | { referrerId: string; organizationId: string | null }
        | undefined;
      if (!pending) return;

      // Убираем маркер сразу — независимо от исхода не пытаемся резолвить
      // повторно (createJoinRequest сам по себе идемпотентен, но лишний
      // повторный вызов линковки/уведомлений при повторной активации ни к
      // чему).
      const { pendingReferral: _pendingReferral, ...restMetadata } = metadata;

      // Пока пользователь ждал подтверждения контакта, админ мог уже вручную
      // назначить ему referredBy/organizationId/роль (профиль, карточка
      // организации) — linkReferralWithPolicy пишет эти поля безусловно, и
      // без этой проверки мы бы молча затёрли явное решение админа старым
      // намерением с реф. ссылки. Уважаем то, что уже проставлено, и просто
      // снимаем маркер, не трогая привязку.
      const alreadyHandledManually =
        Boolean(user.referredBy) ||
        // При создании клиента мы уже записываем ожидаемую организацию, это
        // не ручная правка и не должно отменять создание заявки. Другая
        // организация (либо организация при отсутствии ожидаемой) — явный
        // ручной выбор, который сохраняем.
        Boolean(
          user.organizationId && user.organizationId !== pending.organizationId
        ) ||
        user.partnerRole !== 'CLIENT';
      if (alreadyHandledManually) {
        logger.info(
          'resolvePendingReferralOnActivation: skipped — user already has referredBy/organizationId/role set (admin likely handled it manually while pending)',
          {
            userId: user.id,
            projectId: user.projectId,
            component: 'user-service'
          }
        );
        await db.user.update({
          where: { id: user.id },
          data: { metadata: restMetadata }
        });
        return;
      }

      await PartnerTeamService.linkReferralWithPolicy({
        userId: user.id,
        projectId: user.projectId,
        referrerId: pending.referrerId,
        organizationId: pending.organizationId
      });

      await db.user.update({
        where: { id: user.id },
        data: { metadata: restMetadata }
      });
    } catch (error) {
      logger.error('resolvePendingReferralOnActivation failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        component: 'user-service'
      });
    }
  }

  /**
   * Привязать реферала к существующему пользователю (signup-форма Tilda без
   * создания дубликата). Срабатывает только если `referredBy` ещё пуст.
   */
  static async linkReferralFromAttribution(params: {
    userId: string;
    projectId: string;
    utmRef?: string | null;
    utmOrg?: string | null;
  }): Promise<{ linked: boolean; referrerId?: string; pending?: boolean }> {
    const { userId, projectId, utmRef, utmOrg } = params;
    if (!utmRef?.trim()) {
      return { linked: false };
    }

    const user = await db.user.findFirst({
      where: { id: userId, projectId },
      select: { id: true, referredBy: true, organizationId: true }
    });
    if (!user || user.referredBy || utmRef.trim() === userId) {
      return { linked: false };
    }

    const referrer = await ReferralService.findReferrer(
      projectId,
      utmRef.trim()
    );
    if (!referrer) {
      return { linked: false };
    }

    const organizationId =
      user.organizationId ??
      (await PartnerOrganizationService.resolveOrganizationIdForRegistration({
        projectId,
        utmOrgSlug: utmOrg,
        referrerId: referrer.id
      }));

    const linkResult = await PartnerTeamService.linkReferralWithPolicy({
      userId,
      projectId,
      referrerId: referrer.id,
      organizationId: organizationId ?? null
    });

    if (!linkResult.linked && !linkResult.pending) {
      return { linked: false };
    }

    logger.info('Referral linked to existing user', {
      userId,
      projectId,
      referrerId: referrer.id,
      pending: linkResult.pending,
      component: 'user-service'
    });

    return {
      linked: linkResult.linked,
      referrerId: referrer.id,
      pending: linkResult.pending
    };
  }

  /**
   * Ручная привязка реферера админом из карточки профиля. В отличие от
   * linkReferralWithPolicy, НЕ создаёт заявку на одобрение (это явное действие
   * администратора — оверрайд). Делегирует запись в ReferrerAssignmentService —
   * единственную точку, которая также используется при назначении реферера
   * из карточки b2b-организации, чтобы обе формы одинаково проверяли цикл,
   * синхронизировали attribution комиссий и уведомляли вышестоящих.
   */
  static async assignReferrerManually(params: {
    projectId: string;
    userId: string;
    referrerId: string;
  }): Promise<{
    referrerId: string;
    referrerName: string | null;
    attributionLocked: boolean;
  }> {
    const { projectId, userId, referrerId } = params;

    const result = await ReferrerAssignmentService.setReferrer({
      projectId,
      userId,
      referrerId
    });

    logger.info('Реферер привязан вручную', {
      userId,
      projectId,
      referrerId,
      attributionLocked: result.attributionLocked,
      component: 'user-service'
    });

    return {
      referrerId,
      referrerName: result.referrerName,
      attributionLocked: result.attributionLocked
    };
  }

  // Поиск пользователя по email или телефону в рамках проекта
  static async findUserByContact(
    projectId: string,
    email?: string,
    phone?: string
  ): Promise<User | null> {
    // Нормализуем входящие параметры
    const normalizedEmail = email && email.trim() ? email.trim() : null;
    const normalizedPhone = phone && phone.trim() ? phone.trim() : null;
    if (!normalizedEmail && !normalizedPhone) return null;

    // Нормализуем и подбираем варианты телефона для максимального совпадения
    const phoneCandidates: string[] = [];
    if (normalizedPhone) {
      try {
        const { normalizePhone } = await import('@/lib/phone');
        const trimmed = normalizedPhone;
        const normalized = normalizePhone(trimmed);
        const digits = trimmed.replace(/\D/g, '');

        if (normalized) phoneCandidates.push(normalized);
        // Вариант с ведущей 8 для старых данных
        if (
          normalized &&
          normalized.startsWith('+7') &&
          normalized.length === 12
        ) {
          phoneCandidates.push('8' + normalized.slice(2));
        }
        // Сырые цифры (вдруг в БД хранились без знака +)
        if (digits) phoneCandidates.push(digits);
        // Преобразуем локальные формы к +7XXXXXXXXXX
        if (digits.length === 11 && digits.startsWith('8')) {
          phoneCandidates.push('+7' + digits.slice(1));
        }
        if (digits.length === 10) {
          phoneCandidates.push('+7' + digits);
        }
        // Исходное
        phoneCandidates.push(trimmed);
      } catch {
        // В случае сбоя нормализации, используем исходное значение
        phoneCandidates.push(normalizedPhone);
      }
    }

    const orConditions: Array<{ email?: string; phone?: string }> = [];
    if (normalizedEmail) orConditions.push({ email: normalizedEmail });
    for (const p of phoneCandidates) {
      orConditions.push({ phone: p });
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.info('Поиск пользователя по контакту (точный матч)', {
        projectId,
        email: normalizedEmail,
        phonePreview: normalizedPhone ? normalizedPhone.slice(-6) : undefined,
        phoneCandidates,
        component: 'user-service/findUserByContact'
      });
    }

    let user = await db.user.findFirst({
      where: {
        projectId,
        OR: orConditions
      },
      include: {
        project: true,
        bonuses: true,
        transactions: true
      }
    });

    // Фолбэк: если по точным строкам не нашли, ищем по совпадению последних цифр
    if (!user && normalizedPhone) {
      try {
        const { normalizePhone } = await import('@/lib/phone');
        const trimmed = normalizedPhone;
        const normalized = normalizePhone(trimmed) || trimmed;
        const onlyDigits = (s: string) => s.replace(/\D/g, '');
        const candDigits = onlyDigits(normalized);
        const last10 = candDigits.slice(-10);

        if (last10) {
          const possible = await db.user.findMany({
            where: {
              projectId,
              // Ограничим набор по нескольким эвристикам, чтобы не грузить всех
              OR: [
                { phone: { contains: last10.slice(-4) } },
                { phone: { contains: last10 } }
              ]
            },
            include: {
              project: true,
              bonuses: true,
              transactions: true
            },
            take: 50
          });

          const matched = possible.find((u: any) => {
            const nd = onlyDigits(String(u.phone || ''));
            // Сравниваем по последним 10 цифрам
            return nd.slice(-10) === last10;
          });
          user = matched ?? null;

          if (process.env.NODE_ENV !== 'production') {
            logger.info('Фолбэк-поиск по последним цифрам телефона', {
              projectId,
              phoneLast10: last10,
              candidatesChecked: possible.length,
              matchedUserId: (user as any)?.id,
              component: 'user-service/findUserByContact'
            });
          }
        }
      } catch {
        // ignore fallback errors
      }
    }

    if (!user) return null;

    return user as any;
  }

  // Получение пользователя по Telegram ID
  static async getUserByTelegramId(
    projectId: string,
    telegramId: bigint
  ): Promise<User | null> {
    const user = await db.user.findFirst({
      where: { projectId, telegramId },
      include: {
        project: true,
        bonuses: true,
        transactions: true
      }
    });

    if (!user) return null;

    return user as any;
  }

  // Привязка Telegram аккаунта к пользователю
  static async linkTelegramAccount(
    projectId: string,
    telegramId: bigint,
    telegramUsername?: string,
    contactInfo?: { email?: string; phone?: string }
  ): Promise<User | null> {
    const user = await this.findUserByContact(
      projectId,
      contactInfo?.email,
      contactInfo?.phone
    );

    if (!user) return null;

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        telegramId,
        telegramUsername
      },
      include: {
        project: true,
        bonuses: true,
        transactions: true
      }
    });

    return updatedUser as any;
  }

  // Получение баланса пользователя с учётом уровня
  static async getUserBalance(userId: string): Promise<UserBalance> {
    const [
      earnTransactions,
      spendTransactions,
      expiringSoon,
      activeBonusesSum
    ] = await Promise.all([
      db.transaction.aggregate({
        where: {
          userId,
          type: 'EARN'
        },
        _sum: {
          amount: true
        }
      }),
      db.transaction.aggregate({
        where: {
          userId,
          type: 'SPEND'
        },
        _sum: {
          amount: true
        }
      }),
      db.bonus.aggregate({
        where: {
          userId,
          isUsed: false,
          expiresAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 дней
          }
        },
        _sum: {
          amount: true
        }
      }),
      db.bonus.aggregate({
        where: {
          userId,
          isUsed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        _sum: {
          amount: true
        }
      })
    ]);

    const totalEarned = Number(earnTransactions._sum.amount || 0);
    const totalSpent = Math.abs(Number(spendTransactions._sum.amount || 0));
    const currentBalance = Number(activeBonusesSum._sum.amount || 0);
    const expiringSoonAmount = Number(expiringSoon._sum.amount || 0);

    return {
      totalEarned,
      totalSpent,
      currentBalance,
      expiringSoon: expiringSoonAmount
    };
  }

  // Получение списка пользователей проекта с информацией об уровнях
  static async getProjectUsers(
    projectId: string,
    page = 1,
    limit = 10,
    where?: any,
    options?: {
      /** Prisma orderBy для сортировки по хранимым колонкам БД. */
      orderBy?: any;
      /**
       * Сортировка по вычисляемым колонкам (агрегаты транзакций). Когда
       * задана, страница формируется по отсортированному по метрике набору
       * id, а не по orderBy. `bonusBalance` = earned − spent,
       * `totalEarned` = сумма EARN.
       */
      computedSort?: {
        field: 'bonusBalance' | 'totalEarned';
        order: 'asc' | 'desc';
      };
    }
  ): Promise<{ users: UserWithBonuses[]; total: number }> {
    const skip = (page - 1) * limit;

    // Используем переданное where условие или создаем базовое
    const queryWhere = where || { projectId };
    const userInclude = {
      // Для списка нужны только отображаемые поля реферера. Полные project и
      // referrals раньше раздували каждый ответ, особенно на страницах 500–1000.
      referrer: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          email: true
        }
      },
      organization: { select: { id: true, name: true, slug: true } }
    } as const;

    let users: any[];
    let total: number;

    if (options?.computedSort) {
      // --- Ветка сортировки по вычисляемой метрике (по всему набору) ---
      // 1) Берём все id под фильтром (без агрегатов) + дату для стабильного
      //    вторичного порядка.
      const allRows = await db.user.findMany({
        where: queryWhere,
        select: { id: true, registeredAt: true }
      });
      total = allRows.length;

      if (allRows.length === 0) {
        return { users: [], total };
      }

      const allIds = allRows.map((r) => r.id);

      // 2) Агрегаты транзакций по всему набору одним запросом.
      const txAll = await db.transaction.groupBy({
        by: ['userId', 'type'],
        where: { userId: { in: allIds } },
        _sum: { amount: true }
      });
      const earnedAll = new Map<string, number>();
      const spentAll = new Map<string, number>();
      for (const row of txAll) {
        const sum = Number(row._sum?.amount || 0);
        if (row.type === 'EARN') earnedAll.set(row.userId, sum);
        else if (row.type === 'SPEND') spentAll.set(row.userId, sum);
      }

      const metric = (id: string) => {
        const earned = earnedAll.get(id) ?? 0;
        const spent = spentAll.get(id) ?? 0;
        return options.computedSort!.field === 'totalEarned'
          ? earned
          : earned - spent;
      };

      // 3) Сортируем id по метрике (стабильно: вторично по дате убыв.).
      const dir = options.computedSort.order === 'asc' ? 1 : -1;
      const sortedIds = [...allRows]
        .sort((a, b) => {
          const diff = metric(a.id) - metric(b.id);
          if (diff !== 0) return diff * dir;
          return b.registeredAt.getTime() - a.registeredAt.getTime();
        })
        .map((r) => r.id);

      // 4) Страница id и подгрузка их данных, сохраняя порядок.
      const pageIds = sortedIds.slice(skip, skip + limit);
      const pageUsers = await db.user.findMany({
        where: { id: { in: pageIds } },
        include: userInclude
      });
      const byId = new Map(pageUsers.map((u) => [u.id, u]));
      users = pageIds.map((id) => byId.get(id)).filter(Boolean) as any[];
    } else {
      // --- Обычная ветка: сортировка по хранимой колонке ---
      const [pageUsers, count] = await Promise.all([
        db.user.findMany({
          where: queryWhere,
          skip,
          take: limit,
          include: userInclude,
          orderBy: options?.orderBy || { registeredAt: 'desc' }
        }),
        db.user.count({ where: queryWhere })
      ]);
      users = pageUsers;
      total = count;
    }

    if (users.length === 0) {
      return { users: [], total };
    }

    const userIds = users.map((u: { id: string }) => u.id);

    // Выполняем агрегаты ОДНИМ запросом для всех пользователей страницы
    const [txByUserAndType, activeBonusesByUser, projectLevels] =
      await Promise.all([
        db.transaction.groupBy({
          by: ['userId', 'type'],
          where: { userId: { in: userIds } },
          _sum: { amount: true }
        }),
        db.bonus.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            isUsed: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          _sum: { amount: true }
        }),
        BonusLevelService.getBonusLevels(projectId)
      ]);

    // Преобразуем агрегаты в быстрые словари
    const earnedMap = new Map<string, number>();
    const spentMap = new Map<string, number>();
    for (const row of txByUserAndType) {
      const sum = Number(row._sum?.amount || 0);
      if (row.type === 'EARN') earnedMap.set(row.userId, sum);
      else if (row.type === 'SPEND') spentMap.set(row.userId, sum);
    }

    const activeBonusMap = new Map<string, number>();
    for (const row of activeBonusesByUser) {
      activeBonusMap.set(row.userId, Number(row._sum?.amount || 0));
    }

    // Считаем уровень на основе уже загруженных уровней (без доп. запросов)
    const usersWithBonuses = users.map((user) => {
      const activeBonuses = activeBonusMap.get(user.id) ?? 0;
      const totalEarned = earnedMap.get(user.id) ?? 0;
      const totalSpent = spentMap.get(user.id) ?? 0;

      const progress = BonusLevelService.calculateProgressToNextLevelFromLevels(
        projectLevels as any,
        Number(user.totalPurchases)
      );

      return {
        ...user,
        totalPurchases: Number(user.totalPurchases),
        activeBonuses,
        totalEarned,
        totalSpent,
        level: progress.currentLevel,
        progressToNext: progress.nextLevel
          ? {
              nextLevel: progress.nextLevel,
              amountNeeded: progress.amountNeeded,
              progressPercent: progress.progressPercent
            }
          : undefined
      };
    });

    return { users: usersWithBonuses as any, total };
  }

  // Получить расширенную информацию о пользователе с уровнем
  static async getUserWithLevel(
    userId: string
  ): Promise<UserWithBonuses | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        project: true,
        bonuses: {
          where: {
            isUsed: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          }
        },
        transactions: true,
        referrer: true,
        referrals: true
      }
    });

    if (!user) return null;

    const activeBonuses = user.bonuses.reduce(
      (sum: number, bonus) => sum + Number(bonus.amount),
      0
    );

    const [totalEarned, totalSpent] = await Promise.all([
      db.transaction.aggregate({
        where: { userId: user.id, type: 'EARN' },
        _sum: { amount: true }
      }),
      db.transaction.aggregate({
        where: { userId: user.id, type: 'SPEND' },
        _sum: { amount: true }
      })
    ]);

    // Получаем информацию об уровне
    const progress = await BonusLevelService.calculateProgressToNextLevel(
      user.projectId,
      Number(user.totalPurchases)
    );

    return {
      ...user,
      totalPurchases: Number(user.totalPurchases),
      activeBonuses,
      totalEarned: Number(totalEarned._sum.amount || 0),
      totalSpent: Number(totalSpent._sum.amount || 0),
      level: progress.currentLevel || undefined,
      progressToNext: progress.nextLevel
        ? {
            nextLevel: progress.nextLevel,
            amountNeeded: progress.amountNeeded,
            progressPercent: progress.progressPercent
          }
        : undefined
    } as any;
  }

  // Получение истории транзакций пользователя
  static async getUserTransactions(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          user: true,
          bonus: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      db.transaction.count({
        where: { userId }
      })
    ]);

    return { transactions: transactions as any, total };
  }

  // ==================== METADATA OPERATIONS ====================

  /**
   * Получить metadata пользователя
   */
  static async getMetadata(userId: string): Promise<Record<string, any>> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { metadata: true }
    });

    if (!user) {
      throw new Error(`Пользователь не найден: ${userId}`);
    }

    return (user.metadata as Record<string, any>) || {};
  }

  /**
   * Установить значение metadata по ключу
   */
  static async setMetadata(
    userId: string,
    key: string,
    value: any
  ): Promise<Record<string, any>> {
    const currentMetadata = await this.getMetadata(userId);

    let newMetadata: Record<string, any>;
    if (value === null || value === undefined) {
      // Удаляем ключ если значение null
      const { [key]: _, ...rest } = currentMetadata;
      newMetadata = rest;
    } else {
      newMetadata = { ...currentMetadata, [key]: value };
    }

    await db.user.update({
      where: { id: userId },
      data: { metadata: newMetadata }
    });

    return newMetadata;
  }

  /**
   * Обновить metadata (merge с существующими данными)
   */
  static async updateMetadata(
    userId: string,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    const currentMetadata = await this.getMetadata(userId);

    // Merge: null значения удаляют ключи
    const newMetadata = { ...currentMetadata };
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        delete newMetadata[key];
      } else {
        newMetadata[key] = value;
      }
    }

    await db.user.update({
      where: { id: userId },
      data: { metadata: newMetadata }
    });

    return newMetadata;
  }

  /**
   * Удалить ключ из metadata
   */
  static async removeMetadataKey(
    userId: string,
    key: string
  ): Promise<Record<string, any>> {
    return this.setMetadata(userId, key, null);
  }

  /**
   * Обновить дату рождения пользователя
   */
  static async updateBirthday(userId: string, birthDate: Date): Promise<User> {
    const user = await db.user.update({
      where: { id: userId },
      data: { birthDate },
      include: {
        project: true,
        bonuses: true,
        transactions: true
      }
    });

    logger.info('Обновлена дата рождения пользователя', {
      userId,
      birthDate: birthDate.toISOString(),
      component: 'user-service'
    });

    return user as any;
  }
}

export class BonusService {
  // Начисление бонусов пользователю с учётом уровня
  static async awardBonus(data: CreateBonusInput): Promise<Bonus> {
    const {
      isReferralBonus,
      referralUserId,
      referralLevel,
      externalId: explicitExternalId,
      ...bonusData
    } = data as CreateBonusInput & { externalId?: string };
    const user = await db.user.findUnique({
      where: { id: bonusData.userId },
      include: { project: true }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Идемпотентность: вычисляем детерминированный externalId для транзакции
    // начисления. Уникальный индекс на Transaction.externalId отклонит повторный
    // (ретраенный/дублирующий) вебхук, даже если ранний guard был обойдён гонкой.
    // Используем отдельный префикс `tilda_order_`, чтобы не пересекаться с
    // пространством имён InSales (`insales_order_*`).
    const metadataSource = bonusData.metadata?.source as string | undefined;
    const metadataOrderId = bonusData.metadata?.orderId as string | undefined;
    const isTildaOrder =
      metadataSource === 'tilda' ||
      metadataSource === 'tilda_order' ||
      metadataSource === 'webhook';
    const externalId =
      explicitExternalId ||
      (isTildaOrder && metadataOrderId
        ? `tilda_order_${metadataOrderId}`
        : undefined);

    // Если дата истечения не указана, рассчитываем по настройкам проекта
    let expiresAt = data.expiresAt;
    if (!expiresAt && user.project) {
      const expireDays = user.project.bonusExpiryDays;
      expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);
    }

    let bonus;
    try {
      bonus = await db.bonus.create({
        data: {
          ...bonusData,
          referralLevel: referralLevel ?? null,
          expiresAt,
          ...(externalId ? { externalId } : {})
        },
        include: {
          user: true,
          transactions: true
        }
      });
    } catch (error) {
      // P2002: уникальное ограничение на externalId — заказ уже обработан.
      // Не выбрасываем ошибку, чтобы не сломать оформление заказа клиента.
      if (
        externalId &&
        error instanceof Object &&
        (error as { code?: string }).code === 'P2002'
      ) {
        logger.info('Бонус с таким externalId уже начислен, пропускаем', {
          userId: bonusData.userId,
          externalId,
          component: 'bonus-service'
        });
        const existing = await db.bonus.findUnique({
          where: { externalId },
          include: { user: true, transactions: true }
        });
        if (existing) {
          return existing as any;
        }
      }
      throw error;
    }

    // Создаем транзакцию начисления с метаданными из data.metadata
    try {
      await this.createTransaction({
        userId: bonusData.userId,
        bonusId: bonus.id,
        amount: bonusData.amount,
        type: 'EARN',
        description:
          bonusData.description || `Начисление бонусов: ${bonusData.type}`,
        metadata: bonusData.metadata || undefined,
        isReferralBonus,
        referralUserId,
        referralLevel,
        ...(externalId ? { externalId } : {})
      } as CreateTransactionInput);
    } catch (error) {
      // P2002: транзакция с таким externalId уже создана — идемпотентный повтор.
      if (
        externalId &&
        error instanceof Object &&
        (error as { code?: string }).code === 'P2002'
      ) {
        logger.info('Транзакция с таким externalId уже создана, пропускаем', {
          userId: bonusData.userId,
          externalId,
          component: 'bonus-service'
        });
      } else {
        throw error;
      }
    }

    // Отправляем уведомление в Telegram (неблокирующе)
    try {
      await sendBonusNotification(user as any, bonus as any, user.projectId);
    } catch (error) {
      logger.error('Ошибка отправки уведомления о бонусах', {
        userId: bonusData.userId,
        bonusId: bonus.id,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'bonus-service'
      });
      // Не блокируем основной процесс
    }

    // Синхронизация с МойСклад Direct (неблокирующе)
    try {
      const { SyncService } = await import(
        '@/lib/moysklad-direct/sync-service'
      );
      const syncService = new SyncService();

      await syncService.syncBonusAccrualToMoySklad({
        userId: bonusData.userId,
        amount: Number(bonusData.amount),
        source: bonusData.metadata?.source || bonusData.type,
        description: bonusData.description
      });
    } catch (error) {
      logger.error('Ошибка синхронизации начисления бонусов с МойСклад', {
        userId: bonusData.userId,
        bonusId: bonus.id,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        component: 'bonus-service'
      });
      // Не блокируем основной процесс - синхронизация некритична
    }

    return bonus as any;
  }

  /**
   * Откат бонуса за покупку при отмене/возврате заказа.
   *
   * Находит исходную транзакцию начисления по externalId `tilda_order_<orderId>`
   * (см. awardBonus / план 001), помечает связанный Bonus использованным, чтобы
   * он перестал учитываться в балансе, и пишет компенсирующую REFUND-транзакцию.
   *
   * Идемпотентность: компенсирующая транзакция имеет детерминированный
   * externalId `reversal_tilda_order_<orderId>`. Повторный вызов (повторный
   * вебхук отмены) не создаёт второй откат — P2002 на уникальном индексе ловится.
   *
   * Учёт «уже потраченного»: баланс = сумма Bonus.amount неиспользованных
   * бонусов (см. getUserBalance/spendBonuses). При откате уменьшаем баланс не
   * более чем на остаток исходного бонуса — если клиент уже потратил часть,
   * логируем недостачу и не уводим баланс в минус.
   */
  static async reversePurchaseBonus(
    orderId: string,
    projectId?: string
  ): Promise<{ reversed: boolean; amount: number; shortfall: number }> {
    const externalId = `tilda_order_${orderId}`;
    const reversalExternalId = `reversal_tilda_order_${orderId}`;

    // Идемпотентность: если откат уже выполнен — выходим.
    const existingReversal = await db.transaction.findUnique({
      where: { externalId: reversalExternalId }
    });
    if (existingReversal) {
      logger.info('Откат бонуса за покупку уже выполнен, пропускаем', {
        orderId,
        reversalExternalId,
        component: 'bonus-service'
      });
      const reversalMetadata =
        existingReversal.metadata &&
        typeof existingReversal.metadata === 'object' &&
        !Array.isArray(existingReversal.metadata)
          ? (existingReversal.metadata as Record<string, unknown>)
          : {};
      const recordedShortfall =
        typeof reversalMetadata.shortfall === 'number'
          ? reversalMetadata.shortfall
          : 0;
      return {
        reversed: false,
        amount: Number(existingReversal.amount),
        shortfall: recordedShortfall
      };
    }

    // Находим исходную транзакцию начисления.
    const earnTransaction = await db.transaction.findUnique({
      where: { externalId },
      include: { bonus: true }
    });

    if (!earnTransaction) {
      logger.info(
        'Транзакция начисления за покупку не найдена, откат не нужен',
        {
          orderId,
          externalId,
          component: 'bonus-service'
        }
      );
      return { reversed: false, amount: 0, shortfall: 0 };
    }

    const awardedAmount = Number(earnTransaction.amount);
    const bonus = earnTransaction.bonus;

    // Остаток на исходном бонусе: то, что ещё не потрачено.
    // Если бонус помечен использованным или уменьшен — отражает уже потраченное.
    const remainingOnBonus = bonus
      ? bonus.isUsed
        ? 0
        : Number(bonus.amount)
      : 0;
    const reversibleAmount = Math.min(awardedAmount, remainingOnBonus);
    const shortfall = awardedAmount - reversibleAmount;

    if (shortfall > 0) {
      logger.warn(
        'Откат бонуса за покупку: часть бонуса уже потрачена, баланс не уводим в минус',
        {
          orderId,
          userId: earnTransaction.userId,
          awardedAmount,
          reversibleAmount,
          shortfall,
          component: 'bonus-service'
        }
      );
    }

    try {
      await db.$transaction(async (tx) => {
        // Помечаем исходный бонус использованным, чтобы убрать его из баланса.
        if (bonus && !bonus.isUsed) {
          await tx.bonus.update({
            where: { id: bonus.id },
            data: { isUsed: true }
          });
        }

        // Пишем компенсирующую REFUND-транзакцию.
        await tx.transaction.create({
          data: {
            userId: earnTransaction.userId,
            bonusId: bonus?.id ?? null,
            amount: reversibleAmount,
            type: 'REFUND',
            description: `Откат бонуса за покупку (заказ ${orderId})`,
            externalId: reversalExternalId,
            metadata: {
              source: 'order_reversal',
              reversalOf: externalId,
              orderId,
              awardedAmount,
              reversibleAmount,
              shortfall,
              ...(projectId ? { projectId } : {})
            }
          }
        });
      });
    } catch (error) {
      // P2002: компенсирующая транзакция уже создана гонкой — идемпотентно ок.
      if (
        error instanceof Object &&
        (error as { code?: string }).code === 'P2002'
      ) {
        logger.info(
          'Компенсирующая транзакция уже создана (гонка), пропускаем',
          {
            orderId,
            reversalExternalId,
            component: 'bonus-service'
          }
        );
        return { reversed: false, amount: 0, shortfall };
      }
      throw error;
    }

    logger.info('Откат бонуса за покупку выполнен', {
      orderId,
      userId: earnTransaction.userId,
      reversedAmount: reversibleAmount,
      shortfall,
      component: 'bonus-service'
    });

    return { reversed: true, amount: reversibleAmount, shortfall };
  }

  // Списание бонусов пользователя
  static async spendBonuses(
    userId: string,
    amount: number,
    description?: string,
    metadata?: Record<string, unknown>,
    idempotencyKey?: string,
    options?: { bonusType?: BonusType; createdBefore?: Date }
  ): Promise<Transaction[]> {
    const findExistingSpend = async (): Promise<Transaction[]> => {
      if (!idempotencyKey) return [];
      const existing = await db.transaction.findMany({
        where: {
          userId,
          type: 'SPEND',
          externalId: { startsWith: `${idempotencyKey}:` }
        },
        orderBy: { createdAt: 'asc' }
      });
      const existingAmount = existing.reduce(
        (sum, transaction) => sum + Number(transaction.amount),
        0
      );
      if (existing.length > 0 && existingAmount !== amount) {
        throw new Error('Конфликт идемпотентного списания бонусов');
      }
      return existing as unknown as Transaction[];
    };

    const existingSpend = await findExistingSpend();
    if (existingSpend.length > 0) return existingSpend;

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { project: true }
    });
    if (!user) throw new Error('Пользователь не найден');

    const currentLevel = await BonusLevelService.calculateUserLevel(
      user.projectId,
      Number(user.totalPurchases)
    );
    const baseMetadata: Record<string, unknown> = metadata
      ? { ...metadata }
      : {};
    const spendBatchId =
      typeof baseMetadata.spendBatchId === 'string'
        ? baseMetadata.spendBatchId
        : idempotencyKey || randomUUID();
    baseMetadata.spendBatchId = spendBatchId;

    const normalizedOrderId =
      baseMetadata.spendOrderId ??
      baseMetadata.orderId ??
      baseMetadata.order_id ??
      baseMetadata.orderID ??
      baseMetadata.orderNumber;
    if (normalizedOrderId && !baseMetadata.spendOrderId) {
      baseMetadata.spendOrderId = normalizedOrderId;
    }
    if (normalizedOrderId && !baseMetadata.orderId) {
      baseMetadata.orderId = normalizedOrderId;
    }

    let transactions: Transaction[];
    try {
      transactions = await db.$transaction(async (tx) => {
        const availableBonuses = await tx.bonus.findMany({
          where: {
            userId,
            isUsed: false,
            ...(options?.bonusType ? { type: options.bonusType } : {}),
            ...(options?.createdBefore
              ? { createdAt: { lte: options.createdBefore } }
              : {}),
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }]
        });
        const totalAvailable = availableBonuses.reduce(
          (sum, bonus) => sum + Number(bonus.amount),
          0
        );
        if (totalAvailable < amount) {
          throw new Error(
            `Недостаточно бонусов. Доступно: ${totalAvailable}, требуется: ${amount}`
          );
        }

        const created: Transaction[] = [];
        let remainingAmount = amount;
        for (const bonus of availableBonuses) {
          if (remainingAmount <= 0) break;
          const bonusAmount = Number(bonus.amount);
          const spendFromThisBonus = Math.min(bonusAmount, remainingAmount);
          const spendSource =
            typeof baseMetadata.source === 'string'
              ? baseMetadata.source
              : typeof baseMetadata.spendSource === 'string'
                ? baseMetadata.spendSource
                : 'manual';
          const transaction = await tx.transaction.create({
            data: {
              userId,
              bonusId: bonus.id,
              amount: spendFromThisBonus,
              type: 'SPEND',
              description: description || 'Списание бонусов',
              externalId: idempotencyKey
                ? `${idempotencyKey}:${bonus.id}`
                : undefined,
              metadata: {
                ...baseMetadata,
                spendBatchIndex: created.length,
                spendSource,
                spentFromBonusId: bonus.id,
                originalBonusAmount: bonusAmount
              } as Prisma.InputJsonObject,
              userLevel: currentLevel?.name,
              appliedPercent: currentLevel?.paymentPercent
            }
          });
          created.push(transaction as unknown as Transaction);

          const newAmount = bonusAmount - spendFromThisBonus;
          await tx.bonus.update({
            where: { id: bonus.id },
            data:
              newAmount <= 0
                ? { isUsed: true }
                : { amount: newAmount, isUsed: false }
          });
          remainingAmount -= spendFromThisBonus;
        }
        return created;
      });
    } catch (error) {
      if (
        idempotencyKey &&
        error instanceof Object &&
        (error as { code?: string }).code === 'P2002'
      ) {
        const concurrentSpend = await findExistingSpend();
        if (concurrentSpend.length > 0) return concurrentSpend;
      }
      throw error;
    }

    if (transactions.length > 0) {
      try {
        await sendBonusSpentNotification(
          user as any,
          amount,
          description || 'Списание бонусов',
          user.projectId
        );
      } catch (error) {
        logger.error('Ошибка отправки уведомления о списании бонусов', {
          userId,
          amount,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          component: 'bonus-service'
        });
      }

      try {
        const { SyncService } = await import(
          '@/lib/moysklad-direct/sync-service'
        );
        const syncService = new SyncService();
        const metadataSource =
          typeof baseMetadata.source === 'string'
            ? baseMetadata.source
            : typeof baseMetadata.spendSource === 'string'
              ? baseMetadata.spendSource
              : 'manual';
        await syncService.syncBonusSpendingToMoySklad({
          userId,
          amount,
          source: metadataSource,
          description
        });
      } catch (error) {
        logger.error('Ошибка синхронизации списания бонусов с МойСклад', {
          userId,
          amount,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          component: 'bonus-service'
        });
      }
    }

    return transactions;
  }

  // Создание транзакции
  static async createTransaction(
    data: CreateTransactionInput
  ): Promise<Transaction> {
    const transaction = await db.transaction.create({
      data,
      include: {
        user: true,
        bonus: true
      }
    });

    return transaction as any;
  }

  // Начисление за покупку с учётом уровня и реферальной системы
  static async awardPurchaseBonus(
    userId: string,
    purchaseAmount: number,
    orderId: string,
    description?: string,
    bonusType: BonusType = 'PURCHASE',
    metadata?: Record<string, unknown>
  ): Promise<{
    bonus: Bonus;
    levelInfo: {
      currentLevel: string;
      bonusPercent: number;
      levelChanged: boolean;
    };
    referralInfo?: {
      bonusAwarded: boolean;
      referrerBonus?: number;
      referrerUser?: User;
    };
  }> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { project: true }
    });
    if (!user || !user.project) {
      throw new Error('Пользователь или проект не найден');
    }

    const externalId = `tilda_order_${orderId}`;
    const existingBonus = await db.bonus.findUnique({ where: { externalId } });
    const accountingManaged = metadata?.accountingManaged === true;
    const newTotalPurchases = accountingManaged
      ? Number(user.totalPurchases)
      : Number(user.totalPurchases) + purchaseAmount;
    const levelUpdateResult = existingBonus
      ? {
          newLevel: user.currentLevel || 'Базовый',
          levelChanged: false
        }
      : await BonusLevelService.updateUserLevel(userId, newTotalPurchases);

    let bonusPercent = Number(user.project.bonusPercentage);
    const currentLevel = await BonusLevelService.calculateUserLevel(
      user.projectId,
      newTotalPurchases
    );
    if (currentLevel) bonusPercent = currentLevel.bonusPercent;

    const bonusAmount = (purchaseAmount * bonusPercent) / 100;
    const metadataSource =
      typeof metadata?.source === 'string' ? metadata.source : 'tilda_order';
    const bonus =
      existingBonus ||
      (await this.awardBonus({
        userId,
        amount: bonusAmount,
        type: bonusType,
        description:
          description ||
          `Бонус за покупку на сумму ${purchaseAmount} руб. (заказ ${orderId})`,
        metadata: {
          ...metadata,
          orderId,
          source: metadataSource,
          purchaseAmount
        },
        externalId
      } as CreateBonusInput & { externalId: string }));

    // Referral payouts have their own deterministic external IDs, so rerunning
    // this step safely completes a previously interrupted payout chain.
    const referralInfo = await ReferralService.processReferralBonus(
      userId,
      purchaseAmount,
      orderId
    );

    logger.info('Начислен бонус за покупку', {
      userId,
      purchaseAmount,
      bonusAmount,
      bonusPercent,
      accountingManaged,
      reusedExistingBonus: Boolean(existingBonus),
      currentLevel: levelUpdateResult.newLevel,
      levelChanged: levelUpdateResult.levelChanged,
      referralBonusAwarded: referralInfo.bonusAwarded,
      component: 'bonus-service'
    });

    return {
      bonus: bonus as Bonus,
      levelInfo: {
        currentLevel: levelUpdateResult.newLevel || 'Базовый',
        bonusPercent,
        levelChanged: levelUpdateResult.levelChanged
      },
      referralInfo: referralInfo.bonusAwarded ? referralInfo : undefined
    };
  }

  // Начисление ко дню рождения
  static async awardBirthdayBonus(
    userId: string,
    amount: number
  ): Promise<Bonus> {
    return this.awardBonus({
      userId,
      amount,
      type: 'BIRTHDAY',
      description: `Бонус ко дню рождения`
    });
  }
}
