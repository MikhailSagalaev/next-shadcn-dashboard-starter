# Setup Local Development Environment
# Run: .\scripts\setup-local-dev.ps1

Write-Host "Setting up local development environment..." -ForegroundColor Green
Write-Host "=" * 50

# Set environment variables for current session
$env:NODE_ENV = "development"
$env:NEXT_PUBLIC_APP_URL = "http://localhost:5006"
$env:APP_URL = "http://localhost:5006"

Write-Host "Environment variables set:" -ForegroundColor Green
Write-Host "   NODE_ENV = $env:NODE_ENV"
Write-Host "   NEXT_PUBLIC_APP_URL = $env:NEXT_PUBLIC_APP_URL"
Write-Host "   APP_URL = $env:APP_URL"

# Check Node.js processes
Write-Host "`nChecking Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process | Where-Object {$_.ProcessName -like "*node*"}
if ($nodeProcesses.Count -eq 0) {
    Write-Host "No Node.js processes found" -ForegroundColor Green
} else {
    Write-Host "Found Node.js processes: $($nodeProcesses.Count)" -ForegroundColor Yellow
    $nodeProcesses | ForEach-Object {
        Write-Host "   PID: $($_.Id), Name: $($_.ProcessName)"
    }
}

# Check ports
Write-Host "`nChecking ports..." -ForegroundColor Yellow
$ports = @(3000, 5006, 8080)
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "   Port $port OCCUPIED" -ForegroundColor Red
    } else {
        Write-Host "   Port $port FREE" -ForegroundColor Green
    }
}

# Recommendations
Write-Host "`nRecommendations:" -ForegroundColor Cyan
Write-Host "1. For permanent setup, add to .env.local:"
Write-Host "   NODE_ENV=development"
Write-Host "   NEXT_PUBLIC_APP_URL=http://localhost:5006"
Write-Host ""
Write-Host "2. To check bot status:"
Write-Host "   npx tsx scripts/check-local-development.ts <BOT_TOKEN>"
Write-Host ""
Write-Host "3. To debug bot status:"
Write-Host "   npx tsx scripts/debug-bot-status.ts"

Write-Host "`nSetup completed!" -ForegroundColor Green
Write-Host "You can now run the project in local development mode." -ForegroundColor Green
