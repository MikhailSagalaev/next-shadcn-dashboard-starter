/**
 * @file: scripts/check-project-ownership.ts
 * @description: Скрипт для проверки владельцев проектов
 * @project: SaaS Bonus System
 * @created: 2026-01-11
 * @author: AI Assistant
 */

import { db } from '../src/lib/db';

async function checkProjectOwnership() {
  try {
    console.log('🔍 Проверка владельцев проектов...\n');

    // Получаем всех админов
    const admins = await db.adminAccount.findMany({
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    console.log(`📊 Всего администраторов: ${admins.length}\n`);

    // Для каждого админа показываем его проекты
    for (const admin of admins) {
      const projects = await db.project.findMany({
        where: { ownerId: admin.id },
        select: {
          id: true,
          name: true,
          domain: true,
          isActive: true
        }
      });

      console.log(`👤 ${admin.email} (${admin.role})`);
      console.log(`   ID: ${admin.id}`);

      if (projects.length === 0) {
        console.log('   ❌ Нет проектов\n');
      } else {
        console.log(`   ✅ Проектов: ${projects.length}`);
        projects.forEach((project) => {
          const status = project.isActive ? '🟢' : '🔴';
          console.log(`      ${status} ${project.name} (${project.domain})`);
          console.log(`         ID: ${project.id}`);
        });
        console.log('');
      }
    }

    // Проверяем проекты без владельца
    const orphanProjects = await db.project.findMany({
      where: { ownerId: null },
      select: {
        id: true,
        name: true,
        domain: true
      }
    });

    if (orphanProjects.length > 0) {
      console.log(`\n⚠️  Проекты без владельца: ${orphanProjects.length}`);
      orphanProjects.forEach((project) => {
        console.log(`   - ${project.name} (${project.domain})`);
        console.log(`     ID: ${project.id}`);
      });
    } else {
      console.log('\n✅ Все проекты имеют владельцев');
    }

    await db.$disconnect();
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await db.$disconnect();
    process.exit(1);
  }
}

checkProjectOwnership();
