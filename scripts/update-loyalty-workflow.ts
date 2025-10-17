/**
 * Скрипт для обновления workflow "Система лояльности" в БД
 * Удаляет старый workflow с flow.wait_contact и загружает новый
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Начинаем обновление workflow...\n');

    // Читаем новый шаблон
    const templatePath = path.join(process.cwd(), 'Система лояльности (шаблон) (2).json');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = JSON.parse(templateContent);

    console.log('✅ Шаблон загружен из файла');

    // Находим все проекты
    const projects = await prisma.project.findMany({
      select: { id: true, name: true }
    });

    console.log(`📋 Найдено проектов: ${projects.length}\n`);

    for (const project of projects) {
      console.log(`\n🔧 Обработка проекта: ${project.name} (${project.id})`);

      // Находим workflow "Система лояльности"
      const workflows = await prisma.workflow.findMany({
        where: {
          projectId: project.id,
          name: {
            contains: 'Система лояльности'
          }
        }
      });

      if (workflows.length === 0) {
        console.log('   ⏭️  Workflow не найден, пропускаем');
        continue;
      }

      for (const workflow of workflows) {
        console.log(`   📝 Обновляем workflow: ${workflow.name}`);

        // Проверяем, есть ли нода flow.wait_contact
        const nodes = workflow.nodes as any[];
        const hasWaitContact = nodes.some((node: any) => node.type === 'flow.wait_contact');

        if (!hasWaitContact) {
          console.log('   ✅ Workflow уже обновлён (нет flow.wait_contact)');
          continue;
        }

        // Обновляем workflow
        await prisma.workflow.update({
          where: { id: workflow.id },
          data: {
            nodes: template.nodes,
            connections: template.connections
          }
        });

        console.log('   ✅ Workflow обновлён успешно');

        // Деактивируем старые версии
        await prisma.workflowVersion.updateMany({
          where: { workflowId: workflow.id },
          data: { isActive: false }
        });

        console.log('   ✅ Старые версии деактивированы');
      }
    }

    console.log('\n✅ Все workflow обновлены!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

