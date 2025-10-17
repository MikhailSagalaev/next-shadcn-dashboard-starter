# =====================================================
# SaaS Bonus System - Dev Startup Script
# Usage: 
#   .\start.ps1          - запуск в dev режиме
#   .\start.ps1 dev      - запуск в dev режиме
#   .\start.ps1 build    - сборка проекта
#   .\start.ps1 clean    - очистка портов и кэша
# =====================================================

param(
    [string]$Mode = "dev"
)

$ErrorActionPreference = "Continue"

# Цвета для вывода
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Step { param($Message) Write-Host "`n🔹 $Message" -ForegroundColor Blue }

# =====================================================
# Функция очистки портов
# =====================================================
function Clear-Ports {
    Write-Step "Очистка портов..."
    
    $ports = @(3000, 3001, 5006)
    
    foreach ($port in $ports) {
        try {
            $connections = netstat -ano | Select-String ":$port " | Select-String "LISTENING"
            
            if ($connections) {
                Write-Info "Освобождаю порт $port..."
                
                $connections | ForEach-Object {
                    if ($_ -match '\s+(\d+)\s*$') {
                        $pid = $matches[1]
                        if ($pid -and $pid -ne "0") {
                            taskkill /F /PID $pid 2>$null | Out-Null
                        }
                    }
                }
                
                Write-Success "Порт $port освобождён"
            }
        }
        catch {
            # Игнорируем ошибки
        }
    }
    
    # Остановка всех Node процессов
    Write-Info "Остановка Node процессов..."
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 1
    Write-Success "Все порты очищены"
}

# =====================================================
# Функция проверки зависимостей
# =====================================================
function Check-Dependencies {
    Write-Step "Проверка зависимостей..."
    
    # Проверка Node.js
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js не установлен!"
        Write-Info "Установите Node.js: https://nodejs.org/"
        exit 1
    }
    
    $nodeVersion = node --version
    Write-Success "Node.js: $nodeVersion"
    
    # Проверка yarn
    if (!(Get-Command yarn -ErrorAction SilentlyContinue)) {
        Write-Warning "Yarn не найден, устанавливаю..."
        corepack enable
        corepack prepare yarn@stable --activate
    }
    
    $yarnVersion = yarn --version
    Write-Success "Yarn: v$yarnVersion"
    
    # Проверка node_modules
    if (!(Test-Path "node_modules")) {
        Write-Warning "node_modules не найден, устанавливаю зависимости..."
        yarn install
    } else {
        Write-Success "node_modules найден"
    }
}

# =====================================================
# Функция проверки .env
# =====================================================
function Check-Env {
    Write-Step "Проверка .env файлов..."
    
    if (!(Test-Path ".env.local")) {
        Write-Warning ".env.local не найден!"
        
        if (Test-Path "env.local.example") {
            Write-Info "Копирую env.local.example → .env.local"
            Copy-Item "env.local.example" ".env.local"
            Write-Warning "Пожалуйста, настройте .env.local перед запуском!"
            Write-Info "Открываю файл в блокноте..."
            notepad .env.local
            Read-Host "Нажмите Enter после настройки .env.local"
        }
        else {
            Write-Error "env.local.example не найден!"
            exit 1
        }
    }
    else {
        Write-Success ".env.local найден"
    }
}

# =====================================================
# Функция проверки БД
# =====================================================
function Check-Database {
    Write-Step "Проверка подключения к БД..."
    
    try {
        # PowerShell синтаксис для передачи данных в stdin
        $testQuery = "SELECT 1;"
        $result = $testQuery | npx prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "База данных доступна"
            return $true
        }
        else {
            throw "DB connection failed"
        }
    }
    catch {
        Write-Warning "Не удалось подключиться к БД"
        Write-Info "Убедитесь что PostgreSQL запущен и DATABASE_URL настроен в .env.local"
        
        $continue = Read-Host "Продолжить без проверки БД? (y/n)"
        return ($continue -eq "y")
    }
}

# =====================================================
# Главная логика
# =====================================================

Write-Host @"

╔═══════════════════════════════════════════════╗
║   🚀 SaaS Bonus System - Startup Script      ║
║   Режим: $Mode                                ║
╚═══════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

switch ($Mode.ToLower()) {
    "clean" {
        Write-Step "Режим очистки"
        Clear-Ports
        
        Write-Info "Очистка кэша..."
        Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "node_modules/.cache" -Recurse -Force -ErrorAction SilentlyContinue
        
        Write-Success "Очистка завершена!"
        exit 0
    }
    
    "build" {
        Write-Step "Режим сборки"
        Clear-Ports
        Check-Dependencies
        Check-Env
        
        Write-Step "Сборка проекта..."
        yarn build
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Сборка успешна!"
        }
        else {
            Write-Error "Ошибка сборки"
            exit 1
        }
        exit 0
    }
    
    "dev" {
        # Dev режим
        Clear-Ports
        Check-Dependencies
        Check-Env
        Check-Database
        
        Write-Step "Запуск dev сервера..."
        Write-Host ""
        Write-Info "Сервер будет доступен:"
        Write-Host "  → http://localhost:3000" -ForegroundColor Green
        Write-Host "  → http://localhost:5006 (если настроен)" -ForegroundColor Green
        Write-Host ""
        Write-Warning "Нажмите Ctrl+C для остановки"
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════" -ForegroundColor Gray
        Write-Host ""
        
        # Запуск с перенаправлением в файл и консоль
        yarn dev | Tee-Object -FilePath "dev.log" -Append
    }
    
    default {
        Write-Error "Неизвестный режим: $Mode"
        Write-Info "Доступные режимы:"
        Write-Host "  .\start.ps1 dev    - запуск в dev режиме (по умолчанию)"
        Write-Host "  .\start.ps1 build  - сборка проекта"
        Write-Host "  .\start.ps1 clean  - очистка портов и кэша"
        exit 1
    }
}
