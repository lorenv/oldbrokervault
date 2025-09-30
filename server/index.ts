import express, { type Request, Response, NextFunction } from "express";
// DEFERRED IMPORTS: Delay heavy imports to prevent startup memory overflow
// import { registerRoutes } from "./routes"; // Moved to dynamic import
// import { setupVite, serveStatic, log } from "./vite"; // Moved to dynamic import  
// import { setupSecurity } from "./security"; // Moved to dynamic import
// import { imagePersistenceManager } from "./image-persistence"; // Not needed at startup
import path from "path";

// Initialize console override for structured logging
import "./console-override";

// Minimal logging function for startup
function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

const app = express();

// Use PORT environment variable for deployment flexibility
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

// Enhanced environment variable validation for deployment
function validateDeploymentEnvironment() {
  console.log('🔍 Validating deployment environment...');
  
  const coreRequiredEnvVars = [
    'DATABASE_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];
  
  const priceEnvVars = [
    'STRIPE_PRICE_ID_STANDARD'
  ];
  
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check core required variables
  coreRequiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(varName);
    } else {
      console.log(`✅ ${varName} is configured`);
    }
  });
  
  // Check price variables (required in production, optional in development)
  priceEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      if (process.env.NODE_ENV === 'production') {
        errors.push(varName);
      } else {
        warnings.push(varName);
      }
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

// HEALTH CHECK ENDPOINTS FOR IMMEDIATE DEPLOYMENT RESPONSE
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// MEMORY-EFFICIENT JSON PARSING (Fix #3: Add memory-efficient JSON handling)
// Reduce limits from 100mb to 50mb and implement streaming for large payloads
app.use(express.json({ 
  limit: '50mb',
  type: 'application/json',
  verify: (req: any, res, buf) => {
    // Memory monitoring for large payloads in production
    if (buf.length > 10 * 1024 * 1024 && process.env.NODE_ENV === 'development') { 
      console.log(`⚠️ Large JSON payload detected: ${(buf.length / 1024 / 1024).toFixed(2)}MB`);
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 1000
}));

// Security middleware will be setup after server starts to reduce memory usage

// Add debug middleware for API requests only (removed global middleware that may cause issues)
app.use('/api/*', (req, res, next) => {
  console.log(`🔍 API request received: ${req.method} ${req.originalUrl}`);
  console.log(`🔍 Content-Type: ${req.headers['content-type']}`);
  
  // Log large request sizes
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 1024 * 1024) {
    console.log(`⚠️ Large request: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`);
  }
  
  next();
});

// Setup all middleware BEFORE server starts to prevent race conditions
async function setupMiddleware() {
  try {
    // PRIORITY #1: Register routes immediately for API availability
    console.log('🔧 Registering API routes before server start...');
    const { registerRoutes } = await import('./routes');
    await registerRoutes(app);
    console.log('✅ API routes registered successfully - /api/register is now available');
    
    // Import and setup security middleware
    console.log('🔒 Setting up security middleware...');
    const { setupSecurity } = await import('./security');
    setupSecurity(app);
    
    // Setup static file serving
    if (process.env.NODE_ENV === "production") {
      console.log('📦 Setting up production static file serving...');
      const distPath = path.resolve(process.cwd(), "dist", "public");
      app.use(express.static(distPath));
      
      // Setup SEO routes FIRST in production for optimal crawling
      console.log('🔍 Setting up SEO routes for production...');
      const { setupSEORoutes } = await import('./seo-routes');
      setupSEORoutes(app);
      console.log('✅ SEO routes configured for production');
      
      // Add the catch-all route for production
      app.use("*", (req, res) => {
        if (req.originalUrl.startsWith('/api/')) {
          console.log(`🔍 API route not found: ${req.originalUrl}`);
          return res.status(404).json({ message: 'API endpoint not found' });
        }
        res.sendFile(path.resolve(distPath, "index.html"));
      });
      console.log('✅ Production static serving configured');
    } else {
      console.log('⚡ Setting up Vite middleware for development...');
      const publicPath = path.resolve(process.cwd(), "public");
      console.log('📁 Adding static file serving for development:', publicPath);
      app.use(express.static(publicPath));
      
      // Setup SEO routes FIRST in development before Vite middleware
      console.log('🔍 Setting up SEO routes for development...');
      const { setupSEORoutes } = await import('./seo-routes');
      setupSEORoutes(app);
      console.log('✅ SEO routes configured for development');
      
      // Create server placeholder for Vite
      const server = { on: () => {}, address: () => ({ port: PORT }) };
      const { setupVite } = await import('./vite');
      await setupVite(app, server as any);
      console.log('✅ Vite middleware configured');
    }
    
    log('✅ All middleware configured before server start');
  } catch (error) {
    console.error('❌ Error setting up middleware before startup:', error);
    throw error;
  }
}

// Error handling middleware - must be AFTER routes
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  // Log errors (memory details only in development)
  console.error(`Error ${status}: ${message}`);
  
  if (process.env.NODE_ENV === 'development') {
    const memUsage = process.memoryUsage();
    console.log(`Memory usage: RSS=${(memUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }
  
  res.status(status).json({ message });
});

// Setup middleware first, then start server
async function startServer() {
  await setupMiddleware();
  
  console.log(`🚀 Starting server on ${HOST}:${PORT}...`);
  
  const server = app.listen(PORT, HOST, () => {
    log(`✅ Server successfully started on ${HOST}:${PORT}`);
    log('✅ Health checks responding immediately');
    console.log('🎯 Server is listening on:', server.address());
    console.log('🚀 Application ready for deployment health checks');
  });
  
  return server;
}

// Start the server and handle errors
startServer().then(async (server) => {
  console.log('✅ Server startup completed successfully');
  
  // Initialize onboarding email system
  try {
    const { onboardingEmailSystem } = await import('./onboarding-email-system');
    await onboardingEmailSystem.scheduleEmailProcessing();
    console.log('📧 Onboarding email system initialized and processing started');
  } catch (emailError) {
    console.error('❌ Failed to initialize onboarding email system:', emailError);
    // Don't fail server startup if email system fails
  }

  // Initialize daily signup summary system
  try {
    const { dailySignupSummary } = await import('./daily-signup-summary');
    await dailySignupSummary.scheduleDaily();
    console.log('📊 Daily signup summary system initialized and scheduled');
  } catch (summaryError) {
    console.error('❌ Failed to initialize daily signup summary system:', summaryError);
    // Don't fail server startup if summary system fails
  }
  
  // Enhanced error handling for server startup
  server.on('error', (error: any) => {
    console.error('❌ Server startup error:', error);
    
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
      console.error('❌ For deployment, the configured port must be available');
      console.error('❌ Please ensure no other services are using this port');
      process.exit(1);
    } else if (error.code === 'EACCES') {
      console.error(`❌ Permission denied to bind to port ${PORT}`);
      console.error('❌ This may be a deployment configuration issue');
      process.exit(1);
    } else {
      console.error('❌ Unexpected server error:', error);
      process.exit(1);
    }
  });
  
  // Graceful shutdown with memory cleanup
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down gracefully');
    clearInterval(memoryInterval);
    
    server.close(() => {
      log('Process terminated');
      
      // Force garbage collection if available
      if (global.gc) {
        console.log('🧹 Running garbage collection...');
        global.gc();
      }
      
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    log('SIGINT received, shutting down gracefully');
    clearInterval(memoryInterval);
    
    server.close(() => {
      log('Process terminated');
      
      // Force garbage collection if available
      if (global.gc) {
        console.log('🧹 Running garbage collection...');
        global.gc();
      }
      
      process.exit(0);
    });
  });

  server.on('close', () => {
    console.log('🔴 Server has been closed');
    clearInterval(memoryInterval);
  });
  
}).catch(error => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});

// Memory monitoring for deployment
const memoryInterval = setInterval(() => {
  const memUsage = process.memoryUsage();
  const rssGB = memUsage.rss / 1024 / 1024 / 1024;
  const heapGB = memUsage.heapUsed / 1024 / 1024 / 1024;
  
  // Log memory usage every 5 minutes in production, warn if approaching limits
  if (process.env.NODE_ENV === 'production') {
    if (rssGB > 1.5 || heapGB > 1.0) {
      console.warn(`⚠️ High memory usage: RSS=${rssGB.toFixed(2)}GB, Heap=${heapGB.toFixed(2)}GB`);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

// Monitor for memory leaks in development
if (process.env.NODE_ENV !== 'production') {
  process.on('warning', (warning) => {
    console.warn('⚠️ Node.js warning:', warning.name, warning.message);
  });
}