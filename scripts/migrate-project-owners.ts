/**
 * @file: scripts/migrate-project-owners.ts
 * @description: Скрипт миграции для привязки существующих проектов к владельцам (админам)
 * @project: SaaS Bonus System
 * @dependencies: Prisma
 * @created: 2024-11-01
 * @author: AI Assistant + User
 */

import { db } from '../src/lib/db';
import { logger } from '../src/lib/logger';

interface MigrationStats {
  totalProjects: number;
  migratedProjects: number;
  adminsCreated: number;
  errors: string[];
}

/**
 * Создает дефолтного админа если не существует ни одного
 */
async function ensureDefaultAdmin(email: string, password: string): Promise<string> {
  console.log('🔍 Проверяем существование администраторов...');
  
  const existingAdmin = await db.adminAccount.findFirst();
  
  if (existingAdmin) {
    console.log(`✅ Найден существующий админ: ${existingAdmin.email}`);
    return existingAdmin.id;
  }
  
  console.log('⚠️  Администраторы не найдены. Создаем дефолтного...');
  console.log('⚠️  ВАЖНО: Используйте данные ниже для первого входа!');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log('');
  
  // Хешируем пароль
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 10);
  
  const defaultAdmin = await db.adminAccount.create({
    data: {
      email,
      passwordHash,
      role: 'SUPERADMIN',
      isActive: true
    }
  });
  
  console.log(`✅ Создан дефолтный админ с ID: ${defaultAdmin.id}`);
  
  return defaultAdmin.id;
}

/**
 * Привязывает все проекты без владельца к указанному админу
 */
async function migrateProjectOwners(adminId: string): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalProjects: 0,
    migratedProjects: 0,
    adminsCreated: 0,
    errors: []
  };
  
  try {
    console.log('\n🚀 Начинаем миграцию владельцев проектов...\n');
    
    // Получаем все проекты без владельца
    const projectsWithoutOwner = await db.project.findMany({
      where: {
        ownerId: null
      },
      select: {
        id: true,
        name: true,
        ownerId: true
      }
    });
    
    stats.totalProjects = projectsWithoutOwner.length;
    console.log(`📊 Найдено проектов без владельца: ${stats.totalProjects}`);
    
    if (projectsWithoutOwner.length === 0) {
      console.log('✅ Все проекты уже имеют владельца. Миграция не требуется.');
      return stats;
    }
    
    // Привязываем каждый проект к админу
    for (const project of projectsWithoutOwner) {
      try {
        await db.project.update({
          where: { id: project.id },
          data: { ownerId: adminId }
        });
        
        stats.migratedProjects++;
        console.log(`✅ Привязан проект: ${project.name} (${project.id})`);
        
      } catch (error) {
        const errorMsg = `Ошибка привязки проекта ${project.name}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`;
        stats.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }
    
    console.log('\n🎉 Миграция завершена!');
    console.log('\n📈 Статистика миграции:');
    console.log(`   • Всего проектов обработано: ${stats.totalProjects}`);
    console.log(`   • Успешно привязано: ${stats.migratedProjects}`);
    console.log(`   • Ошибок: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\n⚠️  Ошибки:');
      stats.errors.forEach(err => console.log(`   • ${err}`));
    }
    
    return stats;
    
  } catch (error) {
    console.error('💥 Критическая ошибка миграции:', error);
    logger.error('Критическая ошибка миграции владельцев проектов', {
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      component: 'project-owners-migration'
    });
    throw error;
  }
}

/**
 * Проверка целостности данных после миграции
 */
async function validateMigration(): Promise<boolean> {
  console.log('\n🔍 Проверка целостности данных после миграции...\n');
  
  try {
    const projectsWithoutOwner = await db.project.count({
      where: {
        ownerId: null
      }
    });
    
    const totalProjects = await db.project.count();
    const totalAdmins = await db.adminAccount.count();
    
    console.log(`📊 Всего проектов: ${totalProjects}`);
    console.log(`📊 Проектов без владельца: ${projectsWithoutOwner}`);
    console.log(`📊 Всего администраторов: ${totalAdmins}`);
    
    const isValid = projectsWithoutOwner === 0 && totalAdmins > 0;
    
    if (isValid) {
      console.log('✅ Проверка целостности пройдена успешно!');
    } else {
      console.log('❌ Обнаружены проблемы с целостностью данных!');
      if (totalAdmins === 0) {
        console.log('   • Не найдено ни одного администратора');
      }
      if (projectsWithoutOwner > 0) {
        console.log(`   • Найдено ${projectsWithoutOwner} проектов без владельца`);
      }
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Ошибка проверки целостности:', error);
    return false;
  }
}

/**
 * Откат миграции - отвязывает все проекты от владельцев
 */
async function rollbackMigration(): Promise<void> {
  console.log('🔄 Запуск отката миграции...\n');
  console.log('⚠️  ВНИМАНИЕ: Это действие отвяжет ВСЕ проекты от их владельцев!');
  console.log('⚠️  Это может нарушить работу системы!\n');
  
  try {
    const result = await db.project.updateMany({
      where: {
        ownerId: { not: null }
      },
      data: {
        ownerId: null
      }
    });
    
    console.log(`✅ Откат завершен. Отвязано проектов: ${result.count}`);
  } catch (error) {
    console.error('❌ Ошибка отката:', error);
    throw error;
  }
}

/**
 * Главная функция
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const email = args[1] || 'admin@example.com';
  const password = args[2] || 'ChangeMe123!';
  
  try {
    await db.$connect();
    console.log('🔗 Подключение к базе данных установлено\n');
    
    switch (command) {
      case 'migrate':
        console.log('📝 Параметры миграции:');
        console.log(`   • Email: ${email}`);
        console.log(`   • Password: ${password}`);
        console.log('   • Примечание: Эти данные будут созданы только если админов нет\n');
        
        const adminId = await ensureDefaultAdmin(email, password);
        await migrateProjectOwners(adminId);
        await validateMigration();
        break;
        
      case 'rollback':
        await rollbackMigration();
        break;
        
      case 'validate':
        await validateMigration();
        break;
        
      case 'create-admin':
        const newAdminId = await ensureDefaultAdmin(email, password);
        console.log(`\n✅ Админ создан/найден с ID: ${newAdminId}`);
        break;
        
      default:
        console.log('🚀 Доступные команды:');
        console.log('   • migrate                - Привязать все проекты к админу');
        console.log('   • migrate <email> <pwd>  - Привязать с созданием админа');
        console.log('   • rollback               - Отвязать все проекты');
        console.log('   • validate               - Проверить целостность данных');
        console.log('   • create-admin <email> <pwd> - Создать нового админа');
        console.log('\nПримеры:');
        console.log('   npm run migrate-owners migrate');
        console.log('   npm run migrate-owners migrate admin@mycompany.com MyPass123!');
        console.log('   npm run migrate-owners create-admin admin@test.com Test123!');
        console.log('   npm run migrate-owners validate');
        break;
    }
  } catch (error) {
    console.error('💥 Ошибка выполнения:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
    console.log('\n🔌 Соединение с базой данных закрыто');
  }
}

// Запуск только если файл вызван напрямую
if (require.main === module) {
  main();
}

export { migrateProjectOwners, validateMigration, rollbackMigration, ensureDefaultAdmin };

