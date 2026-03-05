# InSales Webhook Setup Script для PowerShell
# Замените значения ниже на ваши реальные данные

$shopDomain = "avocadoshop.myinsales.ru"
$apiKey = "YOUR_API_KEY"  # Замените на ваш API Key
$apiPassword = "YOUR_API_PASSWORD"  # Замените на ваш API Password
$webhookUrl = "https://gupil.ru/api/insales/webhook/cmilhq0y600099e7uraiowrmt"

# Создаем Basic Auth заголовок
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${apiKey}:${apiPassword}"))

# Webhook для orders/create
$body1 = @{
    webhook = @{
        address = $webhookUrl
        topic = "orders/create"
        format_type = "json"
    }
} | ConvertTo-Json

Write-Host "Создаем webhook для orders/create..." -ForegroundColor Yellow

try {
    $response1 = Invoke-RestMethod -Uri "https://$shopDomain/admin/webhooks.json" `
        -Method Post `
        -Headers @{
            "Authorization" = "Basic $base64AuthInfo"
            "Content-Type" = "application/json"
        } `
        -Body $body1
    
    Write-Host "✅ Webhook orders/create создан успешно!" -ForegroundColor Green
    Write-Host "ID: $($response1.webhook.id)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Ошибка при создании webhook orders/create:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Webhook для clients/create
$body2 = @{
    webhook = @{
        address = $webhookUrl
        topic = "clients/create"
        format_type = "json"
    }
} | ConvertTo-Json

Write-Host "`nСоздаем webhook для clients/create..." -ForegroundColor Yellow

try {
    $response2 = Invoke-RestMethod -Uri "https://$shopDomain/admin/webhooks.json" `
        -Method Post `
        -Headers @{
            "Authorization" = "Basic $base64AuthInfo"
            "Content-Type" = "application/json"
        } `
        -Body $body2
    
    Write-Host "✅ Webhook clients/create создан успешно!" -ForegroundColor Green
    Write-Host "ID: $($response2.webhook.id)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Ошибка при создании webhook clients/create:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Проверяем созданные webhooks
Write-Host "`nПроверяем созданные webhooks..." -ForegroundColor Yellow

try {
    $webhooks = Invoke-RestMethod -Uri "https://$shopDomain/admin/webhooks.json" `
        -Method Get `
        -Headers @{
            "Authorization" = "Basic $base64AuthInfo"
            "Content-Type" = "application/json"
        }
    
    Write-Host "✅ Список webhooks:" -ForegroundColor Green
    $webhooks.webhooks | ForEach-Object {
        Write-Host "  - ID: $($_.id) | Topic: $($_.topic) | URL: $($_.address)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Ошибка при получении списка webhooks:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n✅ Готово!" -ForegroundColor Green
