#!/bin/bash
# Kill any process using port 5000 or 5001
PORT=5000

# Find and kill Node processes
pkill -9 -f "tsx server/index.ts" 2>/dev/null || true
pkill -9 -f "node.*dist/index.js" 2>/dev/null || true
pkill -9 -f "node.*5000" 2>/dev/null || true
pkill -9 -f "node.*5001" 2>/dev/null || true

# Kill Python SDE processor that may be holding port 5000
pkill -9 -f "flask_api_example" 2>/dev/null || true
pkill -9 -f "sde.*analyzer" 2>/dev/null || true
pkill -9 -f "python.*5000" 2>/dev/null || true
pkill -9 -f "gunicorn.*5000" 2>/dev/null || true

# Also kill using fuser if available
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 5001/tcp 2>/dev/null || true

# Small delay to ensure cleanup
sleep 1

echo "Port cleanup completed"
