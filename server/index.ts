import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurity, securityHealthCheck } from "./security";
import { initializeImagePersistence } from "./image-persistence";
import { checkDatabaseHealth } from "./db-health";

const app = express();

// PRIMARY DEPLOYMENT HEALTH CHECK - Root path for deployment monitoring
// ALWAYS respond with 200 status for deployment health checks
app.get('/', (req, res) => {
  // Always respond with 200 status for deployment health checks
  res.status(200).json({ 
    status: 'ok',
    service: 'CIM Share',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    message: 'Server is healthy and ready to serve requests'
  });
});

// LIGHTWEIGHT HEALTH CHECK - No database operations, immediate response
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development'
  });
});

// DEPLOYMENT READINESS CHECK - Another endpoint for deployment monitoring
app.get('/ready', (req, res) => {
  res.status(200).json({ 
    status: 'ready',
    service: 'CIM Share',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// DATABASE HEALTH CHECK - Only use when explicitly needed, not for deployment
app.get('/api/health', async (req, res) => {
  try {
    const dbHealthy = await checkDatabaseHealth();
    res.status(200).json({ 
      status: dbHealthy ? 'ok' : 'degraded', 
      timestamp: new Date().toISOString(),
      service: 'CIM Share API',
      database: dbHealthy ? 'connected' : 'unavailable'
    });
  } catch (error) {
    res.status(200).json({ 
      status: 'degraded', 
      timestamp: new Date().toISOString(),
      service: 'CIM Share API',
      database: 'error'
    });
  }
});

// Setup security after health checks
setupSecurity(app);

// Important: Raw body parser for Stripe webhooks must come before JSON parser
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '100mb' })); // Increased for large file uploads
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

// Serve static files for logos and images
app.use('/logos', express.static('public/logos'));
app.use('/images', express.static('public/images'));
app.use(express.static('public'));

// Special handling for shared document routes - ensure they bypass any auth requirements
app.use('/share/*', (req, res, next) => {
  // Remove any auth headers that might interfere with public access
  delete req.headers.authorization;
  // Set public access headers
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('X-Robots-Tag', 'noindex'); // Prevent indexing of shared documents
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Security: Don't log sensitive data in production
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Only log response data in development and exclude sensitive endpoints
      if (process.env.NODE_ENV !== 'production' && 
          !path.includes('/login') && 
          !path.includes('/register') && 
          !path.includes('/user') &&
          capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Add security health check endpoint
app.get('/api/security/health', securityHealthCheck);

(async () => {
  try {
    // PRIORITY 1: Register routes first but don't start listening yet
    const server = await registerRoutes(app);

    // PRIORITY 2: Setup error handling
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      let message = err.message || "Internal Server Error";
      
      // Handle database connection errors gracefully
      if (err.message?.includes('Connection terminated unexpectedly') || 
          err.message?.includes('connection timeout') ||
          err.message?.includes('ECONNRESET')) {
        message = "Database temporarily unavailable. Please try again.";
        console.error("Database connection error:", err.message);
        return res.status(503).json({ 
          message, 
          error: "Service temporarily unavailable", 
          timestamp: new Date().toISOString(),
          retry: true
        });
      }
      
      console.error("=== GLOBAL ERROR HANDLER ===");
      console.error("Error:", err);
      console.error("Stack:", err.stack);
      console.error("Environment:", process.env.NODE_ENV);

      res.status(status).json({ 
        message,
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        timestamp: new Date().toISOString()
      });
    });

    // PRIORITY 3: Setup development/production specific configurations
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // PRIORITY 4: Start server listening IMMEDIATELY for deployment health checks
    const port = process.env.PORT || 5000;
    
    const startServer = (portToTry: number, retries = 3): Promise<void> => {
      return new Promise((resolve, reject) => {
        const attemptStart = () => {
          server.listen(portToTry, "0.0.0.0", () => {
            log(`serving on port ${portToTry}`);
            console.log("=== SERVER STARTUP ===");
            console.log("Environment:", process.env.NODE_ENV);
            console.log("Database URL set:", !!process.env.DATABASE_URL);
            console.log("Port:", portToTry);
            console.log('✅ Server listening - health checks now available');
            console.log('✅ Using Replit persistent storage - no image operations needed');
            
            resolve();
          });
        };

        server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE' && retries > 0) {
            console.log(`Port ${portToTry} in use, trying port ${portToTry + 1}...`);
            server.removeAllListeners('error');
            startServer(portToTry + 1, retries - 1).then(resolve).catch(reject);
          } else {
            console.error("=== SERVER ERROR ===");
            console.error("Failed to start server:", err);
            reject(err);
          }
        });

        attemptStart();
      });
    };

    await startServer(typeof port === 'string' ? parseInt(port) : port);
    
    // PRIORITY 5: Non-critical operations that happen after server is listening
    // Move route debugging to after server is listening
    if (process.env.NODE_ENV === 'development') {
      console.log('=== REGISTERED ROUTES DEBUG ===');
      app._router.stack.forEach((middleware: any, index: number) => {
        if (middleware.route) {
          console.log(`Route ${index}: ${middleware.route.stack[0].method.toUpperCase()} ${middleware.route.path}`);
        } else if (middleware.name === 'router') {
          console.log(`Router middleware ${index} with ${middleware.handle.stack?.length || 0} routes`);
          if (middleware.handle.stack) {
            middleware.handle.stack.forEach((route: any, routeIndex: number) => {
              if (route.route) {
                console.log(`  Sub-route ${routeIndex}: ${route.route.stack[0].method.toUpperCase()} ${route.route.path}`);
              }
            });
          }
        }
      });
      console.log('=== END ROUTES DEBUG ===');
    }
    
  } catch (startupError) {
    console.error("=== STARTUP ERROR ===");
    console.error("Failed to start server:", startupError);
    console.error("Stack:", (startupError as Error).stack);
    process.exit(1);
  }
})();