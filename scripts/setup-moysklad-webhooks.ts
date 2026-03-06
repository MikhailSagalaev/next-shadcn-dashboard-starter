/**
 * @file: setup-moysklad-webhooks.ts
 * @description: Скрипт для автоматической настройки вебхуков МойСклад
 * @project: SaaS Bonus System
 * @created: 2026-03-06
 */

import { db } from '@/lib/db';
import { decrypt } from '@/lib/moysklad-direct/encryption';

const MOYSKLAD_API_URL = 'https://api.moysklad.ru/api/remap/1.2';

interface WebhookConfig {
  entityType: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  description: string;
}

const WEBHOOK_CONFIGS: WebhookConfig[] = [
  {
    entityType: 'bonustransaction',
    action: 'CREATE',
    description: 'Начисление бонусов'
  },
  {
    entityType: 'bonustransaction',
    action: 'UPDATE',
    description: 'Обновление бонусной операции'
  },
  {
    entityType: 'counterparty',
    action: 'CREATE',
    description: 'Создание контрагента'
  },
  {
    entityType: 'counterparty',
    action: 'UPDATE',
    description: 'Обновление контрагента'
  },
  {
    entityType: 'demand',
    action: 'CREATE',
    description: 'Новая продажа'
  }
];

async function createWebhook(
  apiToken: string,
  webhookUrl: string,
  config: WebhookConfig
) {
  const response = await fetch(`${MOYSKLAD_API_URL}/entity/webhook`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: webhookUrl,
      action: config.action,
      entityType: config.entityType
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create webhook: ${error}`);
  }

  return await response.json();
}

async function listWebhooks(apiToken: string) {
  const response = await fetch(`${MOYSKLAD_API_URL}/entity/webhook`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiToken}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list webhooks: ${error}`);
  }

  return await response.json();
}

async function deleteWebhook(apiToken: string, webhookId: string) {
  const response = await fetch(
    `${MOYSKLAD_API_URL}/entity/webhook/${webhookId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete webhook: ${error}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const projectId = args[1];

  if (!projectId) {
    console.error('❌ Project ID is required');
    console.log('\nUsage:');
    console.log(
      '  npx tsx scripts/setup-moysklad-webhooks.ts create <projectId>'
    );
    console.log(
      '  npx tsx scripts/setup-moysklad-webhooks.ts list <projectId>'
    );
    console.log(
      '  npx tsx scripts/setup-moysklad-webhooks.ts delete <projectId>'
    );
    process.exit(1);
  }

  // Найти интеграцию
  const integration = await db.moySkladDirectIntegration.findUnique({
    where: { projectId },
    include: { project: true }
  });

  if (!integration) {
    console.error(`❌ Integration not found for project: ${projectId}`);
    process.exit(1);
  }

  // Расшифровать токен
  const apiToken = decrypt(integration.apiToken);
  const webhookUrl = `https://gupil.ru/api/webhook/moysklad-direct/${projectId}`;

  console.log(`\n🔧 МойСклад Webhooks Manager`);
  console.log(`Project: ${integration.project.name}`);
  console.log(`Webhook URL: ${webhookUrl}\n`);

  try {
    switch (command) {
      case 'create': {
        console.log('📝 Creating webhooks...\n');

        for (const config of WEBHOOK_CONFIGS) {
          try {
            const result = await createWebhook(apiToken, webhookUrl, config);
            console.log(
              `✅ Created: ${config.entityType} (${config.action}) - ${config.description}`
            );
            console.log(`   ID: ${result.id}\n`);
          } catch (error) {
            console.error(
              `❌ Failed: ${config.entityType} (${config.action})`,
              error
            );
          }
        }

        console.log('\n✅ Webhooks setup complete!');
        break;
      }

      case 'list': {
        console.log('📋 Listing webhooks...\n');

        const result = await listWebhooks(apiToken);

        if (result.rows.length === 0) {
          console.log('No webhooks found');
        } else {
          result.rows.forEach((webhook: any) => {
            console.log(`ID: ${webhook.id}`);
            console.log(`  Type: ${webhook.entityType}`);
            console.log(`  Action: ${webhook.action}`);
            console.log(`  URL: ${webhook.url}`);
            console.log(`  Enabled: ${webhook.enabled}`);
            console.log('');
          });
        }

        console.log(`Total: ${result.rows.length} webhooks`);
        break;
      }

      case 'delete': {
        console.log('🗑️  Deleting webhooks...\n');

        const result = await listWebhooks(apiToken);

        if (result.rows.length === 0) {
          console.log('No webhooks to delete');
          break;
        }

        for (const webhook of result.rows) {
          if (webhook.url === webhookUrl) {
            try {
              await deleteWebhook(apiToken, webhook.id);
              console.log(
                `✅ Deleted: ${webhook.entityType} (${webhook.action})`
              );
            } catch (error) {
              console.error(`❌ Failed to delete: ${webhook.id}`, error);
            }
          }
        }

        console.log('\n✅ Cleanup complete!');
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('\nAvailable commands:');
        console.log('  create - Create webhooks');
        console.log('  list   - List existing webhooks');
        console.log('  delete - Delete webhooks for this project');
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }

  await db.$disconnect();
}

main();
