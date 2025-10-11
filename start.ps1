# Quick start SaaS Bonus System in PowerShell
# Usage: .\start.ps1

Write-Host "Starting SaaS Bonus System..." -ForegroundColor Green

# Check if yarn is available
if (!(Get-Command yarn -ErrorAction SilentlyContinue)) {
    Write-Host "Installing yarn..." -ForegroundColor Yellow
    corepack enable
    corepack prepare yarn@stable --activate
}

# Install dependencies if needed
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    yarn install
}

# Check .env file
if (!(Test-Path ".env.local")) {
    Write-Host "Creating .env.local..." -ForegroundColor Yellow
    Copy-Item "env.example.txt" ".env.local"
    Write-Host "Please edit .env.local before starting!" -ForegroundColor Red
    Read-Host "Press Enter after editing .env.local"
}

# Start development server
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host "Application will be available at: http://localhost:5006" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host

yarn dev
