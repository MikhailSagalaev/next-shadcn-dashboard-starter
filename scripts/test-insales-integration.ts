/**
 * @file: test-insales-integration.ts
 * @description: Скрипт для тестирования InSales интеграции
 * @project: SaaS Bonus System
 * @created: 2026-03-04
 */

import { db } from '@/lib/db';
import { InSalesService } from '@/lib/insales/insales-service';
import { logger } from '@/lib/logger';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>) {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    logger.info(`✅ ${name} (${duration}ms)`, {}, 'test-insales');
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage, duration });
    logger.error(
      `❌ ${name} (${duration}ms)`,
      { error: errorMessage },
      'test-insales'
    );
  }
}

async function main() {
  logger.info('🚀 Starting InSales Integration Tests', {}, 'test-insales');

  // Получаем тестовый проект
  const testProject = await db.project.findFirst({
    where: {
      name: { contains: 'test', mode: 'insensitive' }
    },
    include: {
      inSalesIntegration: true
    }
  });

  if (!testProject) {
    logger.error(
      '❌ Test project not found. Create a project with "test" in name',
      {},
      'test-insales'
    );
    process.exit(1);
  }

  logger.info(
    `📦 Using test project: ${testProject.name} (${testProject.id})`,
    {},
    'test-insales'
  );

  // Test 1: Проверка существования интеграции
  await runTest('Integration exists in database', async () => {
    if (!testProject.inSalesIntegration) {
      throw new Error('InSales integration not found for test project');
    }
    logger.debug(
      'Integration found',
      {
        isActive: testProject.inSalesIntegration.isActive,
        bonusPercentage: testProject.inSalesIntegration.bonusPercentage
      },
      'test-insales'
    );
  });

  if (!testProject.inSalesIntegration) {
    logger.error('❌ Cannot continue without integration', {}, 'test-insales');
    printResults();
    process.exit(1);
  }

  const integration = testProject.inSalesIntegration;
  const service = new InSalesService(testProject.id);

  // Test 2: Создание тестового пользователя
  let testUser: any;
  await runTest('Create test user via webhook', async () => {
    const clientData = {
      id: 999999,
      name: 'Test User InSales',
      email: `test-insales-${Date.now()}@example.com`,
      phone: '+79991234567',
      registered_date: new Date().toISOString()
    };

    testUser = await service.processClientCreated(clientData);

    if (!testUser) {
      throw new Error('User not created');
    }

    logger.debug(
      'User created',
      {
        userId: testUser.id,
        email: testUser.email
      },
      'test-insales'
    );
  });

  // Test 3: Проверка приветственных бонусов
  await runTest('Welcome bonus awarded', async () => {
    if (!testUser) {
      throw new Error('Test user not available');
    }

    const bonuses = await db.bonus.findMany({
      where: {
        userId: testUser.id,
        type: 'WELCOME'
      }
    });

    if (testProject.welcomeBonus > 0 && bonuses.length === 0) {
      throw new Error('Welcome bonus not awarded');
    }

    logger.debug(
      'Welcome bonuses checked',
      {
        count: bonuses.length,
        total: bonuses.reduce((sum, b) => sum + b.amount, 0)
      },
      'test-insales'
    );
  });

  // Test 4: Создание заказа и начисление бонусов
  let testOrder: any;
  await runTest('Process order and award bonuses', async () => {
    if (!testUser) {
      throw new Error('Test user not available');
    }

    const orderData = {
      id: 888888,
      client: {
        id: 999999,
        email: testUser.email
      },
      items_price: '5000.00',
      full_total_price: '5000.00',
      discount_amount: '0.00',
      created_at: new Date().toISOString()
    };

    testOrder = await service.processOrderCreated(orderData);

    if (!testOrder) {
      throw new Error('Order not processed');
    }

    // Проверяем начисление бонусов
    const expectedBonus = 5000 * (integration.bonusPercentage / 100);
    const transactions = await db.transaction.findMany({
      where: {
        userId: testUser.id,
        type: 'EARN',
        description: { contains: 'Заказ' }
      }
    });

    if (transactions.length === 0) {
      throw new Error('No bonus transaction created');
    }

    const actualBonus = transactions[0].amount;
    if (Math.abs(actualBonus - expectedBonus) > 0.01) {
      throw new Error(
        `Bonus amount mismatch: expected ${expectedBonus}, got ${actualBonus}`
      );
    }

    logger.debug(
      'Order processed',
      {
        orderId: testOrder.id,
        bonusAwarded: actualBonus
      },
      'test-insales'
    );
  });

  // Test 5: Проверка баланса
  await runTest('Check user balance', async () => {
    if (!testUser) {
      throw new Error('Test user not available');
    }

    const balance = await db.bonus.aggregate({
      where: {
        userId: testUser.id,
        expiresAt: { gt: new Date() }
      },
      _sum: { amount: true }
    });

    const totalBalance = balance._sum.amount || 0;

    if (totalBalance <= 0) {
      throw new Error('User balance is zero or negative');
    }

    logger.debug(
      'Balance checked',
      {
        balance: totalBalance
      },
      'test-insales'
    );
  });

  // Test 6: Применение промокода
  await runTest('Apply promo code', async () => {
    if (!testUser) {
      throw new Error('Test user not available');
    }

    const balance = await db.bonus.aggregate({
      where: {
        userId: testUser.id,
        expiresAt: { gt: new Date() }
      },
      _sum: { amount: true }
    });

    const totalBalance = balance._sum.amount || 0;
    const bonusToSpend = Math.min(100, totalBalance);
    const orderTotal = 2000;

    const result = await service.applyBonuses(
      testUser.email,
      bonusToSpend,
      orderTotal
    );

    if (!result.promoCode) {
      throw new Error('Promo code not generated');
    }

    if (result.discountAmount !== bonusToSpend) {
      throw new Error(
        `Discount mismatch: expected ${bonusToSpend}, got ${result.discountAmount}`
      );
    }

    logger.debug(
      'Promo code applied',
      {
        promoCode: result.promoCode,
        discount: result.discountAmount
      },
      'test-insales'
    );
  });

  // Test 7: Проверка максимального процента списания
  await runTest('Max bonus spend limit enforced', async () => {
    if (!testUser) {
      throw new Error('Test user not available');
    }

    const orderTotal = 1000;
    const maxAllowed = orderTotal * (integration.maxBonusSpend / 100);
    const attemptToSpend = maxAllowed + 100; // Пытаемся списать больше

    try {
      await service.applyBonuses(testUser.email, attemptToSpend, orderTotal);
      throw new Error('Should have thrown error for exceeding max spend');
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('превышает максимум')
      ) {
        logger.debug('Max spend limit correctly enforced', {}, 'test-insales');
      } else {
        throw error;
      }
    }
  });

  // Test 8: Webhook логирование
  await runTest('Webhook logs created', async () => {
    const logs = await db.inSalesWebhookLog.findMany({
      where: {
        projectId: testProject.id
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (logs.length === 0) {
      throw new Error('No webhook logs found');
    }

    logger.debug(
      'Webhook logs found',
      {
        count: logs.length
      },
      'test-insales'
    );
  });

  // Test 9: Статистика интеграции
  await runTest('Integration statistics', async () => {
    const stats = await db.inSalesWebhookLog.groupBy({
      by: ['status'],
      where: {
        projectId: testProject.id
      },
      _count: true
    });

    const totalRequests = stats.reduce((sum, s) => sum + s._count, 0);
    const successRequests =
      stats.find((s) => s.status === 'success')?._count || 0;
    const successRate =
      totalRequests > 0 ? (successRequests / totalRequests) * 100 : 0;

    logger.debug(
      'Statistics calculated',
      {
        totalRequests,
        successRequests,
        successRate: `${successRate.toFixed(2)}%`
      },
      'test-insales'
    );

    if (successRate < 50) {
      throw new Error(`Success rate too low: ${successRate.toFixed(2)}%`);
    }
  });

  // Cleanup: Удаляем тестовые данные
  await runTest('Cleanup test data', async () => {
    if (testUser) {
      // Удаляем транзакции
      await db.transaction.deleteMany({
        where: { userId: testUser.id }
      });

      // Удаляем бонусы
      await db.bonus.deleteMany({
        where: { userId: testUser.id }
      });

      // Удаляем пользователя
      await db.user.delete({
        where: { id: testUser.id }
      });

      logger.debug('Test data cleaned up', {}, 'test-insales');
    }
  });

  // Печатаем результаты
  printResults();
}

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.name}${duration}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('='.repeat(60));
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    logger.error('Test script failed', { error }, 'test-insales');
    console.error('❌ Test script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
