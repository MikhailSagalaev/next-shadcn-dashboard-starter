# 🎨 Полное руководство по интеграции с Tilda

## 📊 Схема работы интеграции

```mermaid
graph TB
    subgraph "Сайт на Tilda"
        A[Покупатель] -->|1. Оформляет заказ| B[Форма заказа Tilda]
        B -->|2. Заполняет данные| C[Корзина Tilda]
    end
    
    subgraph "Tilda Backend"
        C -->|3. POST запрос| D[Webhook URL]
        D -->|JSON данные| E[/api/webhook/{secret}]
    end
    
    subgraph "SaaS Bonus System"
        E -->|4. Валидация| F{Проверка secret}
        F -->|Valid| G[Парсинг данных Tilda]
        F -->|Invalid| H[❌ 401 Error]
        
        G -->|5. Обработка| I[Поиск/создание user]
        I -->|6. Расчет| J[Калькуляция бонусов]
        J -->|7. Начисление| K[(База данных)]
        
        K -->|8. Уведомление| L[Telegram Bot]
        K -->|9. Response| M[200 OK + данные]
    end
    
    subgraph "Результат"
        M -->|10. Подтверждение| N[Email покупателю]
        L -->|Сообщение| O[Telegram покупателя]
    end
```

## 🔧 Пошаговая настройка в Tilda

### Шаг 1: Получение Webhook Secret

1. Войдите в админ панель **SaaS Bonus System**
2. Перейдите в раздел **"Проекты"**
3. Создайте новый проект или выберите существующий
4. Скопируйте **Webhook Secret** из настроек проекта

```
Пример: clm8x9z0p0000qw8wg4k5h3j7
```

### Шаг 2: Настройка в Tilda

#### A. Добавление webhook сервиса

1. Откройте **Настройки сайта** в Tilda
2. Перейдите в раздел **"Формы"**
3. Нажмите **"Добавить новый сервис приема данных"**
4. Выберите **"Webhook"**
5. В поле **"WEBHOOK URL"** введите:
```
https://your-bonus-system.com/api/webhook/YOUR_WEBHOOK_SECRET
```

![Настройка webhook в Tilda](https://i.imgur.com/webhook-tilda.png)

#### B. Привязка к форме заказа

1. Откройте страницу с **корзиной/формой заказа**
2. Выберите блок корзины (обычно ST100, ST105, ST120)
3. Нажмите **"Контент"** в настройках блока
4. В разделе **"Прием данных"** отметьте галочкой ваш webhook
5. **Сохраните** и **опубликуйте** страницу

### Шаг 3: Настройка полей формы

Убедитесь, что в форме есть следующие поля:

| Поле в Tilda | Название переменной | Обязательное |
|--------------|-------------------|--------------|
| Email | email | ✅ Да |
| Имя | name | ❌ Нет |
| Телефон | phone | ❌ Нет |
| Комментарий | comment | ❌ Нет |

## 📦 Формат данных от Tilda

### Стандартный заказ из корзины:

```json
[{
  "Name": "Иван Иванов",
  "Email": "ivan@example.com",
  "Phone": "+79001234567",
  "Comments": "Доставка после 18:00",
  "payment": {
    "amount": "5000",
    "currency": "RUB",
    "orderid": "tilda_1234567890",
    "systranid": "payment_abc123",
    "products": [
      {
        "name": "Футболка красная",
        "quantity": "2",
        "amount": "3000",
        "price": "1500",
        "sku": "SKU001",
        "options": [
          {
            "option": "Размер",
            "variant": "XL"
          }
        ]
      },
      {
        "name": "Кепка",
        "quantity": "1",
        "amount": "2000",
        "price": "2000",
        "sku": "SKU002"
      }
    ]
  },
  "formid": "form123456789",
  "formname": "Cart",
  
  // UTM метки (если есть)
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "summer_sale",
  "utm_content": "banner_1",
  "utm_term": "купить футболку",
  
  // Дополнительные поля
  "COOKIES": "_ym_uid=123456789",
  "tranid": "1234567890:123456789",
  "Referer": "https://google.com",
  
  // Служебная информация
  "formservices": "[\"webhook\"]"
}]
```

### Простая форма регистрации:

```json
[{
  "Name": "Мария Петрова",
  "Email": "maria@example.com",
  "Phone": "+79009876543",
  "formid": "form987654321",
  "formname": "Registration"
}]
```

## 🔄 Как наша система обрабатывает данные Tilda

### 1. Определение типа данных

```typescript
// Система автоматически определяет, что это данные от Tilda
if (Array.isArray(body) && body[0]?.payment) {
  // Это заказ из корзины Tilda
  handleTildaOrder(body[0]);
} else if (Array.isArray(body)) {
  // Это обычная форма Tilda
  handleTildaForm(body[0]);
}
```

### 2. Обработка заказа

```typescript
async function handleTildaOrder(orderData) {
  // 1. Извлекаем данные
  const email = orderData.Email || orderData.email;
  const phone = orderData.Phone || orderData.phone;
  const name = orderData.Name || orderData.name;
  const amount = parseFloat(orderData.payment.amount);
  
  // 2. Находим или создаем пользователя
  let user = await findUserByContact(email, phone);
  if (!user) {
    user = await createUser({
      email,
      phone,
      firstName: name?.split(' ')[0],
      lastName: name?.split(' ')[1],
      utmSource: orderData.utm_source
    });
  }
  
  // 3. Рассчитываем бонусы
  const bonusPercent = calculateBonusPercent(user);
  const bonusAmount = amount * bonusPercent / 100;
  
  // 4. Начисляем бонусы
  await awardBonus(user.id, bonusAmount, {
    orderId: orderData.payment.orderid,
    products: orderData.payment.products
  });
  
  // 5. Отправляем уведомление
  await sendTelegramNotification(user, bonusAmount);
}
```

### 3. Расчет бонусов

| Уровень пользователя | Сумма покупок | % бонусов |
|---------------------|---------------|-----------|
| Базовый | 0 - 10,000₽ | 1% |
| Серебряный | 10,001 - 50,000₽ | 3% |
| Золотой | 50,001 - 100,000₽ | 5% |
| Платиновый | > 100,000₽ | 7% |

## 📝 Добавление кода на сайт Tilda

### Вариант 1: Отображение баланса бонусов

Добавьте в блок **T123** (HTML-код):

```html
<div id="bonus-widget">
  <div class="bonus-balance">
    <span>Ваши бонусы: </span>
    <span id="bonus-amount">Загрузка...</span>
  </div>
</div>

<script>
// Получение баланса по email
async function loadBonusBalance() {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) return;
  
  try {
    const response = await fetch('https://your-bonus-system.com/api/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail })
    });
    
    const data = await response.json();
    document.getElementById('bonus-amount').innerText = data.balance + ' ₽';
  } catch (error) {
    console.error('Error loading bonus balance:', error);
  }
}

// Сохраняем email при отправке формы
document.addEventListener('DOMContentLoaded', function() {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      const emailField = form.querySelector('input[name="Email"]');
      if (emailField) {
        localStorage.setItem('userEmail', emailField.value);
      }
    });
  });
  
  loadBonusBalance();
});
</script>

<style>
.bonus-balance {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px 25px;
  border-radius: 10px;
  font-size: 18px;
  font-weight: bold;
  display: inline-block;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}
</style>
```

### Вариант 2: Уведомление о начислении бонусов

Добавьте в **Настройки сайта** → **Еще** → **HTML-код для HEAD**:

```html
<script>
// Показываем уведомление после успешной покупки
if (window.location.href.includes('/order-success')) {
  // Получаем данные о последнем заказе
  const orderData = JSON.parse(localStorage.getItem('lastOrder') || '{}');
  
  if (orderData.amount) {
    const bonusAmount = Math.round(orderData.amount * 0.03); // 3% бонусов
    
    // Показываем красивое уведомление
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 9999;
        animation: slideIn 0.5s ease;
      ">
        <h3 style="margin: 0 0 10px 0;">🎉 Спасибо за покупку!</h3>
        <p style="margin: 0;">Вам начислено <strong>${bonusAmount} бонусов</strong></p>
        <p style="margin: 5px 0 0 0; font-size: 14px;">
          Используйте их при следующей покупке
        </p>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем через 10 секунд
    setTimeout(() => notification.remove(), 10000);
  }
}

// Сохраняем данные заказа при отправке
document.addEventListener('DOMContentLoaded', function() {
  const cartForm = document.querySelector('.t-form__inputsbox');
  if (cartForm) {
    cartForm.addEventListener('submit', function() {
      const amount = document.querySelector('.t706__cartwin-prodamount')?.innerText;
      if (amount) {
        localStorage.setItem('lastOrder', JSON.stringify({
          amount: parseFloat(amount.replace(/[^\d]/g, '')),
          date: new Date().toISOString()
        }));
      }
    });
  }
});
</script>

<style>
@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
```

## ✅ Тестирование интеграции

### 1. Тестовый заказ

1. Создайте тестовый товар в Tilda за 100₽
2. Оформите заказ с тестовыми данными:
   - Email: test@example.com
   - Имя: Тест Тестович
   - Телефон: +79001234567

3. Проверьте в админ панели:
   - Создался ли пользователь
   - Начислились ли бонусы
   - Пришло ли уведомление в Telegram

### 2. Проверка через консоль браузера

```javascript
// Откройте консоль (F12) на странице Tilda и выполните:
fetch('https://your-bonus-system.com/api/webhook/YOUR_SECRET', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{
    "Email": "test@example.com",
    "Name": "Test User",
    "payment": {
      "amount": "1000",
      "orderid": "test_order_001"
    }
  }])
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### 3. Логи и отладка

В админ панели SaaS Bonus System:
- **Webhook логи** - все входящие запросы
- **Транзакции** - все начисления бонусов
- **Пользователи** - созданные аккаунты

## 🐛 Частые проблемы и решения

### Проблема 1: Webhook не срабатывает

**Причины:**
- Не опубликована страница после настройки
- Неправильный URL webhook
- Блокировка firewall

**Решение:**
1. Проверьте URL в настройках Tilda
2. Опубликуйте страницу заново
3. Проверьте доступность URL через curl

### Проблема 2: Бонусы не начисляются

**Причины:**
- Неверный webhook secret
- Проект неактивен
- Ошибка в данных

**Решение:**
1. Проверьте webhook secret
2. Убедитесь, что проект активен
3. Проверьте логи в админ панели

### Проблема 3: Дублирование начислений

**Причины:**
- Tilda повторяет запросы при timeout
- Нет проверки на уникальность orderId

**Решение:**
- Система автоматически проверяет orderId
- Убедитесь, что ответ приходит за 5 секунд

## 📊 Статистика и аналитика

### Что можно отслеживать:

1. **Конверсия в бонусную программу**
   - Сколько покупателей зарегистрировалось
   - Средний чек с бонусами

2. **Эффективность уровней**
   - Распределение по уровням
   - Средние чеки по уровням

3. **UTM метки**
   - Какие каналы приводят лояльных клиентов
   - ROI бонусной программы

## 💰 Экономика интеграции

### Расчет выгоды:

| Показатель | Без бонусов | С бонусами | Рост |
|------------|-------------|------------|------|
| Средний чек | 3,000₽ | 3,900₽ | +30% |
| Повторные покупки | 15% | 45% | +200% |
| LTV клиента | 10,000₽ | 25,000₽ | +150% |
| Отток клиентов | 70% | 40% | -43% |

### ROI бонусной программы:

```
Затраты на бонусы: 3% от оборота = 300,000₽/мес
Дополнительная прибыль: 30% рост = 3,000,000₽/мес
ROI = (3,000,000 - 300,000) / 300,000 = 900%
```

## 🎯 Лучшие практики

### 1. Коммуникация с клиентами

- ✅ Показывайте баланс бонусов на сайте
- ✅ Отправляйте SMS/Email о начислениях
- ✅ Напоминайте об истекающих бонусах
- ✅ Делайте специальные акции для уровней

### 2. Настройка программы

- ✅ Начинайте с простых правил (1-3% кэшбэк)
- ✅ Добавляйте уровни постепенно
- ✅ Тестируйте разные проценты
- ✅ Анализируйте метрики еженедельно

### 3. Техническая сторона

- ✅ Используйте HTTPS для webhook
- ✅ Настройте мониторинг доступности
- ✅ Делайте backup данных
- ✅ Тестируйте на staging сначала

## 📞 Поддержка

### Контакты для помощи:

- **Техподдержка Tilda**: support@tilda.cc
- **Наша поддержка**: support@your-bonus-system.com
- **Telegram чат**: @bonus_system_support
- **Документация API**: /docs/api

### Полезные ссылки:

- [Официальная документация Tilda по Webhook](https://help-ru.tilda.cc/forms/webhook)
- [Примеры интеграций](https://github.com/your-bonus-system/examples)
- [Видео-туториал по настройке](https://youtube.com/watch?v=...)

---

*Последнее обновление: 28.01.2025*
*Версия: 1.2.0*