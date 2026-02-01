import helmet from "helmet";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { body, validationResult } from "express-validator";
import hpp from "hpp";
import { Express, Request, Response, NextFunction } from "express";

// Validate SESSION_SECRET at module load time
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be set and at least 32 characters');
}

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

// Optimized slow down for better login performance
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 3, // Allow 3 requests per windowMs at full speed
  delayMs: () => 200, // Reduced delay for better user experience
  maxDelayMs: 5000, // Reduced maximum delay to 5 seconds
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
export const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Required for Vite in development
    "'unsafe-eval'", // Required for Vite in development
    "blob:", // Required for canvas-confetti web workers

    // Payment & Analytics
    "https://js.stripe.com",
    "https://api.stripe.com",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://analytics.google.com",
    "https://snap.licdn.com",
    "https://www.linkedin.com",

    // Form Builders
    "https://form.jotform.com",
    "https://*.jotform.com",
    "https://embed.typeform.com",
    "https://*.typeform.com",
    "https://docs.google.com", // Google Forms
    "https://*.hubspot.com",
    "https://forms.hubspot.com",
    "https://*.mailchimp.com",
    "https://*.surveymonkey.com",

    // Scheduling
    "https://calendly.com",
    "https://*.calendly.com",
    "https://assets.calendly.com",

    // Video Platforms
    "https://www.loom.com",
    "https://*.loom.com",
    "https://cdn.loom.com",
    "https://www.youtube.com",
    "https://youtube.com",
    "https://www.youtube-nocookie.com",
    "https://*.vimeo.com",
    "https://player.vimeo.com",

    // Productivity & Collaboration
    "https://airtable.com",
    "https://*.airtable.com",
    "https://notion.so",
    "https://*.notion.so",
    "https://www.figma.com",
    "https://*.figma.com",
    "https://miro.com",
    "https://*.miro.com",
    "https://www.canva.com",
    "https://*.canva.com"
  ],
  workerSrc: [
    "'self'",
    "blob:" // Allow web workers from blob URLs for canvas-confetti
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Required for dynamic styles
    "https://fonts.googleapis.com",

    // Form Builders
    "https://cdn.jotfor.ms",
    "https://*.typeform.com",
    "https://docs.google.com",
    "https://*.hubspot.com",
    "https://*.mailchimp.com",

    // Scheduling
    "https://assets.calendly.com",
    "https://*.calendly.com",

    // Video & Media
    "https://*.loom.com",
    "https://*.vimeo.com",

    // Productivity
    "https://*.airtable.com",
    "https://*.notion.so",
    "https://*.figma.com",
    "https://*.miro.com",
    "https://*.canva.com"
  ],
  fontSrc: [
    "'self'",
    "https://fonts.gstatic.com",
    "https://cdn.jotfor.ms",
    "https://*.typeform.com",
    "https://assets.calendly.com",
    "https://*.hubspot.com",
    "https://*.canva.com"
  ],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https:", // Allow all HTTPS images (already permissive for user-generated content)
    "https://*.replit.dev",
    "https://*.replit.app",
    "https://px.ads.linkedin.com"
  ],
  connectSrc: [
    "'self'",

    // Payment & Analytics
    "https://api.stripe.com",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://analytics.google.com",
    "https://*.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://*.googletagmanager.com",
    "https://www.google.com",
    "https://px.ads.linkedin.com",
    "https://snap.licdn.com",
    "https://www.linkedin.com",

    // Form Builders
    "https://submit.jotform.com",
    "https://*.jotform.com",
    "https://*.typeform.com",
    "https://docs.google.com",
    "https://*.hubspot.com",
    "https://api.hubspot.com",
    "https://*.mailchimp.com",
    "https://*.surveymonkey.com",

    // Scheduling
    "https://calendly.com",
    "https://*.calendly.com",

    // Video Platforms
    "https://*.loom.com",
    "https://www.youtube.com",
    "https://*.vimeo.com",

    // Productivity
    "https://*.airtable.com",
    "https://*.notion.so",
    "https://*.figma.com",
    "https://*.miro.com",
    "https://*.canva.com",

    // Development
    "ws://localhost:*",
    "wss://localhost:*"
  ],
  frameSrc: [
    "'self'", // Allow iframes from same origin (for PDF viewer)

    // Payment
    "https://js.stripe.com",
    "https://hooks.stripe.com",

    // Form Builders
    "https://form.jotform.com",
    "https://*.jotform.com",
    "https://embed.typeform.com",
    "https://*.typeform.com",
    "https://docs.google.com", // Google Forms
    "https://*.hubspot.com",
    "https://forms.hubspot.com",
    "https://*.mailchimp.com",
    "https://*.surveymonkey.com",

    // Scheduling
    "https://calendly.com",
    "https://*.calendly.com",

    // Video Platforms
    "https://www.loom.com",
    "https://*.loom.com",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://*.vimeo.com",
    "https://player.vimeo.com",

    // Productivity & Collaboration
    "https://airtable.com",
    "https://*.airtable.com",
    "https://notion.so",
    "https://*.notion.so",
    "https://www.figma.com",
    "https://*.figma.com",
    "https://miro.com",
    "https://*.miro.com",
    "https://www.canva.com",
    "https://*.canva.com"
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
    const isObjectStorage = req.path.startsWith('/api/object-storage/');
    
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
      referrerPolicy: { policy: isObjectStorage ? 'no-referrer' : 'strict-origin-when-cross-origin' },
      // Allow cross-origin access for object storage images
      crossOriginResourcePolicy: isObjectStorage ? { policy: 'cross-origin' } : { policy: 'same-origin' }
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
    
    // Skip speed limiter for better performance on non-sensitive routes
    if (req.path.startsWith('/api/login') || req.path.startsWith('/api/register')) {
      speedLimiter(req, res, () => {
        apiLimiter(req, res, next);
      });
    } else {
      apiLimiter(req, res, next);
    }
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
    // Use 'lax' for better browser compatibility in production
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' as const : 
              (isPublicRoute ? 'lax' as const : 'strict' as const),
  },
  rolling: false, // Disable session rolling to prevent excessive deserializations
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