#!/bin/bash
# Быстрая диагностика Resend после деплоя

echo "🔍 Проверка Resend конфигурации..."
echo ""

# Проверка .env файла
if [ -f .env ]; then
  echo "✅ .env файл найден"
  RESEND_KEY=$(grep RESEND_API_KEY .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
  RESEND_EMAIL=$(grep RESEND_FROM_EMAIL .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
  
  if [ -n "$RESEND_KEY" ]; then
    echo "✅ RESEND_API_KEY найден в .env (${#RESEND_KEY} символов)"
    if [[ $RESEND_KEY == re_* ]]; then
      echo "   ✅ Формат ключа корректен (начинается с 're_')"
    else
      echo "   ❌ Формат ключа некорректен (должен начинаться с 're_')"
    fi
  else
    echo "❌ RESEND_API_KEY НЕ найден в .env"
  fi
  
  if [ -n "$RESEND_EMAIL" ]; then
    echo "✅ RESEND_FROM_EMAIL найден: $RESEND_EMAIL"
  else
    echo "⚠️  RESEND_FROM_EMAIL не найден в .env"
  fi
else
  echo "❌ .env файл не найден!"
fi

echo ""
echo "📋 Проверка PM2 переменных:"
if command -v pm2 &> /dev/null; then
  PM2_ENV=$(pm2 env 0 2>/dev/null | grep RESEND || echo "")
  if [ -n "$PM2_ENV" ]; then
    echo "✅ Resend переменные найдены в PM2:"
    echo "$PM2_ENV"
  else
    echo "❌ Resend переменные НЕ найдены в PM2!"
    echo "   Выполните: pm2 restart bonus-app --update-env"
  fi
else
  echo "⚠️  PM2 не установлен (проверка пропущена)"
fi

echo ""
echo "📝 Следующие шаги:"
echo "1. Если переменные не в PM2: pm2 restart bonus-app --update-env"
echo "2. Проверьте логи: pm2 logs bonus-app --lines 50 | grep -i resend"
echo "3. Отправьте тестовое письмо через /dashboard/settings"

