/**
 * @file: partner-cabinet.service.ts
 * @description: Обработка callback-кнопок партнёрского кабинета в Telegram/MAX
 * @project: SaaS Bonus System
 * @created: 2026-06-07
 */

import type { Context } from 'grammy';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { CacheService } from '@/lib/redis';
import {
  PartnerTeamService,
  type TeamListFilter
} from './partner-team.service';
import { PayoutService } from './payout.service';
import { PartnerNotificationService } from './partner-notification.service';
import { AdminNotificationService } from './admin-notification.service';

function formatRub(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(amount);
}

function formatName(u: {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
}): string {
  const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return full || u.phone || u.email || 'Без имени';
}

function roleLabel(role: string): string {
  switch (role) {
    case 'DIRECTOR':
      return 'Уровень 3';
    case 'MANAGER':
      return 'Уровень 2';
    case 'TRAINER':
      return 'Уровень 1';
    default:
      return 'Клиент';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Валидация реквизитов вывода. card/sbp/wallet остаются на минимальной
// проверке длины (как было в v1) — эти способы не завязаны на реальный
// денежный перевод по банковским реквизитам. self_employed (ИНН + ФИО +
// номер карты) валидируется строже: это данные для настоящего банковского
// перевода самозанятому, опечатка здесь — это не потерянное сообщение в
// боте, а реальные деньги не туда.
// ─────────────────────────────────────────────────────────────────────────

function validateGenericPayoutText(value: string): string | null {
  if (value.length < 4 || value.length > 200) {
    return '⚠️ Реквизиты выглядят некорректно. Попробуйте ещё раз.';
  }
  return null;
}

function normalizeDigitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function validateInn(value: string): string | null {
  const digits = normalizeDigitsOnly(value);
  if (digits.length !== 10 && digits.length !== 12) {
    return '⚠️ ИНН должен содержать 10 цифр (юрлицо) или 12 цифр (физлицо/самозанятый). Попробуйте ещё раз.';
  }
  return null;
}

function validateFullName(value: string): string | null {
  const trimmed = value.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (
    parts.length < 2 ||
    parts.length > 5 ||
    !/^[а-яёА-ЯЁa-zA-Z\- ]+$/.test(trimmed)
  ) {
    return '⚠️ Введите ФИО полностью (фамилия и имя, при наличии — отчество), только буквами. Попробуйте ещё раз.';
  }
  return null;
}

function luhnCheck(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = parseInt(digits[i], 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function validateCardNumber(value: string): string | null {
  const digits = normalizeDigitsOnly(value);
  if (digits.length < 13 || digits.length > 19 || !luhnCheck(digits)) {
    return '⚠️ Номер карты выглядит некорректно — проверьте цифры и попробуйте ещё раз.';
  }
  return null;
}

interface PayoutFieldSpec {
  key: string;
  prompt: string;
  validate: (value: string) => string | null;
  normalize?: (value: string) => string;
}

interface PendingPayoutCapture {
  userId: string;
  method: string;
  /** Индекс текущего поля в PAYOUT_METHOD_FIELDS[method]. */
  stepIndex: number;
  /** Уже собранные и провалидированные поля (key → нормализованное значение). */
  collected: Record<string, string>;
  requestTelegramId?: number;
  source?: string;
}

async function resolveUserId(
  projectId: string,
  ctx: Context
): Promise<string | null> {
  const fromId = ctx.from?.id;
  if (!fromId) return null;

  const user = await db.user.findFirst({
    where: { projectId, telegramId: BigInt(fromId) },
    select: { id: true, partnerRole: true }
  });
  return user?.id ?? null;
}

const FILTER_LABELS: Record<TeamListFilter, string> = {
  direct: 'Прямые',
  clients: 'Клиенты',
  partners: 'Партнёры',
  all: 'Вся команда'
};

export class PartnerCabinetService {
  static async tryHandleTelegramCallback(
    projectId: string,
    ctx: Context
  ): Promise<boolean> {
    const data = ctx.callbackQuery?.data;
    if (!data) return false;

    const userId = await resolveUserId(projectId, ctx);
    if (!userId) return false;

    try {
      if (data.startsWith('partner_join_approve:')) {
        const requestId = data.split(':')[1];
        const result = await PartnerTeamService.approveJoinRequest({
          projectId,
          requestId,
          reviewerUserId: userId
        });
        const approvedRoleLabel = roleLabel(result.partnerRole);
        await ctx.answerCallbackQuery({ text: '✅ Заявка одобрена' });
        await ctx.reply(`✅ ${approvedRoleLabel} добавлен в вашу команду.`);
        return true;
      }

      if (data.startsWith('partner_join_reject:')) {
        const requestId = data.split(':')[1];
        await PartnerTeamService.rejectJoinRequest({
          projectId,
          requestId,
          reviewerUserId: userId
        });
        await ctx.answerCallbackQuery({ text: 'Заявка отклонена' });
        await ctx.reply('❌ Заявка отклонена.');
        return true;
      }

      if (data.startsWith('partner_team_remove_confirm:')) {
        const subjectId = data.split(':')[1];
        await PartnerTeamService.removeFromTeam({
          projectId,
          managerUserId: userId,
          subjectUserId: subjectId
        });
        await ctx.answerCallbackQuery({ text: 'Убран из команды' });
        await ctx
          .editMessageText('👤 Участник убран из вашей команды.')
          .catch(() => {});
        return true;
      }

      if (data === 'partner_team_remove_cancel') {
        await ctx.answerCallbackQuery({ text: 'Удаление отменено' });
        await ctx
          .editMessageText('Удаление участника отменено.')
          .catch(() => {});
        return true;
      }

      if (data.startsWith('partner_team_remove:')) {
        const subjectId = data.split(':')[1];
        const subject = await db.user.findFirst({
          where: { id: subjectId, projectId },
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        });
        if (!subject) throw new Error('Участник не найден');

        await ctx.answerCallbackQuery();
        await ctx.reply(
          `Убрать <b>${formatName(subject)}</b> из команды? Связи и доступ к статистике изменятся.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Да, убрать',
                    callback_data: `partner_team_remove_confirm:${subjectId}`
                  },
                  {
                    text: 'Отмена',
                    callback_data: 'partner_team_remove_cancel'
                  }
                ]
              ]
            }
          }
        );
        return true;
      }

      if (data === 'partner_requests') {
        await this.renderPendingRequests(projectId, userId, ctx);
        return true;
      }

      // Вывод средств (план 007): партнёр запрашивает/отзывает вывод. Логика
      // платформо-нейтральна (resolvePayoutAction) — рендерим её в grammy здесь
      // и в MAX-боте отдельно.
      if (
        data === 'payout_request' ||
        data.startsWith('payout_cancel:') ||
        data.startsWith('payout_method:') ||
        data === 'payout_method_cancel'
      ) {
        const result = await this.resolvePayoutAction(projectId, userId, data, {
          requestTelegramId: ctx.from?.id,
          externalUserId: ctx.from?.id?.toString(),
          platform: 'telegram'
        });
        if (result) {
          await ctx.answerCallbackQuery({ text: result.toast }).catch(() => {});
          await ctx.reply(
            result.text,
            result.replyMarkup
              ? { parse_mode: 'HTML', reply_markup: result.replyMarkup }
              : { parse_mode: 'HTML' }
          );
        }
        return true;
      }

      if (data.startsWith('partner_team_page:')) {
        const page = Number.parseInt(data.split(':')[1] ?? '0', 10);
        await this.renderTeamList(
          projectId,
          userId,
          ctx,
          undefined,
          Number.isFinite(page) && page >= 0 ? page : 0
        );
        return true;
      }

      if (data.startsWith('partner_team_tab:')) {
        const parts = data.split(':');
        const requestedFilter = parts[1] ?? 'direct';
        const filter: TeamListFilter = (
          ['direct', 'clients', 'partners', 'all'] as const
        ).includes(requestedFilter as TeamListFilter)
          ? (requestedFilter as TeamListFilter)
          : 'direct';
        const requestedPage = Number.parseInt(parts[2] ?? '0', 10);
        const page =
          Number.isFinite(requestedPage) && requestedPage >= 0
            ? requestedPage
            : 0;
        await this.renderTeamList(projectId, userId, ctx, filter, page);
        return true;
      }
    } catch (err) {
      logger.warn('PartnerCabinetService callback failed', {
        data,
        projectId,
        err: err instanceof Error ? err.message : String(err)
      });
      await ctx
        .answerCallbackQuery({
          text: err instanceof Error ? err.message : 'Ошибка',
          show_alert: true
        })
        .catch(() => {});
      return true;
    }

    return false;
  }

  static async renderTeamList(
    projectId: string,
    userId: string,
    ctx: Context,
    filter: TeamListFilter | undefined,
    page = 0,
    pageSize = 5
  ) {
    const me = await db.user.findFirst({
      where: { id: userId, projectId },
      select: {
        partnerRole: true,
        organizationMemberships: {
          where: { projectId, canManage: true },
          select: { id: true },
          take: 1
        }
      }
    });

    const selectedFilter =
      filter ??
      PartnerTeamService.getDefaultTeamFilter({
        partnerRole: me?.partnerRole,
        managesOrganization: Boolean(me?.organizationMemberships.length)
      });
    const result = await PartnerTeamService.listTeam({
      projectId,
      viewerUserId: userId,
      filter: selectedFilter,
      page: page + 1,
      pageSize
    });

    const totalPages = Math.max(1, Math.ceil(result.total / pageSize));
    const tabRow = [
      { text: '👤 Клиенты', callback_data: 'partner_team_tab:clients:0' },
      { text: '🏃 Партнёры', callback_data: 'partner_team_tab:partners:0' },
      { text: '🌳 Все', callback_data: 'partner_team_tab:all:0' }
    ];

    if (result.total === 0) {
      await ctx.reply(
        `👥 <b>Моя команда</b> · ${FILTER_LABELS[selectedFilter]}\n\nПока пусто. Выберите другую вкладку или вернитесь в меню.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              tabRow,
              [{ text: '📥 Заявки', callback_data: 'partner_requests' }],
              [{ text: '⬅️ Меню', callback_data: 'back_to_menu' }]
            ]
          }
        }
      );
      return;
    }

    const lines = [
      `<b>👥 Моя команда</b> · ${FILTER_LABELS[selectedFilter]} (${result.total})`,
      `Стр. ${page + 1} / ${totalPages}`,
      `💼 Оборот команды: <b>${formatRub(result.summary.totalPurchases)}</b>`,
      `💰 Ваша комиссия: <b>${formatRub(result.summary.personalCommission)}</b>`,
      ''
    ];

    result.items.forEach((u, idx) => {
      const memberLabel =
        u.organizationTitle ||
        (u.organizationLevel
          ? `Уровень ${u.organizationLevel}`
          : roleLabel(u.partnerRole));
      lines.push(
        `${idx + 1 + page * pageSize}. <b>${u.name}</b> · ${memberLabel}\n   💼 Оборот: ${formatRub(u.totalPurchases)} · 💰 Ваша комиссия: ${formatRub(u.commissionEarned)}`
      );
    });

    const canManage =
      me &&
      (me.partnerRole !== 'CLIENT' || me.organizationMemberships.length > 0);

    const detailButtons = result.items.map((u) => {
      const row: Array<{ text: string; callback_data: string }> = [
        {
          text: `📊 ${u.name.slice(0, 20)}`,
          callback_data: `partner_subject:${u.id}`
        }
      ];
      if (
        canManage &&
        u.id !== userId &&
        !['DIRECTOR', 'MANAGER'].includes(u.partnerRole)
      ) {
        row.push({
          text: 'Убрать',
          callback_data: `partner_team_remove:${u.id}`
        });
      }
      return row;
    });

    const pager: Array<{ text: string; callback_data: string }> = [];
    if (page > 0) {
      pager.push({
        text: '⬅️',
        callback_data: `partner_team_tab:${selectedFilter}:${page - 1}`
      });
    }
    if (page + 1 < totalPages) {
      pager.push({
        text: '➡️',
        callback_data: `partner_team_tab:${selectedFilter}:${page + 1}`
      });
    }

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          tabRow,
          ...detailButtons,
          ...(pager.length ? [pager] : []),
          [{ text: '📥 Заявки', callback_data: 'partner_requests' }],
          [{ text: '⬅️ Меню', callback_data: 'back_to_menu' }]
        ]
      }
    });
  }

  /** Способы вывода, которые партнёр выбирает перед вводом реквизитов. */
  private static readonly PAYOUT_METHOD_LABELS: Record<string, string> = {
    card: '💳 Карта',
    sbp: '📱 Телефон (СБП)',
    wallet: '👛 Электронный кошелёк',
    self_employed: '🧾 Самозанятый (ИНН + ФИО + карта)'
  };

  /**
   * Поля реквизитов на каждый способ вывода, в порядке пошагового сбора.
   * card/sbp/wallet — одно свободнотекстовое поле `raw` (как было в v1,
   * payoutDetails остаётся { raw } для этих методов — админка их уже так
   * рендерит). self_employed — три поля по очереди: при ошибке валидации
   * бот переспрашивает ТОЛЬКО текущий шаг, не сбрасывая уже введённые
   * (см. resolvePayoutDetailsCapture).
   */
  private static readonly PAYOUT_METHOD_FIELDS: Record<
    string,
    PayoutFieldSpec[]
  > = {
    card: [
      {
        key: 'raw',
        prompt: 'Введите номер карты для зачисления.',
        validate: validateGenericPayoutText
      }
    ],
    sbp: [
      {
        key: 'raw',
        prompt:
          'Введите номер телефона, привязанный к СБП (например, +79991234567).',
        validate: validateGenericPayoutText
      }
    ],
    wallet: [
      {
        key: 'raw',
        prompt: 'Введите номер или адрес электронного кошелька.',
        validate: validateGenericPayoutText
      }
    ],
    self_employed: [
      {
        key: 'inn',
        prompt:
          'Шаг 1/3. Введите ваш ИНН (10 цифр — юрлицо, 12 — физлицо/самозанятый).',
        validate: validateInn,
        normalize: normalizeDigitsOnly
      },
      {
        key: 'fullName',
        prompt: 'Шаг 2/3. Введите ФИО полностью, как в паспорте.',
        validate: validateFullName
      },
      {
        key: 'cardNumber',
        prompt: 'Шаг 3/3. Введите номер карты для перевода.',
        validate: validateCardNumber,
        normalize: normalizeDigitsOnly
      }
    ]
  };

  /** Сколько хранить в Redis выбор способа, пока партнёр не пришлёт реквизиты. */
  private static readonly PENDING_PAYOUT_TTL_SECONDS = 600;

  private static pendingPayoutCacheKey(
    projectId: string,
    platform: 'telegram' | 'max',
    externalUserId: string
  ): string {
    return `payout_pending:${projectId}:${platform}:${externalUserId}`;
  }

  private static async setPendingPayoutCapture(
    projectId: string,
    platform: 'telegram' | 'max',
    externalUserId: string,
    data: PendingPayoutCapture
  ): Promise<void> {
    await CacheService.set(
      this.pendingPayoutCacheKey(projectId, platform, externalUserId),
      data,
      this.PENDING_PAYOUT_TTL_SECONDS
    );
  }

  private static async getPendingPayoutCapture(
    projectId: string,
    platform: 'telegram' | 'max',
    externalUserId: string
  ): Promise<PendingPayoutCapture | null> {
    return CacheService.get(
      this.pendingPayoutCacheKey(projectId, platform, externalUserId)
    );
  }

  private static async clearPendingPayoutCapture(
    projectId: string,
    platform: 'telegram' | 'max',
    externalUserId: string
  ): Promise<void> {
    await CacheService.delete(
      this.pendingPayoutCacheKey(projectId, platform, externalUserId)
    );
  }

  /**
   * Создаёт заявку на вывод и рассылает уведомления. Общий хвост как для
   * прямого запроса (когда реквизиты уже введены), так и для завершения
   * захвата реквизитов после выбора способа.
   */
  private static async finalizePayoutRequest(
    projectId: string,
    userId: string,
    amount: number,
    opts: {
      requestTelegramId?: number;
      source?: string;
      payoutMethod?: string;
      payoutDetails?: Record<string, unknown>;
    }
  ): Promise<{
    toast: string;
    text: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
  }> {
    const bucket = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    const externalId = `payout_req_${userId}_${bucket}`;

    try {
      const payout = await PayoutService.requestPayout({
        projectId,
        userId,
        amount,
        requestTelegramId: opts.requestTelegramId,
        requestSource: opts.source,
        externalId,
        payoutMethod: opts.payoutMethod,
        payoutDetails: opts.payoutDetails
      });
      // Уведомить руководителя организации (неблокирующе, обе платформы).
      await PartnerNotificationService.notifyDirectorAboutPayoutRequest(
        payout.id,
        projectId
      );
      // In-app уведомление владельцу проекта (колокольчик). Fire-and-forget:
      // сбой уведомления не должен ломать создание заявки на вывод.
      void AdminNotificationService.notifyProjectOwner(projectId, {
        type: 'payout_requested',
        severity: 'warning',
        title: 'Новая заявка на вывод',
        message: `Партнёр запросил вывод ${formatRub(Number(payout.amount))}`,
        link: `/dashboard/projects/${projectId}/referral?tab=payouts`,
        metadata: { payoutId: payout.id, userId }
      }).catch((err) =>
        logger.error('Failed to create admin notification (payout_requested)', {
          projectId,
          payoutId: payout.id,
          error: err instanceof Error ? err.message : String(err)
        })
      );
      return {
        toast: 'Заявка создана',
        text: `✅ Заявка на вывод ${formatRub(Number(payout.amount))} создана.\n\nОжидайте подтверждения администратора.`,
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: '↩️ Отозвать заявку',
                callback_data: `payout_cancel:${payout.id}`
              }
            ]
          ]
        }
      };
    } catch (error) {
      return {
        toast: 'Не удалось создать заявку',
        text: `⚠️ ${error instanceof Error ? error.message : 'Не удалось создать заявку на вывод'}`
      };
    }
  }

  /**
   * Платформо-нейтральная логика вывода средств (план 007). Возвращает ЧТО
   * показать (toast + текст + опц. клавиатуру в Telegram-формате), а рендерит
   * вызывающий — grammy (Telegram) или MAX-бот. Идемпотентна по минутному
   * bucket'у externalId — двойной тап не создаёт две заявки.
   *
   * Перед созданием заявки партнёр обязан выбрать способ вывода
   * (`payout_method:<card|sbp|wallet>`) и прислать реквизиты обычным
   * сообщением — см. resolvePayoutDetailsCapture().
   *
   * @returns null, если data не относится к выводу.
   */
  static async resolvePayoutAction(
    projectId: string,
    userId: string,
    data: string,
    opts: {
      requestTelegramId?: number;
      source?: string;
      externalUserId?: string;
      platform?: 'telegram' | 'max';
    } = {}
  ): Promise<{
    toast: string;
    text: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
  } | null> {
    const platform = opts.platform ?? 'telegram';
    const externalUserId =
      opts.externalUserId ?? opts.requestTelegramId?.toString();

    if (data === 'payout_request') {
      const balanceAgg = await db.bonus.aggregate({
        where: {
          userId,
          isUsed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        _sum: { amount: true }
      });
      const available = Number(balanceAgg._sum.amount ?? 0);

      if (available <= 0) {
        return {
          toast: 'Нечего выводить',
          text: '💸 Доступных к выводу средств нет.'
        };
      }

      return {
        toast: 'Выберите способ',
        text: `💸 К выводу: ${formatRub(available)}.\n\nВыберите, куда перечислить средства:`,
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: this.PAYOUT_METHOD_LABELS.card,
                callback_data: 'payout_method:card'
              }
            ],
            [
              {
                text: this.PAYOUT_METHOD_LABELS.sbp,
                callback_data: 'payout_method:sbp'
              }
            ],
            [
              {
                text: this.PAYOUT_METHOD_LABELS.wallet,
                callback_data: 'payout_method:wallet'
              }
            ],
            [
              {
                text: this.PAYOUT_METHOD_LABELS.self_employed,
                callback_data: 'payout_method:self_employed'
              }
            ]
          ]
        }
      };
    }

    if (data.startsWith('payout_method:')) {
      const method = data.split(':')[1];
      const fields = this.PAYOUT_METHOD_FIELDS[method];
      if (!fields || !externalUserId) {
        return {
          toast: 'Неизвестный способ',
          text: '⚠️ Неизвестный способ вывода. Нажмите «Вывести деньги» ещё раз.'
        };
      }

      const balanceAgg = await db.bonus.aggregate({
        where: {
          userId,
          isUsed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        _sum: { amount: true }
      });
      const available = Number(balanceAgg._sum.amount ?? 0);

      if (available <= 0) {
        return {
          toast: 'Нечего выводить',
          text: '💸 Доступных к выводу средств нет.'
        };
      }

      await this.setPendingPayoutCapture(projectId, platform, externalUserId, {
        userId,
        method,
        stepIndex: 0,
        collected: {},
        requestTelegramId: opts.requestTelegramId,
        source: opts.source
      });

      return {
        toast: 'Способ выбран',
        text: `${this.PAYOUT_METHOD_LABELS[method]}\n\n${fields[0].prompt}`,
        replyMarkup: {
          inline_keyboard: [
            [{ text: '✖️ Отмена', callback_data: 'payout_method_cancel' }]
          ]
        }
      };
    }

    if (data === 'payout_method_cancel') {
      if (externalUserId) {
        await this.clearPendingPayoutCapture(
          projectId,
          platform,
          externalUserId
        );
      }
      return {
        toast: 'Отменено',
        text: '❌ Вывод средств отменён.'
      };
    }

    if (data.startsWith('payout_cancel:')) {
      const payoutId = data.split(':')[1];
      try {
        await PayoutService.cancelPayout(payoutId, userId);
        // In-app уведомление владельцу проекта (колокольчик). Fire-and-forget.
        void AdminNotificationService.notifyProjectOwner(projectId, {
          type: 'payout_cancelled',
          severity: 'info',
          title: 'Заявка на вывод отозвана',
          message: 'Партнёр отозвал заявку на вывод средств.',
          link: `/dashboard/projects/${projectId}/referral?tab=payouts`,
          metadata: { payoutId, userId }
        }).catch((err) =>
          logger.error(
            'Failed to create admin notification (payout_cancelled)',
            {
              projectId,
              payoutId,
              error: err instanceof Error ? err.message : String(err)
            }
          )
        );
        return {
          toast: 'Заявка отозвана',
          text: '↩️ Заявка на вывод отозвана, бонусы возвращены.'
        };
      } catch (error) {
        return {
          toast: 'Не удалось отозвать',
          text: `⚠️ ${error instanceof Error ? error.message : 'Не удалось отозвать заявку'}`
        };
      }
    }

    return null;
  }

  /**
   * Платформо-нейтральная обработка сообщения с реквизитами вывода — второй
   * шаг после выбора способа (payout_method:*). Если для externalUserId нет
   * ожидающего выбора способа, возвращает null — вызывающий должен
   * пропустить сообщение дальше (в workflow/фоллбэк), это не про вывод денег.
   */
  static async resolvePayoutDetailsCapture(
    projectId: string,
    platform: 'telegram' | 'max',
    externalUserId: string,
    text: string
  ): Promise<{
    toast: string;
    text: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
  } | null> {
    const pending = await this.getPendingPayoutCapture(
      projectId,
      platform,
      externalUserId
    );
    if (!pending) return null;

    const trimmed = text.trim();

    // Команды (/start и т.п.) не считаем реквизитами — оставляем ожидание
    // активным, пусть команда обработается как обычно.
    if (trimmed.startsWith('/')) return null;

    const fields = this.PAYOUT_METHOD_FIELDS[pending.method];
    const field = fields?.[pending.stepIndex];
    if (!field) {
      // Способ из старой/повреждённой записи в Redis — не подвисаем молча.
      await this.clearPendingPayoutCapture(projectId, platform, externalUserId);
      return {
        toast: 'Ошибка',
        text: '⚠️ Не удалось определить способ вывода. Нажмите «Вывести деньги» ещё раз.'
      };
    }

    const validationError = field.validate(trimmed);
    if (validationError) {
      // НЕ сбрасываем pending — переспрашиваем именно этот шаг, а не всю
      // цепочку заново (для self_employed это 3 шага, терять их из-за одной
      // опечатки в номере карты — плохой UX).
      await this.setPendingPayoutCapture(
        projectId,
        platform,
        externalUserId,
        pending
      );
      return { toast: 'Некорректные данные', text: validationError };
    }

    const value = field.normalize ? field.normalize(trimmed) : trimmed;
    const collected = { ...pending.collected, [field.key]: value };
    const nextStepIndex = pending.stepIndex + 1;
    const nextField = fields[nextStepIndex];

    if (nextField) {
      await this.setPendingPayoutCapture(projectId, platform, externalUserId, {
        ...pending,
        stepIndex: nextStepIndex,
        collected
      });
      return {
        toast: 'Принято',
        text: nextField.prompt,
        replyMarkup: {
          inline_keyboard: [
            [{ text: '✖️ Отмена', callback_data: 'payout_method_cancel' }]
          ]
        }
      };
    }

    // Последнее поле для этого способа — завершаем сбор и создаём заявку.
    await this.clearPendingPayoutCapture(projectId, platform, externalUserId);

    const balanceAgg = await db.bonus.aggregate({
      where: {
        userId: pending.userId,
        isUsed: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      _sum: { amount: true }
    });
    const available = Number(balanceAgg._sum.amount ?? 0);

    if (available <= 0) {
      return {
        toast: 'Нечего выводить',
        text: '💸 Доступных к выводу средств уже нет.'
      };
    }

    return this.finalizePayoutRequest(projectId, pending.userId, available, {
      requestTelegramId: pending.requestTelegramId,
      source: pending.source,
      payoutMethod: pending.method,
      payoutDetails: collected
    });
  }

  /**
   * Grammy-обёртка над resolvePayoutDetailsCapture для Telegram.
   *
   * @returns true, если сообщение обработано как реквизиты вывода (дальше
   * его обрабатывать не нужно); false — сообщение не относится к выводу.
   */
  static async tryHandlePayoutDetailsMessage(
    projectId: string,
    ctx: Context
  ): Promise<boolean> {
    const text = ctx.message?.text;
    const fromId = ctx.from?.id;
    if (!text || !fromId) return false;

    const result = await this.resolvePayoutDetailsCapture(
      projectId,
      'telegram',
      fromId.toString(),
      text
    );
    if (!result) return false;

    await ctx.reply(
      result.text,
      result.replyMarkup
        ? { parse_mode: 'HTML', reply_markup: result.replyMarkup }
        : { parse_mode: 'HTML' }
    );
    return true;
  }

  static async renderPendingRequests(
    projectId: string,
    userId: string,
    ctx: Context
  ) {
    const requests = await PartnerTeamService.listPendingRequestsForReviewer(
      projectId,
      userId
    );

    if (requests.length === 0) {
      await ctx.reply('📥 Нет ожидающих заявок.');
      return;
    }

    for (const req of requests.slice(0, 5)) {
      const name = req.user ? formatName(req.user) : req.userId;
      await ctx.reply(`📥 <b>Заявка</b>\n${name}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ Принять',
                callback_data: `partner_join_approve:${req.id}`
              },
              {
                text: '❌ Отклонить',
                callback_data: `partner_join_reject:${req.id}`
              }
            ]
          ]
        }
      });
    }
  }
}
