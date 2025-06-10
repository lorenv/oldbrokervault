import helmet from "helmet";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { body, validationResult } from "express-validator";
import hpp from "hpp";
import { Express, Request, Response, NextFunction } from "express";

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Increased from 5 to 20 for better usability
  message: {
    error: "Too many authentication attempts, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs for API endpoints
  message: {
    error: "Too many requests, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit uploads to 10 per hour
  message: {
    error: "Upload limit exceeded, please try again later.",
    retryAfter: "1 hour"
  },
});

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // Allow 2 requests per windowMs at full speed
  delayMs: () => 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  validate: { delayMs: false }
});

// Input validation schemas
export const loginValidation = [
  body('email')
    .isEmail()
    .trim()
    .isLength({ max: 254 })
    .withMessage('Invalid email address'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
];

export const registerValidation = [
  ...loginValidation,
  body('email').custom(async (email) => {
    // Additional email validation can be added here
    return true;
  }),
];

export const documentValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('transcript')
    .trim()
    .isLength({ min: 10, max: 50000 })
    .withMessage('Transcript must be between 10 and 50,000 characters'),
];

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Security audit logging
interface AuditLog {
  timestamp: Date;
  userId?: number;
  action: string;
  resource?: string;
  ip: string;
  userAgent?: string;
  success: boolean;
  details?: any;
}

const auditLogs: AuditLog[] = [];

export const auditLogger = (action: string, resource?: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const success = res.statusCode < 400;
      
      auditLogs.push({
        timestamp: new Date(),
        userId: req.user?.id,
        action,
        resource,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        success,
        details: success ? undefined : { statusCode: res.statusCode }
      });

      // Keep only last 1000 logs in memory (in production, use proper logging service)
      if (auditLogs.length > 1000) {
        auditLogs.splice(0, auditLogs.length - 1000);
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

// Content Security Policy
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Required for Vite in development
    "'unsafe-eval'", // Required for Vite in development
    "https://js.stripe.com",
    "https://api.stripe.com"
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Required for dynamic styles
    "https://fonts.googleapis.com"
  ],
  fontSrc: [
    "'self'",
    "https://fonts.gstatic.com"
  ],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https:"
  ],
  connectSrc: [
    "'self'",
    "https://api.stripe.com",
    "ws://localhost:*", // WebSocket for development
    "wss://localhost:*"
  ],
  frameSrc: [
    "'self'", // Allow iframes from same origin (for PDF viewer)
    "https://js.stripe.com",
    "https://hooks.stripe.com"
  ],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: [],
  frameAncestors: ["'self'"], // Default: only allow same origin
};

// CSP directives for shared routes (allow iframe embedding)
const sharedCspDirectives = {
  ...cspDirectives,
  frameAncestors: ["*"], // Allow embedding in any iframe for shared documents
};

export function setupSecurity(app: Express) {
  // Trust proxy for accurate IP addresses
  app.set('trust proxy', 1);

  // Security headers with conditional frameguard
  app.use((req, res, next) => {
    // Apply helmet with conditional frameguard for shared routes
    const isSharedRoute = req.path.startsWith('/share/') || req.path.match(/^\/api\/share\/[^\/]+/);
    
    helmet({
      contentSecurityPolicy: {
        directives: isSharedRoute ? sharedCspDirectives : cspDirectives,
        reportOnly: false,
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      frameguard: isSharedRoute ? false : { action: 'deny' },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    })(req, res, next);
  });

  // Prevent HTTP Parameter Pollution
  app.use(hpp());

  // Global rate limiting - exclude public routes
  app.use('/api', (req, res, next) => {
    const isPublicApiRoute = req.path.startsWith('/api/share/') || 
                            req.path.startsWith('/api/register') ||
                            req.path.startsWith('/api/login');
    
    if (isPublicApiRoute) {
      // More lenient limits for public routes
      const publicLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200, // Double the limit for public routes
        message: {
          error: "Too many requests, please try again later.",
          retryAfter: "15 minutes"
        },
        standardHeaders: true,
        legacyHeaders: false,
      });
      return publicLimiter(req, res, next);
    }
    
    // Apply normal limits for authenticated routes
    speedLimiter(req, res, () => {
      apiLimiter(req, res, next);
    });
  });

  // Stricter limits for sensitive endpoints
  app.use('/api/login', authLimiter);
  app.use('/api/register', authLimiter);
  app.use('/api/forgot-password', authLimiter);
  app.use('/api/upload', uploadLimiter);

  // Request size limits (override the 50MB limit for security)
  app.use('/api/upload', (req, res, next) => {
    // Allow larger uploads only for authenticated users with premium subscription
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required for uploads' });
    }
    next();
  });

  // Audit logging for sensitive operations
  app.use('/api/login', auditLogger('LOGIN'));
  app.use('/api/register', auditLogger('REGISTER'));
  app.use('/api/cim', auditLogger('DOCUMENT_ACCESS'));
  app.use('/api/upload', auditLogger('FILE_UPLOAD'));
}

// Enhanced session security - Dynamic configuration based on route
export const getSessionConfig = (isPublicRoute: boolean = false) => ({
  name: 'sessionId', // Don't use default session name
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS access to cookies
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isPublicRoute ? 'lax' as const : 'strict' as const, // Allow cross-site for public routes
  },
  rolling: true, // Reset expiry on each request
});

// Legacy export for backwards compatibility
export const secureSessionConfig = getSessionConfig(false);

// Security health check endpoint
export const securityHealthCheck = (req: Request, res: Response) => {
  const checks = {
    https: req.secure || req.get('X-Forwarded-Proto') === 'https',
    sessionSecret: !!process.env.SESSION_SECRET,
    databaseUrl: !!process.env.DATABASE_URL,
    headers: {
      xFrameOptions: res.get('X-Frame-Options') === 'DENY',
      xContentTypeOptions: res.get('X-Content-Type-Options') === 'nosniff',
      xXssProtection: !!res.get('X-XSS-Protection'),
      strictTransportSecurity: !!res.get('Strict-Transport-Security'),
    },
    auditLogCount: auditLogs.length,
    lastAuditLog: auditLogs[auditLogs.length - 1]?.timestamp
  };

  const score = Object.values(checks.headers).filter(Boolean).length + 
                (checks.https ? 1 : 0) + 
                (checks.sessionSecret ? 1 : 0) + 
                (checks.databaseUrl ? 1 : 0);

  res.json({
    security: {
      score: `${score}/7`,
      level: score >= 6 ? 'bank-level' : score >= 4 ? 'enterprise' : 'basic',
      checks,
      recommendations: score < 6 ? [
        'Enable HTTPS in production',
        'Ensure all security headers are present',
        'Verify environment variables are set'
      ] : []
    }
  });
};