#!/bin/bash
# LuckHub Startup Script

set -e

echo "╔═══════════════════════════════════════╗"
echo "║      🎰 LuckHub Casino Startup        ║"
echo "╚═══════════════════════════════════════╝"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Check/Install MongoDB
if ! command -v mongod &> /dev/null; then
  echo -e "${YELLOW}📦 MongoDB not found. Installing...${NC}"
  sudo apt-get update -q && sudo apt-get install -y mongodb
fi

# Step 2: Start MongoDB
echo -e "${GREEN}🗃️ Starting MongoDB...${NC}"
if ! pgrep mongod > /dev/null; then
  mkdir -p /tmp/luckhub-mongo
  mongod --dbpath /tmp/luckhub-mongo --logpath /tmp/luckhub-mongo.log --fork --quiet
  sleep 2
  echo -e "${GREEN}✅ MongoDB started${NC}"
else
  echo -e "${GREEN}✅ MongoDB already running${NC}"
fi

# Step 3: Start Backend
echo -e "${GREEN}🚀 Starting LuckHub Backend (port 5000)...${NC}"
cd /home/kali/Luckhub/backend
node server.js &
BACKEND_PID=$!
sleep 3

# Test backend
if curl -s http://localhost:5000/api/health > /dev/null; then
  echo -e "${GREEN}✅ Backend running at http://localhost:5000${NC}"
else
  echo -e "${RED}❌ Backend failed to start${NC}"
fi

# Step 4: Start Frontend
echo -e "${GREEN}🌐 Starting LuckHub Frontend (port 3000)...${NC}"
cd /home/kali/Luckhub/frontend
npm run dev &
FRONTEND_PID=$!
sleep 5

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║         🎰 LuckHub is RUNNING!                ║"
echo "║                                               ║"
echo "║  🌐 Main Site:   http://localhost:3000        ║"
echo "║  🛡️  Admin:       http://localhost:3000/admin ║"
echo "║  🔧 API:          http://localhost:5000/api   ║"
echo "║                                               ║"
echo "║  Admin Login:  admin@luckhub.com              ║"
echo "║  Password:     Admin@123456                   ║"
echo "║                                               ║"
echo "║  Press Ctrl+C to stop all servers             ║"
echo "╚═══════════════════════════════════════════════╝"

# Wait
wait
