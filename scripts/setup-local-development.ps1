# Скрипт настройки локальной разработки для Windows PowerShell
# Запуск: .\scripts\setup-local-development.ps1

Write-Host "🏠 НАСТРОЙКА ЛОКАЛЬНОЙ РАЗРАБОТКИ" -ForegroundColor Green
Write-Host "=" * 50

# Устанавливаем переменные окружения для текущей сессии
$env:NODE_ENV = "development"
$env:NEXT_PUBLIC_APP_URL = "http://localhost:5006"
$env:APP_URL = "http://localhost:5006"

Write-Host "✅ Переменные окружения установлены:" -ForegroundColor Green
Write-Host "   NODE_ENV = $env:NODE_ENV"
Write-Host "   NEXT_PUBLIC_APP_URL = $env:NEXT_PUBLIC_APP_URL"
Write-Host "   APP_URL = $env:APP_URL"

# Проверяем процессы Node.js
Write-Host "`n🔍 ПРОВЕРКА ПРОЦЕССОВ NODE.JS:" -ForegroundColor Yellow
$nodeProcesses = Get-Process | Where-Object {$_.ProcessName -like "*node*"}
if ($nodeProcesses.Count -eq 0) {
    Write-Host "✅ Процессы Node.js не найдены" -ForegroundColor Green
} else {
    Write-Host "⚠️  Найдено процессов Node.js: $($nodeProcesses.Count)" -ForegroundColor Yellow
    $nodeProcesses | ForEach-Object {
        Write-Host "   PID: $($_.Id), Имя: $($_.ProcessName), Путь: $($_.Path)"
    }
}

# Проверяем порты
Write-Host "`n🌐 ПРОВЕРКА ПОРТОВ:" -ForegroundColor Yellow
$ports = @(3000, 5006, 8080)
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "   Порт $port: ЗАНЯТ" -ForegroundColor Red
    } else {
        Write-Host "   Порт $port: СВОБОДЕН" -ForegroundColor Green
    }
}

# Рекомендации
Write-Host "`n💡 РЕКОМЕНДАЦИИ:" -ForegroundColor Cyan
Write-Host "1. Для постоянной настройки добавьте в .env.local:"
Write-Host "   NODE_ENV=development"
Write-Host "   NEXT_PUBLIC_APP_URL=http://localhost:5006"
Write-Host ""
Write-Host "2. Для проверки бота запустите:"
Write-Host "   npx tsx scripts/check-local-development.ts <BOT_TOKEN>"
Write-Host ""
Write-Host "3. Для отладки состояния ботов:"
Write-Host "   npx tsx scripts/debug-bot-status.ts"

Write-Host "`n✅ Настройка завершена!" -ForegroundColor Green
Write-Host "Теперь можно запускать проект в режиме локальной разработки." -ForegroundColor Green
