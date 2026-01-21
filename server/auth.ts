import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import multer from "multer";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { getSessionConfig, loginValidation, registerValidation, handleValidationErrors, auditLogger } from "./security";
import { sanitizeUser } from "./data-sanitizer";
import { logger } from "./logger";

// Enhanced user cache for authentication optimization
const userCache = new Map<number, { user: SelectUser; timestamp: number }>();
const emailCache = new Map<string, { user: SelectUser; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes for better performance

// Set up multer for file uploads during registration
const registrationUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for business logos
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'businessLogo') {
      // Accept images only
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for business logo'));
      }
    } else {
      cb(null, true);
    }
  }
});

function getCachedUser(id: number): SelectUser | null {
  const cached = userCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }
  if (cached) {
    userCache.delete(id); // Remove expired entry
  }
  return null;
}

function getCachedUserByEmail(email: string): SelectUser | null {
  const cached = emailCache.get(email);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }
  if (cached) {
    emailCache.delete(email);
  }
  return null;
}

function setCachedUser(user: SelectUser): void {
  const timestamp = Date.now();
  userCache.set(user.id, { user, timestamp });
  emailCache.set(user.email, { user, timestamp });
}

function invalidateUserCache(userId: number): void {
  const cached = userCache.get(userId);
  if (cached) {
    emailCache.delete(cached.user.email);
    userCache.delete(userId);
  }
}

// Export for use in other modules
export { invalidateUserCache };

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  // Optimized key length for better performance while maintaining security
  const buf = (await scryptAsync(password, salt, 24)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  // Use appropriate key length based on stored hash length
  const keyLength = hashedBuf.length;
  const suppliedBuf = (await scryptAsync(supplied, salt, keyLength)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Dynamic session configuration based on route
  app.use((req, res, next) => {
    const isPublicRoute = req.path.startsWith('/share/') || 
                         req.path.startsWith('/api/share/') ||
                         req.path === '/' ||
                         req.path === '/pricing' ||
                         req.path === '/privacy-policy' ||
                         req.path === '/cookie-policy' ||
                         req.path === '/login' ||
                         req.path === '/auth' ||
                         req.path.startsWith('/nda/redirect/') ||
                         req.path.startsWith('/api/register') ||
                         req.path.startsWith('/api/login') ||
                         req.path.startsWith('/api/auth/google') ||
                         req.path.startsWith('/api/auth/microsoft') ||
                         req.path.startsWith('/api/integrations/oauth/callback') ||
                         req.path.startsWith('/api/integrations/auth');
    
    const sessionSettings: session.SessionOptions = {
      ...getSessionConfig(isPublicRoute),
      store: storage.sessionStore,
    };

    session(sessionSettings)(req, res, next);
  });

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        const authStart = Date.now();
        try {
          // Check email cache first for faster lookups
          let user = getCachedUserByEmail(email);
          
          if (!user) {
            const dbUser = await storage.getUserByEmail(email);
            
            if (!dbUser) {
              return done(null, false, { message: "Invalid email or password" });
            }
            
            user = dbUser;
            // Cache the user for future requests
            setCachedUser(user);
          }
          
          const passwordMatch = await comparePasswords(password, user.password);
          
          if (!passwordMatch) {
            return done(null, false, { message: "Invalid email or password" });
          }
          // Cache the authenticated user
          setCachedUser(user);
          return done(null, user);
        } catch (error) {
          logger.error("Authentication error", { email }, undefined);
          return done(error);
        }
      }
    )
  );

  // Google OAuth Strategy
  // Uses existing Google credentials (same as email integration)
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.google_client_id;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.google_client_secret;

  if (googleClientId && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: "/api/auth/google/callback",
          scope: ["profile", "email"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error("No email provided by Google"));
            }

            // Check if user exists by Google ID
            let user = await storage.getUserByGoogleId(profile.id);

            if (user) {
              // User exists with this Google ID - log them in
              setCachedUser(user);
              return done(null, user);
            }

            // Check if user exists by email
            user = await storage.getUserByEmail(email);

            if (user) {
              // User exists with this email - link Google account
              user = await storage.linkOAuthProvider(user.id, 'google', profile.id);
              setCachedUser(user);
              return done(null, user);
            }

            // Create new user
            user = await storage.createOAuthUser({
              email,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              profilePhoto: profile.photos?.[0]?.value,
              googleId: profile.id,
              authProvider: 'google',
            });

            // Populate default NDA template for new users
            await populateDefaultNDAForUser(user.id);

            setCachedUser(user);
            return done(null, user);
          } catch (error) {
            logger.error("Google OAuth error", { error });
            return done(error as Error);
          }
        }
      )
    );
    console.log("✓ Google OAuth strategy configured");
  } else {
    console.log("⚠ Google OAuth not configured (missing GOOGLE_CLIENT_ID or google_client_id)");
  }

  // Microsoft OAuth Strategy
  // Uses existing Azure AD credentials (same as email integration)
  const microsoftClientId = process.env.MICROSOFT_CLIENT_ID || process.env.azure_client_id;
  const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.azure_client_secret;

  if (microsoftClientId && microsoftClientSecret) {
    passport.use(
      new MicrosoftStrategy(
        {
          clientID: microsoftClientId,
          clientSecret: microsoftClientSecret,
          callbackURL: "/api/auth/microsoft/callback",
          scope: ["user.read"],
        },
        async (accessToken: string, refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName;
            if (!email) {
              return done(new Error("No email provided by Microsoft"));
            }

            // Check if user exists by Microsoft ID
            let user = await storage.getUserByMicrosoftId(profile.id);

            if (user) {
              // User exists with this Microsoft ID - log them in
              setCachedUser(user);
              return done(null, user);
            }

            // Check if user exists by email
            user = await storage.getUserByEmail(email);

            if (user) {
              // User exists with this email - link Microsoft account
              user = await storage.linkOAuthProvider(user.id, 'microsoft', profile.id);
              setCachedUser(user);
              return done(null, user);
            }

            // Create new user
            user = await storage.createOAuthUser({
              email,
              firstName: profile.name?.givenName || profile._json?.givenName,
              lastName: profile.name?.familyName || profile._json?.surname,
              microsoftId: profile.id,
              authProvider: 'microsoft',
            });

            // Populate default NDA template for new users
            await populateDefaultNDAForUser(user.id);

            setCachedUser(user);
            return done(null, user);
          } catch (error) {
            logger.error("Microsoft OAuth error", { error });
            return done(error as Error);
          }
        }
      )
    );
    console.log("✓ Microsoft OAuth strategy configured");
  } else {
    console.log("⚠ Microsoft OAuth not configured (missing MICROSOFT_CLIENT_ID/azure_client_id or MICROSOFT_CLIENT_SECRET/azure_client_secret)");
  }

  passport.serializeUser((user, done) => {
    const serializeStart = Date.now();
    logger.debug("Serializing user", undefined, user.id);
    done(null, user.id);
    logger.debug("User serialization completed", { duration: Date.now() - serializeStart }, user.id);
  });
  
  passport.deserializeUser(async (id: any, done) => {
    try {
      // logger.debug('Deserializing user ID', { idType: typeof id, idValue: typeof id === 'object' ? '[object]' : String(id).substring(0, 100) });
      
      // CRITICAL: Check if id is actually a user object instead of a number
      if (typeof id === 'string') {
        try {
          const parsed = JSON.parse(id);
          if (parsed && typeof parsed === 'object' && parsed.id) {
            logger.warn('Found corrupted session with full user object, extracting ID', { extractedId: parsed.id });
            id = parsed.id;
          }
        } catch (e) {
          // Not JSON, might be a stringified number
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            logger.debug('Converting string ID to number', { numId });
            id = numId;
          } else {
            logger.error('Invalid user ID in session', { invalidId: id });
            return done(null, false);
          }
        }
      }
      
      // Additional check for object types that weren't caught above
      if (typeof id === 'object' && id !== null) {
        if (id.id && typeof id.id === 'number') {
          logger.warn('Found object with ID property, extracting', { extractedId: id.id });
          id = id.id;
        } else {
          logger.error('Cannot extract valid ID from object', { invalidObject: id });
          return done(null, false);
        }
      }
      
      if (typeof id !== 'number' || isNaN(id)) {
        logger.error('User ID must be a valid number', { idType: typeof id, idValue: id });
        return done(null, false);
      }
      
      logger.debug('Using valid user ID', { userId: id });
      
      // Check cache first to reduce database hits
      const cachedUser = getCachedUser(id);
      
      if (cachedUser) {
        logger.debug('Found user in cache', undefined, id);
        return done(null, cachedUser);
      }

      logger.debug('Fetching user from database', undefined, id);
      const user = await storage.getUser(id);
      
      if (!user) {
        logger.warn('User not found in database', undefined, id);
        return done(null, false);
      }
      
      logger.debug('User fetched successfully', undefined, id);
      // Cache the user for future requests
      setCachedUser(user);
      done(null, user);
    } catch (error: any) {
      logger.error('Deserialization error', { errorMessage: error.message }, id);
      
      // If it's a database type error, it means the session is still corrupted
      if (error.message && error.message.includes('invalid input syntax for type integer')) {
        logger.error('Corrupted session detected, forcing logout', undefined, id);
        // Force session destruction for this user
        return done(null, false);
      }
      
      done(error);
    }
  });

  app.post("/api/register", registrationUpload.fields([
    { name: 'businessLogo', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
  ]), async (req, res) => {
    logger.info("Registration endpoint hit");
    
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    try {
      logger.info('Registration attempt', { email: req.body.email });
      logger.debug('Request headers', {
        'content-type': req.headers['content-type'],
        'accept': req.headers['accept'],
        'user-agent': req.headers['user-agent']
      });
      
      // Handle JSON body parsing (FormData contains text fields)
      const { email, password, name, businessName, phoneNumber, adminCode, agreeToTerms } = req.body;
      
      // Get files from the request (multer middleware populates this)
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      logger.debug("Registration request body", {
        email,
        password: password ? '[REDACTED]' : 'MISSING',
        name,
        businessName,
        phoneNumber,
        agreeToTerms,
        adminCode: adminCode ? '[PROVIDED]' : 'NOT_PROVIDED'
      });
      logger.debug("Registration files", {
        businessLogo: files?.businessLogo?.[0] ? 'PROVIDED' : 'NOT_PROVIDED',
        profilePhoto: files?.profilePhoto?.[0] ? 'PROVIDED' : 'NOT_PROVIDED'
      });
      
      // Basic validation
      if (!email || !password || !agreeToTerms || agreeToTerms !== 'true') {
        logger.warn("Registration validation failed", { email: !!email, password: !!password, agreeToTerms });
        return res.status(400).json({
          message: "Please fill in all required fields and agree to the terms"
        });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          message: "An account with this email already exists"
        });
      }

      // Special admin code check - only grant admin if both adminCode is provided and matches env var
      const isAdmin = adminCode && 
                     process.env.ADMIN_CODE && 
                     adminCode === process.env.ADMIN_CODE;

      // Don't handle file uploads here - we'll do it after user creation

      console.log("Creating user with data:", {
        email,
        name: name || null,
        businessName: businessName || null,
        phoneNumber: phoneNumber || null,
        businessLogo: null,
        profilePhoto: null,
        isAdmin,
      });

      const user = await storage.createUser({
        email,
        password: await hashPassword(password),
        name: name || undefined,
        businessName: businessName || undefined,
        phoneNumber: phoneNumber || undefined,
        businessLogo: undefined,
        profilePhoto: undefined,
        isAdmin,
      });

      console.log("User created:", {
        id: user.id,
        email: user.email,
        name: user.name,
        businessName: user.businessName,
        phoneNumber: user.phoneNumber,
        businessLogo: user.businessLogo,
        profilePhoto: user.profilePhoto
      });

      // Now handle file uploads with the actual user ID
      let updateData: any = {};
      
      if (files?.businessLogo?.[0]) {
        try {
          const { objectStorageImageManager } = await import("./image-manager-object-storage");
          const logoBuffer = files.businessLogo[0].buffer;
          const logoFilename = `business-logo-${Date.now()}.${files.businessLogo[0].mimetype.split('/')[1]}`;
          const finalLogoPath = await objectStorageImageManager.saveBusinessImage(logoBuffer, logoFilename, user.id.toString());
          updateData.businessLogo = finalLogoPath;
          user.businessLogo = finalLogoPath;

          // Sync logo and brand colors to e-signature branding settings
          try {
            const { extractBrandColors } = await import("./services/brand-color-extractor");
            const { db } = await import("./db");
            const { userBranding } = await import("../shared/schema");

            // Extract brand colors from the logo
            const extractedColors = await extractBrandColors(logoBuffer);
            const primaryColor = extractedColors.primary || "#0072CE";

            // Add cache-busting timestamp to logo URL for e-signature branding
            const logoUrlWithCacheBust = `${finalLogoPath}?t=${Date.now()}`;

            // Create e-signature branding record with logo and extracted colors
            await db.insert(userBranding).values({
              userId: user.id,
              logoUrl: logoUrlWithCacheBust,
              primaryColor: primaryColor,
              companyName: businessName || null,
            });

            // Also save brand colors to user profile
            updateData.brandColors = extractedColors.colors;

            console.log(`[Registration] Synced business logo to e-signature branding for user ${user.id}`, {
              logoUrl: logoUrlWithCacheBust,
              primaryColor,
              companyName: businessName || null,
              brandColors: extractedColors.colors
            });
          } catch (brandingError) {
            console.error(`[Registration] Failed to sync logo to e-signature branding for user ${user.id}:`, brandingError);
            // Don't fail registration if branding sync fails
          }
        } catch (logoError) {
          console.error('Failed to save business logo:', logoError);
        }
      }
      
      if (files?.profilePhoto?.[0]) {
        try {
          const { objectStorageImageManager } = await import("./image-manager-object-storage");
          const photoBuffer = files.profilePhoto[0].buffer;
          const photoFilename = `profile-photo-${Date.now()}.${files.profilePhoto[0].mimetype.split('/')[1]}`;
          const finalPhotoPath = await objectStorageImageManager.saveBusinessImage(photoBuffer, photoFilename, user.id.toString());
          updateData.profilePhoto = finalPhotoPath;
          user.profilePhoto = finalPhotoPath;
        } catch (photoError) {
          console.error('Failed to save profile photo:', photoError);
        }
      }
      
      // Update user if we have new file paths
      if (Object.keys(updateData).length > 0) {
        await storage.updateUser(user.id, updateData);
      }

      // Create default NDA template for the new user
      try {
        const { populateDefaultNDAForUser } = await import("./populate-default-nda");
        await populateDefaultNDAForUser(user.id);
        console.log(`Created "CIM Share NDA" template for new user ${user.id}`);
      } catch (ndaError) {
        console.error(`Failed to create default NDA template for user ${user.id}:`, ndaError);
        // Don't fail registration if NDA template creation fails
      }

      // Create example CIM document for new user
      await storage.createExampleCimDocument(user.id);
      console.log(`Created example CIM document for new user ${user.id}`);

      // Schedule welcome email for the new user
      try {
        await storage.scheduleWelcomeEmail(user.id);
        console.log(`Welcome email scheduled for new user ${user.id}`);
      } catch (emailError) {
        console.error(`Failed to schedule welcome email for user ${user.id}:`, emailError);
        // Don't fail registration if email scheduling fails
      }

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({
            message: "Failed to log in after registration"
          });
        }
        // SECURITY: Return sanitized user data without sensitive fields
        res.status(201).json(sanitizeUser(user));
      });
    } catch (error) {
      console.error("=== REGISTRATION ERROR ===");
      console.error("Full error object:", error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      console.error("Error type:", typeof error);
      console.error("=== END REGISTRATION ERROR ===");
      
      res.status(500).json({
        message: "Failed to create account. Please try again."
      });
    }
  });

  app.post("/api/login", loginValidation, handleValidationErrors, auditLogger('LOGIN'), (req, res, next) => {
    const loginStart = Date.now();
    console.log(`🔐 Login attempt for email: ${req.body.email}`);
    console.log(`🔐 Session ID: ${req.sessionID}`);
    console.log(`🔐 Session store type: ${storage.sessionStore.constructor.name}`);
    console.log(`🔐 Request headers:`, {
      'content-type': req.headers['content-type'],
      'accept': req.headers['accept'],
      'user-agent': req.headers['user-agent']
    });
    
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Add request timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`🔐 Login timeout for ${req.body.email}`);
        res.status(504).json({ message: "Login request timeout" });
      }
    }, 30000);

    try {
      passport.authenticate("local", (err, user, info) => {
        clearTimeout(timeout);
        
        // Ensure we always return JSON
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/json');
        }
        
        if (err) {
          console.error("🔐 Passport authentication error:", err);
          console.error("🔐 Error type:", err.constructor.name);
          console.error("🔐 Error code:", err.code);
          console.error("🔐 Error stack:", err.stack);
          
          // Check if it's a database connection error
          if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.message.includes('pool')) {
            return res.status(503).json({
              message: "Database connection error",
              error: process.env.NODE_ENV === 'development' ? err.message : "Service temporarily unavailable"
            });
          }
          
          return res.status(500).json({
            message: "Authentication system error",
            error: process.env.NODE_ENV === 'development' ? err.message : "Internal server error"
          });
        }
        
        if (!user) {
          console.log("🔐 Authentication failed for:", req.body.email, "Info:", info);
          return res.status(400).json({
            message: "Invalid email or password. Please check your credentials and try again."
          });
        }
        
        req.login(user, (err) => {
          if (err) {
            console.error("🔐 Login session error:", err);
            // Check if it's a session store error
            if (err.message.includes('session') || err.message.includes('store')) {
              return res.status(503).json({
                message: "Session store error",
                error: process.env.NODE_ENV === 'development' ? err.message : "Session service unavailable"
              });
            }
            
            return res.status(500).json({
              message: "Failed to establish session",
              error: process.env.NODE_ENV === 'development' ? err.message : "Session creation failed"
            });
          }
          
          console.log(`🔐 Login successful for ${user.email}`);
          // SECURITY: Return sanitized user data without sensitive fields
          return res.json(sanitizeUser(user));
        });
      })(req, res, next);
    } catch (error) {
      clearTimeout(timeout);
      console.error("🔐 Unexpected login error:", error);
      return res.status(500).json({
        message: "Unexpected authentication error",
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : "Internal server error"
      });
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({
          message: "Failed to log out"
        });
      }
      res.sendStatus(200);
    });
  });

  // ============================================
  // SOCIAL LOGIN ROUTES
  // ============================================

  // Google OAuth routes
  app.get("/api/auth/google", (req, res, next) => {
    // Store the redirect URL in session if provided
    if (req.query.redirect) {
      (req.session as any).oauthRedirect = req.query.redirect;
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth?error=google_auth_failed" }),
    (req, res) => {
      console.log("✓ Google OAuth callback successful for user:", req.user?.email);
      const redirectUrl = (req.session as any).oauthRedirect || "/";
      delete (req.session as any).oauthRedirect;
      res.redirect(redirectUrl);
    }
  );

  // Microsoft OAuth routes
  app.get("/api/auth/microsoft", (req, res, next) => {
    // Store the redirect URL in session if provided
    if (req.query.redirect) {
      (req.session as any).oauthRedirect = req.query.redirect;
    }
    passport.authenticate("microsoft", { scope: ["user.read"] })(req, res, next);
  });

  app.get("/api/auth/microsoft/callback",
    passport.authenticate("microsoft", { failureRedirect: "/auth?error=microsoft_auth_failed" }),
    (req, res) => {
      console.log("✓ Microsoft OAuth callback successful for user:", req.user?.email);
      const redirectUrl = (req.session as any).oauthRedirect || "/";
      delete (req.session as any).oauthRedirect;
      res.redirect(redirectUrl);
    }
  );

  // Check which social providers are configured
  app.get("/api/auth/providers", (req, res) => {
    const googleConfigured = !!(
      (process.env.GOOGLE_CLIENT_ID || process.env.google_client_id) &&
      (process.env.GOOGLE_CLIENT_SECRET || process.env.google_client_secret)
    );
    const microsoftConfigured = !!(
      (process.env.MICROSOFT_CLIENT_ID || process.env.azure_client_id) &&
      (process.env.MICROSOFT_CLIENT_SECRET || process.env.azure_client_secret)
    );
    res.json({
      google: googleConfigured,
      microsoft: microsoftConfigured,
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Not authenticated"
      });
    }
    
    try {
      console.log("=== USER API DEBUG START ===");
      console.log("Session user ID:", req.user?.id);
      
      // Always fetch fresh user data from database to ensure subscription status is current
      const freshUser = await storage.getUser(req.user.id);
      
      if (!freshUser) {
        console.log("❌ User not found in database, possibly deleted");
        return res.status(404).json({
          message: "User not found"
        });
      }
      
      console.log("Fresh user data from database:", {
        id: freshUser.id,
        email: freshUser.email,
        name: freshUser.name,
        phoneNumber: freshUser.phoneNumber,
        businessName: freshUser.businessName,
        businessLogo: freshUser.businessLogo,
        profilePhoto: freshUser.profilePhoto,
        subscriptionStatus: freshUser.subscriptionStatus,
        subscriptionEndsAt: freshUser.subscriptionEndsAt,
        subscriptionId: freshUser.subscriptionId,
        stripeCustomerId: freshUser.stripeCustomerId
      });
      
      console.log("=== USER COMPARISON DEBUG ===");
      console.log("Session user ID:", req.user?.id);
      console.log("Session user subscription:", req.user?.subscriptionStatus);
      console.log("Database user subscription:", freshUser.subscriptionStatus);
      console.log("Are they the same user?", req.user?.id === freshUser.id);
      console.log("==============================");
      
      // Update the session user with fresh data to keep it in sync
      req.user = freshUser;
      
      // Clear the user cache to force fresh data on next request
      invalidateUserCache(freshUser.id);
      
      const sanitizedUser = sanitizeUser(freshUser);
      console.log("Sanitized user data:", sanitizedUser);
      console.log("=== USER API DEBUG END ===");
      
      // SECURITY: Return sanitized fresh user data without sensitive fields
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error fetching fresh user data:", error);
      res.status(500).json({
        message: "Failed to fetch user data"
      });
    }
  });

  // Debug endpoint - added here to ensure it's registered
  app.get("/api/debug/user", async (req, res) => {
    console.log("Debug endpoint hit! Authentication status:", req.isAuthenticated());
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        error: "Not authenticated",
        isAuthenticated: false,
        message: "Please log in first" 
      });
    }
    
    try {
      const userFromDb = await storage.getUser(req.user!.id);
      const sessionUser = req.user;
      
      res.json({
        isAuthenticated: true,
        sessionUser: {
          id: sessionUser?.id,
          email: sessionUser?.email,
          subscriptionStatus: sessionUser?.subscriptionStatus,
          name: sessionUser?.name,
          phoneNumber: sessionUser?.phoneNumber,
          businessName: sessionUser?.businessName,
          businessLogo: sessionUser?.businessLogo,
          profilePhoto: sessionUser?.profilePhoto
        },
        databaseUser: {
          id: userFromDb?.id,
          email: userFromDb?.email,
          subscriptionStatus: userFromDb?.subscriptionStatus,
          name: userFromDb?.name,
          phoneNumber: userFromDb?.phoneNumber,
          businessName: userFromDb?.businessName,
          businessLogo: userFromDb?.businessLogo,
          profilePhoto: userFromDb?.profilePhoto
        }
      });
    } catch (error) {
      console.error("Debug user error:", error);
      res.status(500).json({ error: "Failed to fetch debug data" });
    }
  });
}