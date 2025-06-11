import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { getSessionConfig, loginValidation, registerValidation, handleValidationErrors, auditLogger } from "./security";

// User cache to reduce database hits during session deserialization
const userCache = new Map<number, { user: SelectUser; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

function setCachedUser(user: SelectUser): void {
  userCache.set(user.id, { user, timestamp: Date.now() });
}

function invalidateUserCache(userId: number): void {
  userCache.delete(userId);
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
  // Reduced key length for better performance while maintaining security
  const buf = (await scryptAsync(password, salt, 32)) as Buffer;
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
                         req.path.startsWith('/api/login');
    
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
        try {
          console.log(`Authentication attempt for email: ${email}`);
          const user = await storage.getUserByEmail(email);
          
          if (!user) {
            console.log(`No user found for email: ${email}`);
            return done(null, false, { message: "Invalid email or password" });
          }
          
          console.log(`User found for ${email}, checking password`);
          const passwordMatch = await comparePasswords(password, user.password);
          
          if (!passwordMatch) {
            console.log(`Password mismatch for user: ${email}`);
            return done(null, false, { message: "Invalid email or password" });
          }
          
          console.log(`Authentication successful for user: ${email}`);
          // Cache the authenticated user
          setCachedUser(user);
          return done(null, user);
        } catch (error) {
          console.error(`Authentication error for ${email}:`, error);
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    console.log(`Serializing user: ${user.id}`);
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      // Check cache first to reduce database hits
      const cachedUser = getCachedUser(id);
      if (cachedUser) {
        return done(null, cachedUser);
      }

      const user = await storage.getUser(id);
      if (!user) {
        console.log(`No user found during deserialization for ID: ${id}`);
        return done(null, false);
      }
      
      // Cache the user for future requests
      setCachedUser(user);
      done(null, user);
    } catch (error) {
      console.error(`Deserialization error for user ${id}:`, error);
      done(error);
    }
  });

  app.post("/api/register", registerValidation, handleValidationErrors, auditLogger('REGISTER'), async (req, res) => {
    try {
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({
          message: "An account with this email already exists"
        });
      }

      // Special admin code check
      const isAdmin = req.body.adminCode === process.env.ADMIN_CODE;

      const user = await storage.createUser({
        email: req.body.email,
        password: await hashPassword(req.body.password),
        isAdmin,
      });

      // Create default NDA template for the new user
      try {
        const { populateDefaultNDAForUser } = await import("./populate-default-nda");
        await populateDefaultNDAForUser(user.id);
        console.log(`Created default NDA template for new user ${user.id}`);
      } catch (ndaError) {
        console.error(`Failed to create default NDA template for user ${user.id}:`, ndaError);
        // Don't fail registration if NDA template creation fails
      }

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({
            message: "Failed to log in after registration"
          });
        }
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        message: "Failed to create account. Please try again."
      });
    }
  });

  app.post("/api/login", loginValidation, handleValidationErrors, auditLogger('LOGIN'), (req, res, next) => {
    console.log(`Login attempt for email: ${req.body.email}`);
    console.log(`Session ID: ${req.sessionID}`);
    console.log(`Session store type: ${storage.sessionStore.constructor.name}`);
    
    // Add request timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`Login timeout for ${req.body.email}`);
        res.status(504).json({ message: "Login request timeout" });
      }
    }, 30000);

    try {
      passport.authenticate("local", (err, user, info) => {
        clearTimeout(timeout);
        
        if (err) {
          console.error("Passport authentication error:", err);
          console.error("Error type:", err.constructor.name);
          console.error("Error code:", err.code);
          console.error("Error stack:", err.stack);
          
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
          console.log("Authentication failed for:", req.body.email, "Info:", info);
          return res.status(401).json({
            message: info?.message || "Invalid email or password"
          });
        }
        
        console.log("User authenticated successfully:", user.email);
        console.log(`Attempting to establish session for user ${user.id}`);
        
        req.login(user, (err) => {
          if (err) {
            console.error("Session establishment error:", err);
            console.error("Session error type:", err.constructor.name);
            console.error("Session error code:", err.code);
            console.error("Session error stack:", err.stack);
            
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
          
          console.log("Session established successfully for:", user.email);
          console.log(`Final session ID: ${req.sessionID}`);
          return res.json(user);
        });
      })(req, res, next);
    } catch (error) {
      clearTimeout(timeout);
      console.error("Unexpected login error:", error);
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

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        message: "Not authenticated"
      });
    }
    res.json(req.user);
  });
}