/**
 * @file: scripts/test-workflow.ts
 * @description: Тестирование workflow с исправлениями
 * @project: SaaS Bonus System
 * @created: 2025-10-16
 * @author: AI Assistant + User
 */

import { db } from '@/lib/db';
import { SimpleWorkflowProcessor } from '@/lib/services/simple-workflow-processor';
import { initializeNodeHandlers } from '@/lib/services/workflow/handlers';

async function testWorkflow() {
  try {
    console.log('🔍 Тестируем workflow с исправлениями...\n');

    // Инициализируем handlers
    initializeNodeHandlers();

    // Получаем активную версию workflow
    const workflowVersion = await db.workflowVersion.findFirst({
      where: {
        workflow: {
          projectId: 'cmgntgsdv0000v8mwfwwh30az',
          isActive: true
        },
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!workflowVersion) {
      console.log('❌ Активная версия workflow не найдена');
      return;
    }

    console.log(`✅ Найдена версия workflow: ${workflowVersion.version}`);
    console.log(`  Workflow ID: ${workflowVersion.workflowId}`);
    console.log(`  Количество нод: ${Object.keys(workflowVersion.nodes).length}`);

    // Создаем процессор
    const processor = new SimpleWorkflowProcessor(workflowVersion, 'cmgntgsdv0000v8mwfwwh30az');

    // Тестируем сценарий для существующего пользователя
    console.log('\n🧪 Тестируем сценарий для существующего пользователя...');
    
    // Создаем мок контекст
    const mockContext = {
      from: { id: 524567338, username: 'MIXAdev' },
      chat: { id: 524567338 },
      message: { text: '/start' }
    };

    // Выполняем workflow
    const result = await processor.process(mockContext as any, 'start');
    
    console.log(`Результат выполнения: ${result ? '✅ Успешно' : '❌ Ошибка'}`);

  } catch (error) {
    console.error('❌ Ошибка при тестировании workflow:', error);
  } finally {
    await db.$disconnect();
  }
}

testWorkflow();
