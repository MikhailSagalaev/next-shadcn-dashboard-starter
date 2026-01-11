# Скрипт для исправления проблем с миграциями Prisma
# Использование: .\scripts\fix-migrations.ps1

Write-Host "🔧 Исправление проблем с миграциями Prisma..." -ForegroundColor Cyan

# Получаем DATABASE_URL из .env
$envFile = Get-Content .env
$databaseUrl = ($envFile | Select-String "DATABASE_URL=").ToString().Replace("DATABASE_URL=", "").Trim('"')

if (-not $databaseUrl) {
    Write-Host "❌ DATABASE_URL не найден в .env" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Проверяем статус миграций..." -ForegroundColor Yellow

# Пытаемся пометить неудавшуюся миграцию как откаченную
Write-Host "🔄 Помечаем неудавшуюся миграцию как откаченную..." -ForegroundColor Yellow

# SQL команда для исправления
$sql = @"
UPDATE "_prisma_migrations" 
SET rolled_back_at = NOW()
WHERE migration_name = '20251205_add_operation_mode' 
  AND finished_at IS NULL;
"@

# Выполняем через psql (если доступен)
try {
    # Извлекаем параметры подключения из DATABASE_URL
    if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
        $user = $matches[1]
        $password = $matches[2]
        $host = $matches[3]
        $port = $matches[4]
        $database = $matches[5]
        
        Write-Host "📝 Параметры подключения:" -ForegroundColor Gray
        Write-Host "   Host: $host" -ForegroundColor Gray
        Write-Host "   Port: $port" -ForegroundColor Gray
        Write-Host "   Database: $database" -ForegroundColor Gray
        Write-Host "   User: $user" -ForegroundColor Gray
        
        # Создаем временный файл с SQL
        $sql | Out-File -FilePath "temp_fix.sql" -Encoding UTF8
        
        # Выполняем SQL
        $env:PGPASSWORD = $password
        psql -h $host -p $port -U $user -d $database -f temp_fix.sql
        
        # Удаляем временный файл
        Remove-Item "temp_fix.sql" -ErrorAction SilentlyContinue
        
        Write-Host "✅ Миграция помечена как откаченная" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Не удалось распарсить DATABASE_URL" -ForegroundColor Yellow
        Write-Host "Выполните SQL вручную:" -ForegroundColor Yellow
        Write-Host $sql -ForegroundColor White
    }
} catch {
    Write-Host "⚠️  Ошибка выполнения SQL: $_" -ForegroundColor Yellow
    Write-Host "Выполните SQL вручную через psql или pgAdmin:" -ForegroundColor Yellow
    Write-Host $sql -ForegroundColor White
}

Write-Host "`n🔄 Пробуем применить миграции снова..." -ForegroundColor Cyan
npx prisma migrate deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Миграции успешно применены!" -ForegroundColor Green
    
    Write-Host "`n🔄 Генерируем Prisma Client..." -ForegroundColor Cyan
    npx prisma generate
    
    Write-Host "`n🔄 Перезапускаем PM2..." -ForegroundColor Cyan
    pm2 restart all
    
    Write-Host "`n✅ Готово! Проверьте логи:" -ForegroundColor Green
    Write-Host "   pm2 logs --lines 20" -ForegroundColor Gray
} else {
    Write-Host "❌ Ошибка применения миграций" -ForegroundColor Red
    Write-Host "Попробуйте выполнить SQL вручную из scripts/fix-failed-migration.sql" -ForegroundColor Yellow
}
