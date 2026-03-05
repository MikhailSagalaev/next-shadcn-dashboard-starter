# InSales Integration - Быстрая настройка (5 минут)

## ⚡ Шаг 1: InSales API (2 мин)
1. Откройте `https://[ваш-магазин].myinsales.ru/admin`
2. **Настройки** → **API** → **Создать новый API ключ**
3. Сохраните **API Key** и **API Password**

## ⚡ Шаг 2: Gupil Dashboard (1 мин)
1. Откройте `https://gupil.ru/dashboard/projects/[id]/integrations/insales`
2. Заполните форму:
   - API Key: `[из шага 1]`
   - API Password: `[из шага 1]`
   - Shop Domain: `[ваш-магазин].myinsales.ru`
   - Процент бонусов: `10`
   - Максимум оплаты: `50`
3. Нажмите **"Активировать"**
4. Скопируйте **Webhook URL**

## ⚡ Шаг 3: InSales Webhooks (1 мин)
1. **Настройки** → **Webhooks** → **Добавить webhook**
2. Создайте 2 webhook:
   - **URL:** `[Webhook URL из шага 2]`
   - **Событие 1:** `orders/create`
   - **Событие 2:** `clients/create`

## ⚡ Шаг 4: Виджет (1 мин)
1. Скопируйте код виджета из Gupil
2. **Дизайн** → **Редактор тем** → `layout.liquid`
3. Вставьте код перед `</body>`
4. Сохраните

## ✅ Готово!
Создайте тестовый заказ и проверьте начисление бонусов.

---

**Полная инструкция:** `INSALES_SETUP_GUIDE.md`
