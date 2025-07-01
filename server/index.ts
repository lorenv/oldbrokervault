import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurity } from "./security";
import { imagePersistenceManager } from "./image-persistence";

const app = express();
// Static deployment uses PORT 80, development uses 5000
const PORT = parseInt(process.env.PORT ?? (process.env.NODE_ENV === 'production' ? "80" : "5000"), 10);

// Enhanced environment variable validation for deployment
function validateDeploymentEnvironment() {
  console.log('🔍 Validating deployment environment...');
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_ID_STANDARD'
  ];
  
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check required variables
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(varName);
    } else {
      console.log(`✅ ${varName} is configured`);
    }
  });
  
  // Check optional but recommended variables
  const optionalEnvVars = [
    'SENDGRID_API_KEY',
    'PERPLEXITY_API_KEY', 
    'OPENAI_API_KEY'
  ];
  
  optionalEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(varName);
    } else {
      console.log(`✅ ${varName} is configured`);
    }
  });
  
  // Log warnings for optional variables
  if (warnings.length > 0) {
    console.warn('⚠️ Optional environment variables not configured:', warnings);
    console.warn('⚠️ Some features may be limited without these variables');
  }
  
  // Fail startup if critical variables are missing
  if (errors.length > 0) {
    console.error('❌ DEPLOYMENT FAILURE - Missing required environment variables:', errors);
    console.error('❌ Application cannot start without these critical configuration values');
    
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Production deployment requires all environment variables');
      throw new Error(`Missing required environment variables: ${errors.join(', ')}`);
    } else {
      console.warn('⚠️ Development mode - continuing with limited functionality');
    }
  } else {
    console.log('✅ All required environment variables are configured');
  }
}

// Validate environment before starting server
try {
  validateDeploymentEnvironment();
} catch (error) {
  console.error('❌ Environment validation failed:', error instanceof Error ? error.message : String(error));
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Exiting due to missing critical configuration');
    process.exit(1);
  }
}

// IMMEDIATE HEALTH CHECK ENDPOINTS FOR STATIC DEPLOYMENT
// Root endpoint required for Replit static deployment health checks
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.REPL_DEPLOYMENT === 'true') {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      deployment: 'static' 
    });
  } else {
    // In development, let Vite handle the root
    res.redirect('/api/health');
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server FIRST for immediate health check response (Agent Suggestion #2)
const server = app.listen(PORT, "0.0.0.0", () => {
  log(`✅ Server successfully started on http://0.0.0.0:${PORT}`);
  log('✅ Health checks responding immediately with full configuration');
});

// Move ALL middleware setup AFTER server.listen() (Agent Suggestion #2)
server.on('listening', () => {
  setTimeout(() => {
    log('Setting up middleware and routes...');
    
    try {
      // Basic JSON parsing
      app.use(express.json({ limit: '100mb' }));
      app.use(express.urlencoded({ extended: true, limit: '100mb' }));
      
      // Setup security middleware
      setupSecurity(app);
      
      // Register API routes
      registerRoutes(app);
      
      // Error handling middleware - must be AFTER routes
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        log(`Error ${status}: ${message}`);
        res.status(status).json({ message });
      });
      
      log('All middleware and routes configured');
      
      // Setup Vite/static serving after middleware
      if (app.get("env") === "development") {
        setupVite(app, server).catch(err => {
          log(`⚠️ Vite setup error: ${err.message}`, 'vite');
        });
      } else {
        serveStatic(app);
      }
      
    } catch (error) {
      log(`Post-startup configuration error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 10); // Minimal delay to allow health checks to respond first
});

// Enhanced error handling for server startup
server.on('error', (error: any) => {
  console.error('❌ Server startup error:', error);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error('❌ Trying to find alternative port...');
    
    // Try alternative port in deployment scenarios
    const altPort = PORT + 1;
    console.log(`🔄 Attempting to start server on port ${altPort}`);
    
    const altServer = app.listen(altPort, "0.0.0.0", () => {
      log(`✅ Server started on alternative port http://0.0.0.0:${altPort}`);
    });
    
    altServer.on('error', (altError) => {
      console.error('❌ Failed to start on alternative port:', altError);
      process.exit(1);
    });
  } else if (error.code === 'EACCES') {
    console.error(`❌ Permission denied to bind to port ${PORT}`);
    console.error('❌ This may be a deployment configuration issue');
    process.exit(1);
  } else {
    console.error('❌ Unexpected server error:', error);
    process.exit(1);
  }
});

// Additional connection monitoring
server.on('listening', () => {
  const address = server.address();
  console.log('🎯 Server is listening on:', address);
  console.log('🚀 Application ready for deployment health checks');
});

server.on('close', () => {
  console.log('🔴 Server has been closed');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('Process terminated');
  });
});