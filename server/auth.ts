import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { getSessionConfig, loginValidation, registerValidation, handleValidationErrors, auditLogger } from "./security";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
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
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
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
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        return res.status(500).json({
          message: "Authentication error occurred"
        });
      }
      if (!user) {
        return res.status(401).json({
          message: info?.message || "Invalid email or password"
        });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({
            message: "Failed to establish session"
          });
        }
        return res.json(user);
      });
    })(req, res, next);
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