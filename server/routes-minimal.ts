import type { Express } from "express";
import { setupAuth } from "./auth";
import { setupCognitoRoutes } from "./cognito-routes";
import { storage } from "./storage";
import { responseSanitizationMiddleware, securityHeadersMiddleware } from "./security-middleware";
import { sanitizeUser } from "./data-sanitizer";
import { logger } from "./logger";

export function registerApiRoutes(app: Express) {
  logger.info('🔧 Registering minimal API routes for crash fix...');
  
  try {
    // Register authentication routes first - these are working
    setupAuth(app);
    setupCognitoRoutes(app);
    
    // Add essential API endpoints for post-login functionality
    
    // User profile endpoint
    app.get("/api/user", securityHeadersMiddleware, responseSanitizationMiddleware, async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        const sanitized = sanitizeUser(req.user);
        res.json(sanitized);
      } catch (error) {
        logger.error('Error in /api/user:', error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Profile endpoint (alternative route)
    app.get("/api/profile", securityHeadersMiddleware, responseSanitizationMiddleware, async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        const sanitized = sanitizeUser(req.user);
        res.json(sanitized);
      } catch (error) {
        logger.error('Error in /api/profile:', error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // User limits endpoint
    app.get("/api/user/limits", securityHeadersMiddleware, responseSanitizationMiddleware, async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        // Return basic limits structure
        const limits = {
          monthlyDocumentsCreated: req.user.monthlyDocumentsCreated || 0,
          monthlyRegenerationsUsed: req.user.monthlyRegenerationsUsed || 0,
          subscriptionStatus: req.user.subscriptionStatus || 'free',
          maxDocuments: req.user.subscriptionStatus === 'enterprise' ? 100 : 
                        req.user.subscriptionStatus === 'standard' ? 25 : 3,
          maxRegenerations: req.user.subscriptionStatus === 'enterprise' ? 300 : 
                           req.user.subscriptionStatus === 'standard' ? 75 : 5
        };
        
        res.json(limits);
      } catch (error) {
        logger.error('Error in /api/user/limits:', error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Analysis templates endpoint (minimal)
    app.get("/api/analysis-templates", securityHeadersMiddleware, responseSanitizationMiddleware, async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        // Return empty array for now to prevent crashes
        res.json([]);
      } catch (error) {
        logger.error('Error in /api/analysis-templates:', error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Dashboard recent endpoint (minimal)
    app.get("/api/dashboard/recent", securityHeadersMiddleware, responseSanitizationMiddleware, async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        // Return minimal dashboard data to prevent crashes
        res.json({
          recentDocuments: [],
          recentActivity: [],
          stats: {
            totalDocuments: 0,
            totalViews: 0,
            totalShares: 0
          }
        });
      } catch (error) {
        logger.error('Error in /api/dashboard/recent:', error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Health check endpoint
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    logger.info('✅ Minimal API routes registered successfully');
    
  } catch (error) {
    logger.error('❌ Error registering API routes:', error);
    throw error;
  }
}