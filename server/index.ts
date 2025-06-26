import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurity } from "./security";

const app = express();
const PORT = parseInt(process.env.PORT ?? "5000", 10);

// IMMEDIATE HEALTH CHECK ENDPOINTS - respond instantly without dependencies
// Root health check only in production to avoid overriding Vite dev server
if (process.env.NODE_ENV === 'production') {
  app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'CIM Share', timestamp: new Date().toISOString() });
  });
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Basic JSON parsing for health checks
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Start server IMMEDIATELY to respond to health checks
const server = app.listen(PORT, "0.0.0.0", () => {
  log(`Server running on http://0.0.0.0:${PORT}`);
  log('Health checks now responding immediately');
  
  // MOVE ALL HEAVY OPERATIONS HERE - after server is listening
  setTimeout(() => {
    try {
      log('Setting up security middleware...');
      setupSecurity(app);
      
      log('Registering API routes...');
      registerRoutes(app);
      
      // Error handling middleware - must be AFTER routes
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        log(`Error ${status}: ${message}`);
        res.status(status).json({ message });
      });
      
      log('API routes and security setup completed');
      
      // Setup Vite/static serving last
      if (app.get("env") === "development") {
        setupVite(app, server).catch(err => {
          log(`Vite setup error: ${err.message}`, 'vite');
        });
      } else {
        serveStatic(app);
      }
      
    } catch (error) {
      log(`Server setup error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 10); // Minimal delay to ensure server is fully listening
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('Process terminated');
  });
});