/**
 * @file: scripts/reset-admin-password.ts
 * @description: Скрипт для сброса пароля администратора
 * @project: SaaS Bonus System
 * @dependencies: Prisma, bcryptjs
 * @created: 2025-12-14
 * @author: AI Assistant + User
 */

import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function resetAdminPassword() {
  const email = process.argv[2] || 'admin@example.com';
  const newPassword = process.argv[3] || 'admin123';

  console.log('🔐 Сброс пароля администратора...\n');

  try {
    await db.$connect();
    console.log('✅ Подключение к БД установлено\n');

    // Ищем админа по email
    let admin = await db.adminAccount.findFirst({
      where: { email }
    });

    if (!admin) {
      // Если админа нет - создаем нового
      console.log(`⚠️  Админ с email ${email} не найден. Создаем нового...`);
      
      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      admin = await db.adminAccount.create({
        data: {
          email,
          passwordHash,
          role: 'SUPERADMIN',
          isActive: true
        }
      });
      
      console.log(`✅ Создан новый админ!`);
    } else {
      // Обновляем пароль существующего админа
      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      await db.adminAccount.update({
        where: { id: admin.id },
        data: { passwordHash }
      });
      
      console.log(`✅ Пароль обновлен для существующего админа!`);
    }

    console.log('\n========================================');
    console.log('📧 Email:    ', email);
    console.log('🔑 Password: ', newPassword);
    console.log('========================================\n');
    console.log('🌐 Войдите по адресу: http://localhost:3000/sign-in');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

resetAdminPassword();
