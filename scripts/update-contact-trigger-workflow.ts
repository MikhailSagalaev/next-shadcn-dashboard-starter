/**
 * @file: scripts/update-contact-trigger-workflow.ts
 * @description: Скрипт для обновления workflow с поддержкой trigger.contact
 * @project: SaaS Bonus System
 * @created: 2025-12-05
 * @author: AI Assistant + User
 *
 * Запуск: npx ts-node scripts/update-contact-trigger-workflow.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Обновление workflow с поддержкой trigger.contact...\n');

  // Читаем обновлённый шаблон
  const templatePath = path.join(
    __dirname,
    '../src/lib/workflow-templates/email-registration.json'
  );
  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const template = JSON.parse(templateContent);

  console.log('📄 Загружен шаблон:', template.name);
  console.log('   Нод:', template.nodes.length);
  console.log('   Connections:', template.connections.length);

  // Находим все активные workflow с типом email-registration
  const workflows = await prisma.workflow.findMany({
    where: {
      isActive: true
    },
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  console.log(`\n📊 Найдено ${workflows.length} активных workflow\n`);

  let updated = 0;

  for (const workflow of workflows) {
    const activeVersion = workflow.versions[0];
    if (!activeVersion) {
      console.log(
        `⏭️ Workflow ${workflow.id} - нет активной версии, пропускаем`
      );
      continue;
    }

    // Проверяем, есть ли уже contact-trigger
    const nodes = activeVersion.nodes as any[];
    const hasContactTrigger = nodes.some(
      (n: any) => n.id === 'contact-trigger' || n.type === 'trigger.contact'
    );

    if (hasContactTrigger) {
      console.log(
        `✅ Workflow ${workflow.id} (${workflow.name}) - уже имеет contact-trigger`
      );
      continue;
    }

    // Проверяем, что это email-registration workflow (по наличию характерных нод)
    const hasEmailNodes = nodes.some(
      (n: any) =>
        n.id === 'request-email' ||
        n.id === 'check-email-user' ||
        n.id === 'wait-email-input'
    );

    if (!hasEmailNodes) {
      console.log(
        `⏭️ Workflow ${workflow.id} (${workflow.name}) - не email-registration, пропускаем`
      );
      continue;
    }

    console.log(`🔄 Обновляем workflow ${workflow.id} (${workflow.name})...`);

    // Добавляем новые ноды для contact
    const newNodes = [
      {
        id: 'contact-trigger',
        type: 'trigger.contact',
        data: {
          label: 'Получен контакт',
          config: { 'trigger.contact': {} }
        },
        position: { x: 0, y: 600 }
      },
      {
        id: 'check-contact-user',
        type: 'action.database_query',
        data: {
          label: 'Найти пользователя для контакта',
          config: {
            'action.database_query': {
              query: 'check_user_by_telegram',
              assignTo: 'contactUser',
              parameters: {
                projectId: '{{projectId}}',
                telegramId: '{{telegram.userId}}'
              }
            }
          }
        },
        position: { x: 406, y: 600 }
      },
      {
        id: 'check-contact-user-exists',
        type: 'condition',
        data: {
          label: 'Пользователь найден?',
          config: {
            condition: {
              operator: 'is_not_empty',
              variable: 'contactUser'
            }
          }
        },
        position: { x: 812, y: 600 }
      },
      {
        id: 'save-contact-phone',
        type: 'action.database_query',
        data: {
          label: 'Сохранить телефон из контакта',
          config: {
            'action.database_query': {
              query: 'update_user_contact',
              parameters: {
                telegramId: '{{telegram.userId}}',
                projectId: '{{projectId}}',
                phone: '{{telegram.contact.phoneNumber}}'
              }
            }
          }
        },
        position: { x: 1218, y: 500 }
      },
      {
        id: 'contact-saved-message',
        type: 'message',
        data: {
          label: 'Телефон сохранён',
          config: {
            message: {
              text: '✅ Номер телефона успешно сохранён!\n\n📱 Ваш телефон: {user.phone}\n\n💰 Баланс: {user.balanceFormatted}',
              keyboard: {
                type: 'inline',
                buttons: [
                  [{ text: '📋 Главное меню', callback_data: 'menu_main' }]
                ]
              }
            }
          }
        },
        position: { x: 1624, y: 500 }
      },
      {
        id: 'contact-user-not-found',
        type: 'message',
        data: {
          label: 'Пользователь не найден для контакта',
          config: {
            message: {
              text: '⚠️ Сначала необходимо зарегистрироваться.\n\nНажмите /start для начала регистрации.',
              keyboard: { type: 'remove' }
            }
          }
        },
        position: { x: 1218, y: 700 }
      }
    ];

    // Добавляем новые connections
    const newConnections = [
      {
        id: 'c-contact-1',
        source: 'contact-trigger',
        target: 'check-contact-user'
      },
      {
        id: 'c-contact-2',
        source: 'check-contact-user',
        target: 'check-contact-user-exists'
      },
      {
        id: 'c-contact-3',
        source: 'check-contact-user-exists',
        target: 'save-contact-phone',
        sourceHandle: 'true'
      },
      {
        id: 'c-contact-4',
        source: 'check-contact-user-exists',
        target: 'contact-user-not-found',
        sourceHandle: 'false'
      },
      {
        id: 'c-contact-5',
        source: 'save-contact-phone',
        target: 'contact-saved-message'
      }
    ];

    // Объединяем ноды
    const updatedNodes = [...nodes, ...newNodes];

    // Объединяем connections
    const existingConnections = (workflow.connections as any[]) || [];
    const updatedConnections = [...existingConnections, ...newConnections];

    // Обновляем версию workflow
    await prisma.workflowVersion.update({
      where: { id: activeVersion.id },
      data: {
        nodes: updatedNodes
      }
    });

    // Обновляем connections в workflow
    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        connections: updatedConnections
      }
    });

    console.log(
      `   ✅ Добавлено ${newNodes.length} нод и ${newConnections.length} connections`
    );
    updated++;
  }

  console.log(`\n✅ Обновлено ${updated} workflow`);
  console.log('\n⚠️ Не забудьте очистить кеш workflow:');
  console.log(
    '   curl -X POST http://localhost:5006/api/admin/clear-workflow-cache'
  );
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
