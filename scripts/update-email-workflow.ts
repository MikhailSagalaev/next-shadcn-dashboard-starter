/**
 * @file: scripts/update-email-workflow.ts
 * @description: Скрипт для обновления email-registration workflow из шаблона
 * @project: SaaS Bonus System
 * @created: 2025-12-04
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Обновление email-registration workflow...\n');

  // Читаем шаблон
  const templatePath = path.join(
    process.cwd(),
    'src/lib/workflow-templates/email-registration.json'
  );
  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const template = JSON.parse(templateContent);

  console.log('📄 Шаблон загружен:', template.name);
  console.log('   Версия:', template.version);
  console.log('   Нод:', template.nodes.length);
  console.log('   Connections:', template.connections.length);

  // Проверяем connections для request-email
  const requestEmailConnections = template.connections.filter(
    (c: any) => c.source === 'request-email' || c.target === 'request-email'
  );
  console.log('\n📊 Connections для request-email:');
  requestEmailConnections.forEach((c: any) => {
    console.log(`   ${c.id}: ${c.source} → ${c.target}`);
  });

  // Проверяем connections для wait-email-input
  const waitEmailConnections = template.connections.filter(
    (c: any) =>
      c.source === 'wait-email-input' || c.target === 'wait-email-input'
  );
  console.log('\n📊 Connections для wait-email-input:');
  waitEmailConnections.forEach((c: any) => {
    console.log(`   ${c.id}: ${c.source} → ${c.target}`);
  });

  // Проверяем connections для birthday
  const birthdayConnections = template.connections.filter(
    (c: any) => c.source.includes('birthday') || c.target.includes('birthday')
  );
  console.log('\n📊 Connections для birthday:');
  birthdayConnections.forEach((c: any) => {
    console.log(
      `   ${c.id}: ${c.source} → ${c.target} ${c.sourceHandle ? `(${c.sourceHandle})` : ''}`
    );
  });

  // Проверяем connections для phone
  const phoneConnections = template.connections.filter(
    (c: any) => c.source.includes('phone') || c.target.includes('phone')
  );
  console.log('\n📊 Connections для phone:');
  phoneConnections.forEach((c: any) => {
    console.log(
      `   ${c.id}: ${c.source} → ${c.target} ${c.sourceHandle ? `(${c.sourceHandle})` : ''}`
    );
  });

  // Находим все активные workflows
  const workflows = await prisma.workflow.findMany({
    where: {
      isActive: true
    },
    include: {
      versions: {
        where: { isActive: true }
      }
    }
  });

  console.log(`\n🔍 Найдено workflows: ${workflows.length}`);

  for (const workflow of workflows) {
    console.log(`\n📋 Workflow: ${workflow.name} (${workflow.id})`);
    console.log(`   Project: ${workflow.projectId}`);
    console.log(`   Active: ${workflow.isActive}`);
    console.log(`   Versions: ${workflow.versions.length}`);

    if (workflow.versions.length > 0) {
      const activeVersion = workflow.versions[0];
      console.log(`   Active version: ${activeVersion.version}`);

      // Обновляем connections в workflow
      console.log('\n   🔄 Обновляем connections...');

      await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          connections: template.connections
        }
      });

      // Обновляем nodes в активной версии
      console.log('   🔄 Обновляем nodes в активной версии...');

      await prisma.workflowVersion.update({
        where: { id: activeVersion.id },
        data: {
          nodes: template.nodes
        }
      });

      console.log('   ✅ Workflow обновлен!');
    }
  }

  // Очищаем кэш Redis
  console.log('\n🧹 Очистка кэша...');
  try {
    const { CacheService } = await import('../src/lib/redis');
    await CacheService.deletePattern('project:*:workflow:*');
    await CacheService.deletePattern('workflow:*');
    console.log('   ✅ Кэш очищен!');
  } catch (e) {
    console.log('   ⚠️ Не удалось очистить кэш Redis:', e);
  }

  console.log('\n✅ Готово!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
