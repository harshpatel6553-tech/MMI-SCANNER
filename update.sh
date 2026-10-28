#!/bin/bash
set -e

# Enter directory of this script
cd "$(dirname "$0")"

echo "=========================================="
echo "🚀 Updating MMI-SCANNER Production Server"
echo "=========================================="

echo "📥 1. Pulling latest code from GitHub..."
git pull origin main

echo "🔨 2. Building fresh Docker image..."
sudo docker build -t mmi-scanner .

echo "🛑 3. Stopping and removing old container..."
sudo docker stop mmi-scanner 2>/dev/null || true
sudo docker rm mmi-scanner 2>/dev/null || true

echo "▶️ 4. Starting updated container on port 5000..."
sudo docker run -d --name mmi-scanner --restart always -p 5000:5000 mmi-scanner

echo "🔍 5. Checking status of containers..."
sudo docker ps

echo "=========================================="
echo "✅ SUCCESS! Server is updated & live!"
echo "=========================================="
