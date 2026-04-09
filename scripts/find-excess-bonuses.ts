import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const projectId = process.argv[2];

  if (!projectId) {
    console.error(
      'Пожалуйста, укажите ID проекта: npx tsx scripts/find-excess-bonuses.ts <PROJECT_ID>'
    );
    process.exit(1);
  }

  console.log(`🔍 Поиск излишних бонусов для проекта: ${projectId}...`);

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    console.error('Проект не найден');
    process.exit(1);
  }

  const basePercent = Number(project.bonusPercentage);
  console.log(`Базовый процент проекта: ${basePercent}%`);

  // Ищем все транзакции начисления за покупки
  const transactions = await prisma.transaction.findMany({
    where: {
      user: { projectId },
      type: 'EARN',
      description: { contains: 'Покупка' }
    },
    include: {
      user: true,
      bonus: true
    },
    orderBy: { createdAt: 'desc' }
  });

  let suspectTransactions = [];
  let totalExcessBonuses = 0;

  for (const t of transactions) {
    if (!t.metadata) continue;

    const meta = t.metadata as any;
    const appliedPercent = meta.bonusPercent ? Number(meta.bonusPercent) : null;
    const orderTotal = meta.orderTotal ? Number(meta.orderTotal) : null;

    // Если процент по транзакции выше базового — значит сработал уровень
    if (appliedPercent && appliedPercent > basePercent && orderTotal) {
      const actualBonus = Number(t.amount);
      const correctBonus = Math.floor(orderTotal * (basePercent / 100));
      const excessBonus = actualBonus - correctBonus;

      if (excessBonus > 0) {
        totalExcessBonuses += excessBonus;
        suspectTransactions.push({
          Имя:
            `${t.user.firstName || ''} ${t.user.lastName || ''}`.trim() ||
            'Без имени',
          Телефон_Email: t.user.phone || t.user.email || 'Нет контактов',
          Уровень_Пользователя: t.user.currentLevel || 'Нет',
          Дата: t.createdAt.toLocaleString('ru-RU'),
          Сумма_Заказа: orderTotal,
          Применен_Процент: `${appliedPercent}%`,
          Базовый_Процент: `${basePercent}%`,
          Начислено_Бонусов: actualBonus,
          Правильно_Бонусов: correctBonus,
          Излишек_К_Списанию: excessBonus,
          ID_Пользователя: t.userId
        });
      }
    }
  }

  if (suspectTransactions.length === 0) {
    console.log(
      '✅ Не найдено подозрительных начислений с завышенным процентом.'
    );
    return;
  }

  console.table(suspectTransactions);
  console.log(`\n🚨 Итого найдено транзакций: ${suspectTransactions.length}`);
  console.log(
    `💸 Общая сумма излишне начисленных бонусов: ${totalExcessBonuses}`
  );

  // Сохраняем в CSV
  const header = Object.keys(suspectTransactions[0]).join(',') + '\n';
  const csv = suspectTransactions
    .map((t) =>
      Object.values(t)
        .map((v) => `"${v}"`)
        .join(',')
    )
    .join('\n');
  fs.writeFileSync('excess-bonuses-report.csv', header + csv);

  console.log(`\n📁 Отчет сохранен в файл: excess-bonuses-report.csv`);
  console.log(
    `\n💡 Как списать вручную: Вы можете зайти в Панель -> Пользователи, найти их по номеру телефона/email и списать сумму из колонки "Излишек_К_Списанию".`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
