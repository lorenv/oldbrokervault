#!/bin/bash
# Kill any process using port 5000
PORT=5000

# Find and kill processes on the port
pkill -9 -f "tsx server/index.ts" 2>/dev/null || true
pkill -9 -f "node.*dist/index.js" 2>/dev/null || true

# Small delay to ensure cleanup
sleep 0.5

echo "Port cleanup completed"
