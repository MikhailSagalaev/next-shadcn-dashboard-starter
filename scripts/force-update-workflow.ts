/**
 * Скрипт для принудительного обновления workflow
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  try {
    const templatePath = path.join(process.cwd(), 'Система лояльности (шаблон) (2).json');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = JSON.parse(templateContent);

    const workflows = await prisma.workflow.findMany({
      where: {
        name: {
          contains: 'Система лояльности'
        }
      }
    });

    console.log(`Найдено workflow: ${workflows.length}`);

    for (const workflow of workflows) {
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          nodes: template.nodes,
          connections: template.connections
        }
      });
      
      console.log(`✅ Обновлён: ${workflow.name}`);
    }

    console.log('\n✅ Готово!');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

