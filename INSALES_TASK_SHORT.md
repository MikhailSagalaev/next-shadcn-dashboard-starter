# Задача для разработчика InSales

## Что нужно сделать

### 1. Настроить 2 webhook в InSales

В админке InSales: **Расширения** → **Webhooks**

**Webhook #1:**
- URL: `https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt`
- Событие: `orders/create`
- Формат: JSON

**Webhook #2:**
- URL: `https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt`
- Событие: `clients/create`
- Формат: JSON

### 2. Встроить виджет в тему

Открыть **Дизайн** → **Редактор тем** → `layout.liquid`

Вставить перед `</body>`:

```html
<script 
  src="https://gupil.ru/insales-widget-loader.js" 
  data-project-id="cmilhq0y600099e7uraiowrmt"
></script>
```

## Проверка

1. Создать тестовый заказ - webhook должен сработать
2. Виджет должен появиться на сайте в правом нижнем углу

**Время:** 15-20 минут
