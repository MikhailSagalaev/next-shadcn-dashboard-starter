
# 📞 Webhook Integration Guide - Гайд по интеграции

Пошаговое руководство по интеграции SaaS Bonus System с различными платформами через Webhook API.

## 📋 Общие принципы

### 🎯 Что такое Webhook?
Webhook - это HTTP callback, который отправляется автоматически при определенных событиях на вашем сайте. В нашем случае это:
- Регистрация нового пользователя (автоматическое начисление приветственных бонусов)
- Совершение покупки
- Оплата бонусами

### 🎁 Приветственные бонусы
При регистрации нового пользователя через webhook **автоматически начисляются приветственные бонусы**, если они настроены в проекте:

**Настройка в админ панели:**
1. Перейдите в настройки проекта
2. Раздел "Приветственное вознаграждение при регистрации"
3. Выберите тип: "Бонусы" (фиксированная сумма) или "Скидка" (процент на первую покупку)
4. Укажите сумму приветственных бонусов (например, 500)

**Как это работает:**
- Пользователь регистрируется через webhook → автоматически создается в системе
- Если `welcomeRewardType = BONUS` и `welcomeBonus > 0` → начисляются приветственные бонусы
- Режим `WITH_BOT`: бонусы начислены, но доступны после активации в Telegram
- Режим `WITHOUT_BOT`: бонусы начислены и сразу доступны для использования

**Workflow НЕ требуется** - приветственные бонусы начисляются автоматически!

### 🔗 Endpoint структура
```
POST https://your-bonus-system.com/api/webhook/{webhookSecret}
```

Где `{webhookSecret}` - уникальный секрет вашего проекта из админ панели.

### 📦 Поддерживаемые форматы данных
Webhook endpoint поддерживает два формата:

1. **JSON** (`application/json`) - для кастомных интеграций
2. **Form Data** (`application/x-www-form-urlencoded`) - для Tilda и других платформ

**Важно для Tilda:** Tilda отправляет данные в формате `application/x-www-form-urlencoded`, где поле `payment` передается как JSON-строка.

### ⚙️ Режимы работы проекта (operationMode)
- `WITH_BOT` (по умолчанию): новые пользователи неактивны, для списания бонусов нужна активация через Telegram-бот. При попытке списания неактивным пользователем вернётся `403` с кодом `USER_NOT_ACTIVE`.
- `WITHOUT_BOT`: пользователи автоматически активируются при регистрации, списание бонусов не требует Telegram. Боты не инициализируются для таких проектов.
- Переключение режима доступно в настройках проекта; при переходе на `WITHOUT_BOT` активные боты останавливаются.

---

## 🚀 Быстрая настройка

### 1. Получение Webhook Secret
1. Войдите в админ панель SaaS Bonus System
2. Создайте новый проект или выберите существующий
3. Скопируйте webhook secret из настроек проекта

### 2. Базовая интеграция
```javascript
// Пример отправки webhook для регистрации пользователя
async function registerUser(userData) {
  const webhookSecret = 'YOUR_PROJECT_WEBHOOK_SECRET';
  
  const response = await fetch(`https://your-bonus-system.com/api/webhook/${webhookSecret}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      // Tilda формат - система автоматически определит это как регистрацию
      formid: 'registration_form',
      tranid: `${Date.now()}:${Math.random()}`
    })
  });
  
  const result = await response.json();
  
  // result.success === true
  // result.data.userId - ID созданного пользователя
  // result.data.earned - сумма начисленных приветственных бонусов
  
  return result;
}
```

**Важно:** При первой регистрации пользователя автоматически начисляются приветственные бонусы (если настроено в проекте).

---

## 🛒 Интеграция с интернет-магазинами

### 🏪 Tilda

#### Настройка формы регистрации:

1. **Создайте форму в Tilda** с полями:
   - Email (обязательно)
   - Имя
   - Фамилия
   - Телефон (опционально)

2. **Настройте webhook в Tilda**:
   - Перейдите в настройки формы
   - Добавьте webhook URL: `https://your-bonus-system.com/api/webhook/YOUR_SECRET`
   - Метод: POST

3. **Код обработки для Tilda**:
```javascript
// В настройках сайта Tilda добавьте код
<script>
$(document).ready(function() {
  // Перехватываем отправку формы
  $('form').on('submit', function(e) {
    const formData = new FormData(this);
    
    // Отправляем данные в бонусную систему
    fetch('https://your-bonus-system.com/api/webhook/YOUR_SECRET', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'register_user',
        email: formData.get('email'),
        firstName: formData.get('name'),
        phone: formData.get('phone')
      })
    }).then(response => response.json())
      .then(data => console.log('User registered:', data))
      .catch(error => console.error('Error:', error));
  });
});
</script>
```

#### Интеграция покупок:

```javascript
// После успешной оплаты в Tilda
function onPaymentSuccess(orderData) {
  fetch('https://your-bonus-system.com/api/webhook/YOUR_SECRET', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'purchase',
      userEmail: orderData.email,
      purchaseAmount: orderData.amount,
      orderId: orderData.orderid,
      description: orderData.products.map(p => p.name).join(', ')
    })
  }).then(response => response.json())
    .then(data => {
      if (data.success) {
        alert(`Вам начислено ${data.bonus.amount} бонусов!`);
      }
    });
}
```

### 🛍️ WooCommerce (WordPress)

#### Установка хука:

```php
// functions.php вашей темы WordPress

// Регистрация пользователя
add_action('user_register', 'send_user_to_bonus_system');
function send_user_to_bonus_system($user_id) {
    $user = get_userdata($user_id);
    
    $webhook_data = array(
        'action' => 'register_user',
        'email' => $user->user_email,
        'firstName' => $user->first_name,
        'lastName' => $user->last_name,
        'phone' => get_user_meta($user_id, 'billing_phone', true)
    );
    
    wp_remote_post('https://your-bonus-system.com/api/webhook/YOUR_SECRET', array(
        'headers' => array('Content-Type' => 'application/json'),
        'body' => json_encode($webhook_data),
        'timeout' => 30
    ));
}

// Начисление бонусов при покупке
add_action('woocommerce_order_status_completed', 'award_bonuses_on_purchase');
function award_bonuses_on_purchase($order_id) {
    $order = wc_get_order($order_id);
    
    $webhook_data = array(
        'action' => 'purchase',
        'userEmail' => $order->get_billing_email(),
        'purchaseAmount' => floatval($order->get_total()),
        'orderId' => strval($order_id),
        'description' => 'Заказ #' . $order_id
    );
    
    wp_remote_post('https://your-bonus-system.com/api/webhook/YOUR_SECRET', array(
        'headers' => array('Content-Type' => 'application/json'),
        'body' => json_encode($webhook_data),
        'timeout' => 30
    ));
}

// Списание бонусов при оплате
add_action('woocommerce_checkout_create_order', 'process_bonus_payment');
function process_bonus_payment($order, $data) {
    if (isset($_POST['use_bonuses']) && $_POST['bonus_amount'] > 0) {
        $bonus_amount = floatval($_POST['bonus_amount']);
        
        $webhook_data = array(
            'action' => 'spend_bonuses',
            'userEmail' => $data['billing_email'],
            'bonusAmount' => $bonus_amount,
            'orderId' => 'pending', // будет обновлен после создания заказа
            'description' => 'Оплата бонусами'
        );
        
        $response = wp_remote_post('https://your-bonus-system.com/api/webhook/YOUR_SECRET', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode($webhook_data),
            'timeout' => 30
        ));
        
        $result = json_decode(wp_remote_retrieve_body($response), true);
        
        if ($result['success']) {
            // Применяем скидку к заказу
            $order->add_fee('Оплата бонусами', -$bonus_amount);
        }
    }
}
```

### 🛒 Shopify

#### Создание webhook:

1. **В админ панели Shopify**:
   - Settings → Notifications
   - Webhooks section
   - Create webhook

2. **Настройки webhook**:
   - Event: Customer creation / Order paid
   - Format: JSON
   - URL: `https://your-bonus-system.com/api/webhook/YOUR_SECRET`

3. **Обработка в Shopify Plus (Flow)**:
```json
{
  "action": "register_user",
  "email": "{{ customer.email }}",
  "firstName": "{{ customer.first_name }}",
  "lastName": "{{ customer.last_name }}",
  "phone": "{{ customer.phone }}"
}
```

### 💻 Самописный сайт (PHP)

#### Регистрация пользователя:
```php
<?php
// register.php

if ($_POST['email']) {
    // Сохраняем пользователя в свою БД
    $user_id = saveUserToDatabase($_POST);
    
    // Отправляем в бонусную систему
    $webhook_data = [
        'action' => 'register_user',
        'email' => $_POST['email'],
        'firstName' => $_POST['first_name'],
        'lastName' => $_POST['last_name'],
        'phone' => $_POST['phone'],
        'birthDate' => $_POST['birth_date']
    ];
    
    $ch = curl_init('https://your-bonus-system.com/api/webhook/YOUR_SECRET');
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($webhook_data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $result = json_decode($response, true);
    
    if ($result['success']) {
        echo "Пользователь зарегистрирован и добавлен в бонусную программу!";
    }
    
    curl_close($ch);
}
?>
```

#### Обработка покупки:
```php
<?php
// process_payment.php

function processPurchase($order_data) {
    $webhook_data = [
        'action' => 'purchase',
        'userEmail' => $order_data['email'],
        'purchaseAmount' => $order_data['total'],
        'orderId' => $order_data['id'],
        'description' => 'Заказ товаров'
    ];
    
    $ch = curl_init('https://your-bonus-system.com/api/webhook/YOUR_SECRET');
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($webhook_data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $result = json_decode($response, true);
    
    return $result;
}

function spendBonuses($user_email, $bonus_amount, $order_id) {
    $webhook_data = [
        'action' => 'spend_bonuses',
        'userEmail' => $user_email,
        'bonusAmount' => $bonus_amount,
        'orderId' => $order_id,
        'description' => 'Оплата бонусами'
    ];
    
    $ch = curl_init('https://your-bonus-system.com/api/webhook/YOUR_SECRET');
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($webhook_data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    return json_decode($response, true);
}
?>
```

---

## 🎨 Frontend интеграция

### React/Next.js

```typescript
// utils/bonusApi.ts
export async function registerUser(userData: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}) {
  const response = await fetch('/api/register-bonus-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  
  return response.json();
}

// pages/api/register-bonus-user.ts (Next.js API route)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const webhookResponse = await fetch(`https://your-bonus-system.com/api/webhook/${process.env.WEBHOOK_SECRET}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_user',
          ...req.body
        })
      });
      
      const result = await webhookResponse.json();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to register user' });
    }
  }
}
```

### Vue.js

```javascript
// composables/useBonusSystem.js
export function useBonusSystem() {
  const registerUser = async (userData) => {
    try {
      const response = await $fetch('/api/bonus/register', {
        method: 'POST',
        body: userData
      });
      return response;
    } catch (error) {
      console.error('Failed to register user:', error);
      throw error;
    }
  };
  
  const processPurchase = async (purchaseData) => {
    try {
      const response = await $fetch('/api/bonus/purchase', {
        method: 'POST',
        body: purchaseData
      });
      return response;
    } catch (error) {
      console.error('Failed to process purchase:', error);
      throw error;
    }
  };
  
  return {
    registerUser,
    processPurchase
  };
}
```

---

## 🔧 Продвинутая настройка

### Обработка ошибок

```javascript
async function sendWebhookWithRetry(action, payload, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`https://your-bonus-system.com/api/webhook/${WEBHOOK_SECRET}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action,
          ...payload
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

### Валидация данных

```javascript
function validateWebhookData(action, payload) {
  const schemas = {
    register_user: {
      required: ['email'],
      optional: ['phone', 'firstName', 'lastName', 'birthDate']
    },
    purchase: {
      required: ['purchaseAmount', 'orderId'],
      optional: ['userEmail', 'userPhone', 'description']
    },
    spend_bonuses: {
      required: ['bonusAmount', 'orderId'],
      optional: ['userEmail', 'userPhone', 'description']
    }
  };
  
  const schema = schemas[action];
  if (!schema) {
    throw new Error(`Unknown action: ${action}`);
  }
  
  // Проверяем обязательные поля
  for (const field of schema.required) {
    if (!(field in payload) || payload[field] === null || payload[field] === undefined) {
      throw new Error(`Required field missing: ${field}`);
    }
  }
  
  // Проверяем email/phone для пользовательских действий
  if (['purchase', 'spend_bonuses'].includes(action)) {
    if (!payload.userEmail && !payload.userPhone) {
      throw new Error('Either userEmail or userPhone is required');
    }
  }
  
  return true;
}
```

### Логирование

```javascript
function logWebhookCall(action, payload, response, success = true) {
  const logData = {
    timestamp: new Date().toISOString(),
    action: action,
    payload: payload,
    response: response,
    success: success,
    userAgent: navigator.userAgent
  };
  
  // Отправляем в вашу систему логирования
  console.log('Webhook call:', logData);
  
  // Сохраняем в localStorage для отладки
  const logs = JSON.parse(localStorage.getItem('webhookLogs') || '[]');
  logs.push(logData);
  if (logs.length > 100) logs.shift(); // Ограничиваем количество логов
  localStorage.setItem('webhookLogs', JSON.stringify(logs));
}
```

---

## 🧪 Тестирование интеграции

### Postman коллекция

```json
{
  "info": {
    "name": "Bonus System Webhook API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Register User",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"action\": \"register_user\",\n  \"email\": \"test@example.com\",\n  \"firstName\": \"Тест\",\n  \"lastName\": \"Пользователь\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/webhook/{{webhookSecret}}",
          "host": ["{{baseUrl}}"],
          "path": ["api", "webhook", "{{webhookSecret}}"]
        }
      }
    }
  ]
}
```

### Тестовые сценарии

```bash
#!/bin/bash
# test_webhook.sh

WEBHOOK_SECRET="your_test_webhook_secret"
BASE_URL="https://your-bonus-system.com"

# Тест регистрации
echo "Testing user registration..."
curl -X POST "$BASE_URL/api/webhook/$WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "register_user",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }'

# Тест покупки
echo "Testing purchase..."
curl -X POST "$BASE_URL/api/webhook/$WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "purchase",
    "userEmail": "test@example.com",
    "purchaseAmount": 1000,
    "orderId": "TEST_ORDER_001"
  }'

# Тест списания
echo "Testing bonus spending..."
curl -X POST "$BASE_URL/api/webhook/$WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "spend_bonuses",
    "userEmail": "test@example.com",
    "bonusAmount": 50,
    "orderId": "TEST_ORDER_002"
  }'
```

---

## 🔒 Безопасность

### Рекомендации:
1. **Храните webhook secret в переменных окружения**
2. **Используйте HTTPS для всех запросов**
3. **Валидируйте данные перед отправкой**
4. **Логируйте все webhook вызовы для отладки**
5. **Настройте retry логику с экспоненциальным backoff**

### IP Whitelist
Для дополнительной безопасности можно ограничить доступ к webhook по IP адресам в настройках проекта.

---

## 📞 Поддержка

При возникновении проблем с интеграцией:
1. Проверьте логи webhook в админ панели
2. Убедитесь в корректности webhook secret
3. Проверьте формат отправляемых данных
4. Используйте тестовый режим для отладки

---

**Версия**: 1.0  
**Последнее обновление**: 2024-12-31 