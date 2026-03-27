#!/usr/bin/env bash
# ============================================
# VPN Proxy Manager - Setup Script
# ============================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================"
echo "  VPN Proxy Manager - Setup"
echo "======================================"
echo ""

# Check Python
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    echo "[ERROR] Python 3 is not installed."
    exit 1
fi

PY_VERSION=$($PYTHON --version 2>&1)
echo "[OK] Found $PY_VERSION"

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js is not installed."
    exit 1
fi
NODE_VERSION=$(node --version)
echo "[OK] Found Node.js $NODE_VERSION"

# Check npm
if ! command -v npm &>/dev/null; then
    echo "[ERROR] npm is not installed."
    exit 1
fi
NPM_VERSION=$(npm --version)
echo "[OK] Found npm $NPM_VERSION"

echo ""

# Setup Backend
echo "[1/3] Setting up backend..."
cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
    echo "  Creating Python virtual environment..."
    $PYTHON -m venv venv
fi

echo "  Activating virtual environment..."
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

echo "  Installing Python dependencies..."
pip install -r requirements.txt --quiet

cd "$SCRIPT_DIR"

# Setup Frontend
echo "[2/3] Setting up frontend..."
cd "$SCRIPT_DIR/frontend"
echo "  Installing npm dependencies..."
npm install --silent

cd "$SCRIPT_DIR"

# Setup .env
echo "[3/3] Setting up environment..."
if [ ! -f ".env" ]; then
    SECRET=$(openssl rand -hex 32 2>/dev/null || $PYTHON -c "import secrets; print(secrets.token_hex(32))")
    cat > .env <<EOF
SECRET_KEY=$SECRET
DATABASE_URL=sqlite:///./data/vpnproxy.db
GLUETUN_IMAGE=qmcgaw/gluetun:latest
EOF
    echo "  Created .env with generated secret key"
else
    echo "  .env already exists, skipping"
fi

# Create data dir
mkdir -p data

echo ""
echo "======================================"
echo "  Setup complete!"
echo "======================================"
echo ""
echo "  Run './start.sh' to start the application"
echo "  Then open http://localhost:5173 in your browser"
echo ""
