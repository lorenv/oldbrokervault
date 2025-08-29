import express from "express";
import cors from "cors";
import { logger } from "./logger";
import { registerApiRoutes } from "./routes-minimal";

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend running on different port
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] // Replace with your production domain
    : ['http://localhost:3000', 'http://localhost:5173'], // Vite dev servers
  credentials: true
}));

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API-only server - no static file serving
app.use('/api', (req, res, next) => {
  logger.info(`API request: ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-only', timestamp: new Date().toISOString() });
});

// Register API routes
registerApiRoutes(app);

// 404 for non-API routes (frontend should handle these)
app.use('*', (req, res) => {
  if (!req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/health')) {
    return res.status(404).json({ 
      message: 'API server - frontend routes should be handled by Vite dev server' 
    });
  }
  res.status(404).json({ message: 'API endpoint not found' });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API Error:', err);
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal Server Error' 
  });
});

const server = app.listen(PORT, () => {
  logger.info(`🚀 API-only server running on port ${PORT}`);
  logger.info(`📡 CORS enabled for frontend development`);
  logger.info(`🎯 Serving only /api/* endpoints`);
});

export { app, server };