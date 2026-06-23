/**
 * @file: scripts/migrate-partner-roles.ts
 * @description: Активация B2B-режима (Project.enablePartnerRoles) для проекта и
 *               опциональное массовое проставление partnerRole = TRAINER всем
 *               пользователям с outboundReferralPlanId. Идемпотентно — повторный
 *               запуск не дублирует и не ломает данные.
 * @project: SaaS Bonus System
 * @dependencies: Prisma, @/lib/db
 * @created: 2026-05-24
 * @author: AI Assistant + User
 *
 * Usage:
 *   # Включить b2b-режим для конкретного проекта
 *   npx tsx scripts/migrate-partner-roles.ts --projectId=<id>
 *
 *   # Включить b2b-режим + массово назначить TRAINER всем юзерам с outbound-планом
 *   npx tsx scripts/migrate-partner-roles.ts --projectId=<id> --auto-trainers
 *
 *   # Только auto-trainers (по всем проектам, где b2b уже включён)
 *   npx tsx scripts/migrate-partner-roles.ts --auto-trainers
 *
 *   # Dry-run (ничего не пишем, только показываем что будет сделано)
 *   npx tsx scripts/migrate-partner-roles.ts --projectId=<id> --auto-trainers --dry-run
 *
 * См. также: docs/b2b-referral-hierarchy-guide.md
 */

import type { PartnerRole } from '@prisma/client';

import { db } from '../src/lib/db';

/** Роли, у которых ОЖИДАЕТСЯ платёжный родитель выше (план 005). */
const PARTNER_PARENT_ROLES: PartnerRole[] = ['TRAINER', 'MANAGER'];

interface CliArgs {
  projectId?: string;
  autoTrainers: boolean;
  backfillParents: boolean;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    autoTrainers: false,
    backfillParents: false,
    dryRun: false,
    help: false
  };
  for (const raw of process.argv.slice(2)) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
    } else if (raw.startsWith('--projectId=')) {
      args.projectId = raw.split('=')[1];
    } else if (raw === '--projectId') {
      console.error(
        '❌ --projectId должен быть в формате --projectId=<id> (через знак равенства)'
      );
      process.exit(1);
    } else if (raw === '--auto-trainers') {
      args.autoTrainers = true;
    } else if (raw === '--backfill-parents') {
      args.backfillParents = true;
    } else if (raw === '--dry-run') {
      args.dryRun = true;
    } else {
      console.error(`❌ Неизвестный аргумент: ${raw}`);
      process.exit(1);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
🏢 migrate-partner-roles — миграция на b2b-режим реферальной иерархии

Аргументы:
  --projectId=<id>     ID проекта, для которого включить enablePartnerRoles=true
  --auto-trainers      Массово назначить partnerRole=TRAINER всем юзерам, у
                       которых есть outboundReferralPlanId и роль = CLIENT
  --backfill-parents   Проставить partnerParentId = referredBy партнёрам, у
                       которых явный платёжный родитель ещё не задан (план 005).
                       Партнёры без referredBy остаются с null и попадают в отчёт
                       «нужна ручная привязка» — НЕ угадываем.
  --dry-run            Только показать что будет сделано, без записи в БД
  --help, -h           Показать эту справку

Примеры:
  npx tsx scripts/migrate-partner-roles.ts --projectId=clxxx --auto-trainers
  npx tsx scripts/migrate-partner-roles.ts --projectId=clxxx --dry-run

Идемпотентность:
  - enablePartnerRoles=true ставится только если ещё false (no-op при повторе)
  - --auto-trainers промоутит только CLIENT с outbound-планом → TRAINER.
    Уже назначенные TRAINER/MANAGER/DIRECTOR не трогаем.
  - Безопасно запускать многократно.

См. полный гайд: docs/b2b-referral-hierarchy-guide.md
`);
}

async function enableProjectFlag(
  projectId: string,
  dryRun: boolean
): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, enablePartnerRoles: true }
  });

  if (!project) {
    console.error(`❌ Проект ${projectId} не найден`);
    process.exit(1);
  }

  if (project.enablePartnerRoles) {
    console.log(
      `✓ ${project.name} (${project.id}): enablePartnerRoles уже = true (no-op)`
    );
    return;
  }

  if (dryRun) {
    console.log(
      `[dry-run] ${project.name} (${project.id}): включил бы enablePartnerRoles=true`
    );
    return;
  }

  await db.project.update({
    where: { id: projectId },
    data: { enablePartnerRoles: true }
  });
  console.log(
    `✅ ${project.name} (${project.id}): enablePartnerRoles установлен в true`
  );
}

async function autoPromoteTrainers(
  projectId: string | undefined,
  dryRun: boolean
): Promise<void> {
  // Целевые проекты: либо явно указанный, либо все с уже включённым флагом.
  const projectFilter = projectId
    ? { id: projectId }
    : { enablePartnerRoles: true };

  const projects = await db.project.findMany({
    where: projectFilter,
    select: { id: true, name: true, enablePartnerRoles: true }
  });

  if (projects.length === 0) {
    console.log(
      '⚠️  Нет проектов для обработки. Передайте --projectId=<id> или сначала включите enablePartnerRoles.'
    );
    return;
  }

  console.log(`\n🔍 Обработка проектов с auto-trainers: ${projects.length}`);

  let totalPromoted = 0;
  let totalSkipped = 0;

  for (const project of projects) {
    if (!project.enablePartnerRoles) {
      console.log(
        `⏭  ${project.name} (${project.id}): пропускаем — enablePartnerRoles=false`
      );
      totalSkipped++;
      continue;
    }

    // Идемпотентно: только CLIENT с outboundReferralPlanId != null → TRAINER.
    const where = {
      projectId: project.id,
      outboundReferralPlanId: { not: null },
      partnerRole: 'CLIENT' as const
    };

    const candidates = await db.user.count({ where });

    if (candidates === 0) {
      console.log(
        `✓ ${project.name} (${project.id}): 0 кандидатов (либо все уже партнёры, либо нет outbound-планов)`
      );
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] ${project.name} (${project.id}): промоутил бы ${candidates} CLIENT → TRAINER`
      );
      totalPromoted += candidates;
      continue;
    }

    const result = await db.user.updateMany({
      where,
      data: { partnerRole: 'TRAINER' }
    });

    console.log(
      `✅ ${project.name} (${project.id}): промоутили ${result.count} CLIENT → TRAINER`
    );
    totalPromoted += result.count;
  }

  console.log(
    `\n📊 Итого: ${totalPromoted} пользователей переведено в TRAINER (skipped projects: ${totalSkipped})`
  );
}

async function backfillPartnerParents(
  projectId: string | undefined,
  dryRun: boolean
): Promise<void> {
  const projectFilter = projectId
    ? { id: projectId }
    : { enablePartnerRoles: true };

  const projects = await db.project.findMany({
    where: projectFilter,
    select: { id: true, name: true, enablePartnerRoles: true }
  });

  if (projects.length === 0) {
    console.log(
      '⚠️  Нет проектов для backfill. Передайте --projectId=<id> или включите enablePartnerRoles.'
    );
    return;
  }

  console.log(`\n🔗 Backfill partnerParentId по проектам: ${projects.length}`);

  let totalLinked = 0;
  let totalManual = 0;

  for (const project of projects) {
    // Идемпотентно: трогаем только тех, у кого partnerParentId ещё НЕ задан
    // и есть referredBy. Повторный запуск ничего не меняет.
    const linkable = {
      projectId: project.id,
      partnerParentId: null,
      referredBy: { not: null },
      partnerRole: { in: PARTNER_PARENT_ROLES }
    };

    // Партнёры, которым backfill не поможет (нет referredBy) — нужна ручная
    // привязка. Их НЕ угадываем, только считаем и сообщаем.
    const manualCount = await db.user.count({
      where: {
        projectId: project.id,
        partnerParentId: null,
        referredBy: null,
        partnerRole: { in: PARTNER_PARENT_ROLES }
      }
    });

    const linkableCount = await db.user.count({ where: linkable });

    if (dryRun) {
      console.log(
        `[dry-run] ${project.name} (${project.id}): связал бы ${linkableCount} партнёров (partnerParentId←referredBy); ${manualCount} требуют ручной привязки`
      );
      totalLinked += linkableCount;
      totalManual += manualCount;
      continue;
    }

    // Prisma не умеет column-to-column update через updateMany, поэтому
    // постранично читаем id+referredBy и проставляем. Объёмы партнёров малы.
    const rows = await db.user.findMany({
      where: linkable,
      select: { id: true, referredBy: true }
    });
    for (const row of rows) {
      if (!row.referredBy) continue;
      await db.user.update({
        where: { id: row.id },
        data: { partnerParentId: row.referredBy }
      });
    }

    console.log(
      `✅ ${project.name} (${project.id}): связали ${rows.length} партнёров; ${manualCount} требуют ручной привязки (partnerParentId и referredBy оба null)`
    );
    totalLinked += rows.length;
    totalManual += manualCount;
  }

  console.log(
    `\n📊 Backfill итог: связано ${totalLinked}; ручная привязка нужна для ${totalManual}.`
  );
  if (totalManual > 0) {
    console.log(
      '⚠️  Партнёры без referredBy остались с partnerParentId=null — их платёжная цепочка оборвётся с warn в логах, пока родитель не назначен вручную.'
    );
  }
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.projectId && !args.autoTrainers && !args.backfillParents) {
    console.error(
      '❌ Укажите --projectId=<id>, --auto-trainers и/или --backfill-parents. См. --help.'
    );
    process.exit(1);
  }

  console.log('🏢 migrate-partner-roles');
  console.log('Параметры:', {
    projectId: args.projectId ?? '(не задан)',
    autoTrainers: args.autoTrainers,
    backfillParents: args.backfillParents,
    dryRun: args.dryRun
  });

  // Шаг 1: включить флаг для конкретного проекта (если указан projectId)
  if (args.projectId) {
    await enableProjectFlag(args.projectId, args.dryRun);
  }

  // Шаг 2: массово промоутить тренеров (если запрошено)
  if (args.autoTrainers) {
    await autoPromoteTrainers(args.projectId, args.dryRun);
  }

  // Шаг 3: backfill явных платёжных родителей (план 005)
  if (args.backfillParents) {
    await backfillPartnerParents(args.projectId, args.dryRun);
  }

  console.log('\n✅ Миграция завершена');
}

main()
  .catch((err) => {
    console.error('❌ Миграция упала:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
