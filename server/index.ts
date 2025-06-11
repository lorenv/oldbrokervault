import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurity, securityHealthCheck } from "./security";

const app = express();

// Setup security first
setupSecurity(app);

// Important: Raw body parser for Stripe webhooks must come before JSON parser
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' })); // Increased for profile image uploads
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
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

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
      console.log("=== SERVER STARTUP ===");
      console.log("Environment:", process.env.NODE_ENV);
      console.log("Database URL set:", !!process.env.DATABASE_URL);
      console.log("Port:", port);
    });
  } catch (startupError) {
    console.error("=== STARTUP ERROR ===");
    console.error("Failed to start server:", startupError);
    console.error("Stack:", (startupError as Error).stack);
    process.exit(1);
  }
})();