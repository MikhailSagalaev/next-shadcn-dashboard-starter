/**
 * @file: scripts/test-api.ts
 * @description: Тестирование API эндпоинтов
 * @project: SaaS Bonus System
 * @dependencies: Node.js fetch
 * @created: 2024-12-31
 * @author: AI Assistant + User
 */

async function testAPI() {
  const baseUrl = 'http://localhost:5006'; // или https://gupil.ru если на сервере
  const projectId = 'cmfa8oqx000019e372pk9547l';

  console.log(`🔍 Тестируем API: ${baseUrl}`);
  console.log(`🏢 Проект: ${projectId}`);

  try {
    // Тест 1: Проверка доступности API
    console.log('\n📡 Тест 1: Проверка доступности API');
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    console.log(
      `Здоровье API: ${healthResponse.status} ${healthResponse.statusText}`
    );

    // Тест 2: Попытка получить пользователей без авторизации
    console.log('\n👥 Тест 2: Получение пользователей (без авторизации)');
    const usersResponse = await fetch(
      `${baseUrl}/api/projects/${projectId}/users?page=1&limit=5`
    );
    console.log(
      `Пользователи API: ${usersResponse.status} ${usersResponse.statusText}`
    );

    if (usersResponse.status === 401) {
      console.log('❌ API требует авторизации - это нормально для админки');
    } else if (usersResponse.status === 200) {
      const data = await usersResponse.json();
      console.log(`✅ Получено пользователей: ${data.users?.length || 0}`);
      console.log(`📄 Всего страниц: ${data.totalPages || 'неизвестно'}`);
    } else {
      const errorText = await usersResponse.text();
      console.log(`❌ Ошибка API: ${errorText}`);
    }

    // Тест 3: Проверка проекта
    console.log('\n🏗️ Тест 3: Получение информации о проекте');
    const projectResponse = await fetch(`${baseUrl}/api/projects/${projectId}`);
    console.log(
      `Проект API: ${projectResponse.status} ${projectResponse.statusText}`
    );

    if (projectResponse.status === 200) {
      const projectData = await projectResponse.json();
      console.log(`✅ Проект найден: ${projectData.data?.name || 'Без имени'}`);
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования API:', error.message);
  }
}

testAPI();
