#!/usr/bin/env bash
# ============================================
# VPN Proxy Manager - Start Script
# ============================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}======================================"
echo "  VPN Proxy Manager"
echo -e "======================================${NC}"
echo ""

# Activate venv if exists
if [ -f "backend/venv/bin/activate" ]; then
    source backend/venv/bin/activate
elif [ -f "backend/venv/Scripts/activate" ]; then
    source backend/venv/Scripts/activate
fi

# Start Backend
echo -e "${GREEN}[Starting]${NC} Backend on http://localhost:5000"
cd "$SCRIPT_DIR/backend"
uvicorn app.main:app --reload --port 5000 &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

# Start Frontend
echo -e "${GREEN}[Starting]${NC} Frontend on http://localhost:5173"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}======================================"
echo "  Both servers are running!"
echo "======================================"
echo ""
echo -e "  Frontend:  ${BLUE}http://localhost:5173${NC}"
echo -e "  Backend:   ${BLUE}http://localhost:8000${NC}"
echo -e "  API Docs:  ${BLUE}http://localhost:8000/docs${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop both servers"
echo -e "======================================${NC}"

wait
