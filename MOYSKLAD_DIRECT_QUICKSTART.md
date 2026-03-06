# ⚡ МойСклад Direct - Quick Start

## 🚀 3 команды для деплоя

```bash
ssh root@gupil.ru
cd /var/www/gupil && git pull && rm -rf .next && yarn build && pm2 restart bonus-app
pm2 logs bonus-app --lines 20
```

---

## 🔑 3 параметра для настройки

1. **API Token** → МойСклад: Настройки → Токены → Создать
2. **Account ID** → Ваш email: `a.churova@yandex.ru`
3. **Bonus Program ID** → UUID из URL: `#discount/edit?id=[UUID]`

---

## 🎯 3 шага для запуска

1. **Заполните форму** → `https://gupil.ru/dashboard/projects/[ID]/integrations/moysklad-direct`
2. **Нажмите "Тест"** → должно быть ✅
3. **Настройте Webhook** → МойСклад: Настройки → Вебхуки

---

## ✅ Готово за 10 минут!

**Подробные инструкции:**
- `QUICK_SETUP_CHECKLIST.md` - чеклист
- `SETUP_STEP_BY_STEP.md` - пошаговая инструкция

---

**Дата:** 2026-03-06
