# Dev Server Troubleshooting Guide

## The Zombie Process Problem

When running `npm run dev` in development, you may encounter issues where:
- The server hangs on restart
- Code changes don't take effect
- Port 5000 or 5001 is already in use
- Old server instances serve stale code

### Why This Happens

1. **Orphaned processes**: When stopping/restarting the dev server, Node.js processes sometimes don't fully terminate
2. **Multiple instances**: Each failed restart can leave behind another zombie process
3. **Port conflicts**: Old processes hold onto ports, preventing new servers from starting
4. **Stale code**: Old processes respond to requests instead of your updated server

This is a **local development issue only** - production deployments start fresh containers.

---

## Quick Fix

Run this command to kill all dev processes and restart cleanly:

```bash
pkill -9 -f "tsx" 2>/dev/null; pkill -9 -f "vite" 2>/dev/null; pkill -9 -f "node.*server" 2>/dev/null; fuser -k 5000/tcp 5001/tcp 2>/dev/null; sleep 2; npm run dev
```

---

## Step-by-Step Fix

### 1. Check what's using the ports

```bash
lsof -i :5000 -i :5001
```

This shows all processes using ports 5000 and 5001.

### 2. Kill processes by port

```bash
fuser -k 5000/tcp
fuser -k 5001/tcp
```

### 3. Kill all related Node processes

```bash
pkill -9 -f "tsx"
pkill -9 -f "vite"
pkill -9 -f "node.*server"
```

### 4. Verify ports are free

```bash
lsof -i :5000 -i :5001
# Should return nothing or "Ports are free"
```

### 5. Start fresh

```bash
npm run dev
```

---

## Prevention Tips

1. **Always use Ctrl+C** to stop the server gracefully before restarting
2. **Don't close terminals** with running servers - stop the server first
3. **Check ports first** if the server seems slow to start
4. **Run the cleanup command** at the start of each dev session

---

## Symptoms Checklist

| Symptom | Likely Cause |
|---------|--------------|
| Server hangs on "Starting..." | Port already in use |
| Code changes not reflected | Old server instance responding |
| "EADDRINUSE" error | Multiple servers competing for port |
| Slow server startup | Waiting for port timeout |
| API returns old responses | Zombie process serving requests |

---

## Notes

- The `scripts/kill-port.sh` script runs automatically via `predev`, but may not catch all edge cases
- Production deployments are unaffected - this is purely a local dev issue
- When in doubt, run the quick fix command above
