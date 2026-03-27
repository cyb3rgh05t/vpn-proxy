# ============================================
# VPN Proxy Manager - Setup Script (PowerShell)
# ============================================
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  VPN Proxy Manager - Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "[ERROR] Python 3 is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
$pyVersion = & python --version 2>&1
Write-Host "[OK] Found $pyVersion" -ForegroundColor Green

# Check Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[ERROR] Node.js is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
$nodeVersion = & node --version
Write-Host "[OK] Found Node.js $nodeVersion" -ForegroundColor Green

# Check npm
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Host "[ERROR] npm is not installed or not in PATH." -ForegroundColor Red
    exit 1
}
$npmVersion = & npm --version
Write-Host "[OK] Found npm $npmVersion" -ForegroundColor Green

Write-Host ""

# Setup Backend
Write-Host "[1/3] Setting up backend..." -ForegroundColor Yellow
Set-Location "$ScriptDir\backend"

if (-not (Test-Path "venv")) {
    Write-Host "  Creating Python virtual environment..."
    & python -m venv venv
}

Write-Host "  Activating virtual environment..."
& "$ScriptDir\backend\venv\Scripts\Activate.ps1"

Write-Host "  Installing Python dependencies..."
& pip install -r requirements.txt --quiet

Set-Location $ScriptDir

# Setup Frontend
Write-Host "[2/3] Setting up frontend..." -ForegroundColor Yellow
Set-Location "$ScriptDir\frontend"
Write-Host "  Installing npm dependencies..."
& npm install --silent

Set-Location $ScriptDir

# Setup .env
Write-Host "[3/3] Setting up environment..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    $secret = & python -c "import secrets; print(secrets.token_hex(32))"
    @"
SECRET_KEY=$secret
DATABASE_URL=sqlite:///./data/vpnproxy.db
GLUETUN_IMAGE=qmcgaw/gluetun:latest
"@ | Set-Content -Path ".env" -Encoding UTF8
    Write-Host "  Created .env with generated secret key" -ForegroundColor Green
} else {
    Write-Host "  .env already exists, skipping" -ForegroundColor DarkGray
}

# Create data dir
if (-not (Test-Path "data")) { New-Item -ItemType Directory -Path "data" | Out-Null }

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Run '.\start.ps1' to start the application"
Write-Host "  Then open http://localhost:5173 in your browser"
Write-Host ""
