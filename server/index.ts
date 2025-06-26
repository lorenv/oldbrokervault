import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurity } from "./security";

const app = express();

// Health check endpoints for deployment - only root health check in production
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root health check only in production to avoid overriding Vite dev server
if (process.env.NODE_ENV === 'production') {
  app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'CIM Share', timestamp: new Date().toISOString() });
  });
}

// Start server FIRST to ensure health checks respond immediately
const PORT = parseInt(process.env.PORT ?? "5000", 10);

// Setup basic middleware BEFORE server starts
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Setup security and routes BEFORE server starts for deployment readiness
setupSecurity(app);
registerRoutes(app);

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Error ${status}: ${message}`);
  res.status(status).json({ message });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  log(`Server running on http://0.0.0.0:${PORT}`);
  log('API routes and security setup completed');
  
  // Setup Vite/static serving AFTER server is listening (non-critical for health checks)
  setTimeout(() => {
    try {
      if (app.get("env") === "development") {
        setupVite(app, server).catch(err => {
          log(`Vite setup error: ${err.message}`, 'vite');
        });
      } else {
        serveStatic(app);
      }
    } catch (error) {
      log(`Vite/Static setup error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 50); // Small delay to ensure server is fully listening
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('Process terminated');
  });
});