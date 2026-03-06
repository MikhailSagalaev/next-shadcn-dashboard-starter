# 🚀 InSales - Деплой СЕЙЧАС

**Commit:** 478d6c7  
**Что исправлено:** XML парсинг webhooks от InSales

---

## Команды для деплоя

```bash
# 1. Подключиться к серверу
ssh root@89.111.174.71

# 2. Перейти в проект
cd /opt/next-shadcn-dashboard-starter

# 3. Получить изменения
git pull

# 4. Сгенерировать Prisma Client
npx prisma generate

# 5. Перезапустить приложение
pm2 restart bonus-app

# 6. Проверить статус
pm2 status

# 7. Посмотреть логи
pm2 logs bonus-app --lines 50
```

---

## Проверка работы

1. **Создать тестовый заказ в InSales**
2. **Проверить логи:** https://gupil.ru/dashboard/projects/cmilhq0y600099e7uraiowrmt/integrations/insales
3. **Должен быть статус 200 OK**

---

## Что дальше

Передать разработчику InSales файл: **`INSALES_TASK_SHORT.md`**

Он должен:
1. Настроить 2 webhook (15 минут)
2. Вставить код виджета (5 минут)

**Всё!** 🎉
