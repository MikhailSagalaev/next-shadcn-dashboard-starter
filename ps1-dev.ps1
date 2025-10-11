# SaaS Bonus System - PowerShell Development Script
# Usage: .\ps1-dev.ps1

param(
    [switch]$SkipDeps,
    [switch]$SkipDb,
    [int]$Port = 5006
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  SaaS Bonus System - PowerShell Dev  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host

# Function to print colored output
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red; exit 1 }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "ℹ $Message" -ForegroundColor Blue }

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."

    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js: $nodeVersion"
    } catch {
        Write-Error "Node.js is not installed. Please install Node.js >= 18.0.0"
    }

    # Check yarn
    try {
        $yarnVersion = yarn --version
        Write-Success "Yarn: $yarnVersion"
    } catch {
        Write-Warning "Yarn not found. Installing via corepack..."
        corepack enable
        corepack prepare yarn@stable --activate
    }
}

# Setup environment
function Initialize-Environment {
    Write-Info "Setting up environment..."

    if (!(Test-Path ".env.local")) {
        if (Test-Path "env.example.txt") {
            Copy-Item "env.example.txt" ".env.local"
            Write-Warning "Created .env.local from env.example.txt"
            Write-Warning "Please edit .env.local with your configuration"
            Read-Host "Press Enter to continue after editing .env.local"
        } else {
            Write-Error "env.example.txt not found"
        }
    } else {
        Write-Success ".env.local already exists"
    }
}

# Install dependencies
function Install-Dependencies {
    if ($SkipDeps) {
        Write-Info "Skipping dependency installation..."
        return
    }

    Write-Info "Installing dependencies..."
    yarn install
    Write-Success "Dependencies installed"
}

# Setup database
function Initialize-Database {
    if ($SkipDb) {
        Write-Info "Skipping database setup..."
        return
    }

    Write-Info "Setting up database..."

    # Generate Prisma Client
    yarn prisma:generate

    # Run migrations
    yarn prisma:migrate

    # Optional: Seed database
    $seed = Read-Host "Do you want to seed the database with test data? (y/n)"
    if ($seed -eq 'y' -or $seed -eq 'Y') {
        yarn prisma:seed
    }

    Write-Success "Database setup complete"
}

# Main function
function Start-Development {
    Write-Info "Starting development server on port $Port..."

    Write-Success "Development environment ready!"
    Write-Info "Access the application at: http://localhost:$Port"
    Write-Info "Press Ctrl+C to stop the server"
    Write-Host

    # Start the development server
    yarn dev --port $Port
}

# Main script execution
try {
    Test-Prerequisites
    Initialize-Environment
    Install-Dependencies
    Initialize-Database
    Start-Development
} catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
}
