# SaaS Bonus System - PowerShell Deployment Script
# Usage: .\deploy.ps1 [local|docker]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("local", "docker")]
    [string]$Mode = "local"
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  SaaS Bonus System Deployment Tool  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host

# Functions
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
            Read-Host "Press enter to continue after editing .env.local"
        } else {
            Write-Error "env.example.txt not found"
        }
    } else {
        Write-Success ".env.local already exists"
    }
}

# Install dependencies
function Install-Dependencies {
    Write-Info "Installing dependencies..."
    yarn install
    Write-Success "Dependencies installed"
}

# Setup database
function Initialize-Database {
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

# Local deployment
function Start-LocalDeployment {
    Write-Info "Starting local deployment..."

    Test-Prerequisites
    Initialize-Environment
    Install-Dependencies
    Initialize-Database

    Write-Info "Starting development server..."
    Write-Success "Local deployment ready!"
    Write-Info "Access the application at: http://localhost:5006"

    yarn dev
}

# Docker deployment
function Start-DockerDeployment {
    Write-Info "Starting Docker deployment..."

    # Check Docker
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker is not installed"
    }

    if (!(Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        Write-Error "Docker Compose is not installed"
    }

    Initialize-Environment

    Write-Info "Building and starting containers..."
    docker-compose up -d --build

    Write-Info "Waiting for services to be ready..."
    Start-Sleep 10

    Write-Info "Running migrations..."
    docker-compose exec app yarn prisma:migrate

    Write-Success "Docker deployment complete!"
    Write-Info "Access the application at: http://localhost:5006"
    Write-Info "View logs: docker-compose logs -f"
}

# Main script
try {
    switch ($Mode) {
        "local" {
            Start-LocalDeployment
        }
        "docker" {
            Start-DockerDeployment
        }
        default {
            Write-Host "Usage: .\deploy.ps1 [local|docker]"
            Write-Host
            Write-Host "Options:"
            Write-Host "  local  - Deploy locally for development"
            Write-Host "  docker - Deploy using Docker Compose"
            exit 1
        }
    }
} catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
}
