# 🚀 Быстрое решение: Hardcoded Workflow (1-2 часа)

## Если ты выбрал Вариант 1 из WORKFLOW_DECISION.md

Этот план позволит **запустить бота прямо сейчас** без сложного конструктора.

---

## 📋 План реализации (90 минут)

### Этап 1: Очистка (15 минут)

1. **Удалить SimpleWorkflowProcessor**:
   ```bash
   rm src/lib/services/simple-workflow-processor.ts
   ```

2. **Упростить bot.ts** - убрать всю логику workflow:
   - Удалить import SimpleWorkflowProcessor
   - Удалить WorkflowRuntimeService
   - Убрать middleware для workflow

3. **Сохранить только session middleware**

---

### Этап 2: Основной сценарий (45 минут)

Реализовать в `bot.ts`:

#### 1. Команда /start
```typescript
bot.command('start', async (ctx) => {
  const telegramId = ctx.from.id;
  
  // Проверяем привязку через БД
  const user = await db.user.findFirst({
    where: {
      telegramId: telegramId.toString(),
      projectId: projectId
    },
    include: {
      bonuses: {
        where: { expiresAt: { gte: new Date() } }
      }
    }
  });

  if (user) {
    // ЮЗЕРномер: Привязан
    const totalBalance = user.bonuses.reduce((sum, b) => sum + b.amount, 0);
    
    await ctx.reply(
      `🎉 Добро пожаловать, ${user.firstName || user.telegramUsername}!\n\n` +
      `💰 Ваш баланс: ${totalBalance}₽\n` +
      `🏆 Всего заработано: ${user.totalEarned || 0}₽\n` +
      `💸 Потрачено: ${user.totalSpent || 0}₽`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💰 Баланс', callback_data: 'balance' },
              { text: '🏆 Уровень', callback_data: 'level' }
            ],
            [
              { text: '👥 Рефералы', callback_data: 'referral' },
              { text: '📝 История', callback_data: 'history' }
            ],
            [
              { text: 'ℹ️ Помощь', callback_data: 'help' }
            ]
          ]
        }
      }
    );
  } else {
    // Пользователь НЕ привязан
    await ctx.reply(
      '👋 Добро пожаловать в бонусную программу!\n\n' +
      '📱 Для участия необходимо привязать аккаунт.\n\n' +
      'Выберите способ:',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📱 По телефону', callback_data: 'link_phone' },
              { text: '✉️ По email', callback_data: 'link_email' }
            ]
          ]
        }
      }
    );
  }
});
```

#### 2. Привязка по телефону
```typescript
bot.callbackQuery('link_phone', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '📱 Пожалуйста, поделитесь вашим номером телефона:',
    {
      reply_markup: {
        keyboard: [[
          { text: '📱 Поделиться номером', request_contact: true }
        ]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }
  );
});

bot.on(':contact', async (ctx) => {
  const phone = ctx.message.contact?.phone_number;
  if (!phone) return;

  // Ищем пользователя по телефону
  const user = await db.user.findFirst({
    where: {
      phone: phone,
      projectId: projectId
    }
  });

  if (user) {
    // Привязываем Telegram ID
    await db.user.update({
      where: { id: user.id },
      data: {
        telegramId: ctx.from.id.toString(),
        telegramUsername: ctx.from.username
      }
    });

    await ctx.reply(
      '✅ Аккаунт успешно привязан!\n\n' +
      `Добро пожаловать, ${user.firstName}!`,
      {
        reply_markup: { remove_keyboard: true }
      }
    );

    // Показываем главное меню
    // ... (код из /start для привязанного пользователя)
  } else {
    await ctx.reply(
      '❌ Аккаунт с таким номером не найден.\n\n' +
      'Пожалуйста, зарегистрируйтесь на нашем сайте сначала.',
      {
        reply_markup: { remove_keyboard: true }
      }
    );
  }
});
```

#### 3. Привязка по email
```typescript
bot.callbackQuery('link_email', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '✉️ Пожалуйста, отправьте ваш email:',
    {
      reply_markup: { remove_keyboard: true }
    }
  );
  
  // Сохраняем состояние в сессии
  ctx.session.awaitingEmail = true;
});

bot.on('message:text', async (ctx, next) => {
  if (ctx.session.awaitingEmail) {
    const email = ctx.message.text;
    
    // Простая валидация email
    if (!email.includes('@')) {
      await ctx.reply('❌ Некорректный email. Попробуйте еще раз.');
      return;
    }

    // Ищем пользователя по email
    const user = await db.user.findFirst({
      where: {
        email: email.toLowerCase(),
        projectId: projectId
      }
    });

    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: {
          telegramId: ctx.from.id.toString(),
          telegramUsername: ctx.from.username
        }
      });

      delete ctx.session.awaitingEmail;

      await ctx.reply(
        '✅ Аккаунт успешно привязан!\n\n' +
        `Добро пожаловать, ${user.firstName}!`
      );

      // Показываем главное меню
      // ...
    } else {
      delete ctx.session.awaitingEmail;
      await ctx.reply(
        '❌ Аккаунт с таким email не найден.\n\n' +
        'Пожалуйста, зарегистрируйтесь на нашем сайте сначала.'
      );
    }
  } else {
    await next(); // Передаем другим обработчикам
  }
});
```

---

### Этап 3: Callback handlers (20 минут)

```typescript
// Баланс
bot.callbackQuery('balance', async (ctx) => {
  const user = await db.user.findFirst({
    where: {
      telegramId: ctx.from.id.toString(),
      projectId: projectId
    },
    include: {
      bonuses: { where: { expiresAt: { gte: new Date() } } }
    }
  });

  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ Сначала привяжите аккаунт' });
    return;
  }

  const totalBalance = user.bonuses.reduce((sum, b) => sum + b.amount, 0);
  const expiringSoon = user.bonuses
    .filter(b => {
      const daysLeft = Math.floor((b.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 30;
    })
    .reduce((sum, b) => sum + b.amount, 0);

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `💰 Ваш баланс бонусов:\n\n` +
    `Доступно: ${totalBalance}₽\n` +
    `Истекает в течение 30 дней: ${expiringSoon}₽`
  );
});

// Уровень
bot.callbackQuery('level', async (ctx) => {
  const user = await db.user.findFirst({
    where: {
      telegramId: ctx.from.id.toString(),
      projectId: projectId
    },
    include: {
      level: true
    }
  });

  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ Сначала привяжите аккаунт' });
    return;
  }

  const level = user.level || { name: 'Базовый', bonusPercent: 5 };

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `🏆 Ваш уровень: ${level.name}\n\n` +
    `Процент начисления: ${level.bonusPercent}%\n` +
    `Всего заработано: ${user.totalEarned || 0}₽`
  );
});

// Рефералы
bot.callbackQuery('referral', async (ctx) => {
  const user = await db.user.findFirst({
    where: {
      telegramId: ctx.from.id.toString(),
      projectId: projectId
    },
    include: {
      referredUsers: true
    }
  });

  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ Сначала привяжите аккаунт' });
    return;
  }

  const referralCode = user.referralCode || 'Нет кода';
  const referralsCount = user.referredUsers?.length || 0;

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `👥 Реферальная программа\n\n` +
    `Ваш код: ${referralCode}\n` +
    `Приглашено друзей: ${referralsCount}\n\n` +
    `Делитесь кодом и получайте бонусы!`
  );
});

// История
bot.callbackQuery('history', async (ctx) => {
  const transactions = await db.transaction.findMany({
    where: {
      user: {
        telegramId: ctx.from.id.toString(),
        projectId: projectId
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  if (transactions.length === 0) {
    await ctx.answerCallbackQuery();
    await ctx.reply('📝 История пуста');
    return;
  }

  const history = transactions.map((t, i) => 
    `${i + 1}. ${t.type === 'earned' ? '+' : '-'}${t.amount}₽ - ${t.description}`
  ).join('\n');

  await ctx.answerCallbackQuery();
  await ctx.reply(`📝 Последние операции:\n\n${history}`);
});

// Помощь
bot.callbackQuery('help', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    'ℹ️ Помощь по боту\n\n' +
    '/start - Главное меню\n' +
    '/balance - Проверить баланс\n' +
    '/help - Эта справка\n\n' +
    'По вопросам: @support'
  );
});
```

---

### Этап 4: Тестирование (10 минут)

1. Перезапустить бота
2. Отправить /start в Telegram
3. Проверить все кнопки
4. Протестировать привязку по телефону
5. Протестировать привязку по email

---

## ✅ Результат

После этих изменений:
- ✅ Бот работает стабильно
- ✅ Все основные функции реализованы
- ✅ Код простой и понятный
- ✅ Легко добавлять новые команды
- ✅ Нет зависимости от сложного workflow constructor

---

## 🔄 Если потом захочешь вернуться к конструктору

Можно будет:
1. Постепенно мигрировать функции в workflow
2. Использовать hardcoded как fallback
3. Сохранить обратную совместимость

---

## 💡 Совет

**Запускай этот вариант сейчас!** Получай feedback от пользователей, а потом уже планируй конструктор если он действительно нужен.

**90% SaaS проектов начинают с hardcoded логики и только потом добавляют конструкторы.**


