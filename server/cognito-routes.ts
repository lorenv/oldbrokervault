import type { Express } from "express";
import { cognitoAuth } from "./cognito-auth";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import { sanitizeUser } from "./data-sanitizer";
import { logger } from "./logger";
import { responseSanitizationMiddleware, sensitiveEndpointLimiter } from "./security-middleware";
import multer from "multer";
import { objectStorageImageManager } from "./image-manager-object-storage";

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

export function setupCognitoRoutes(app: Express) {
  // Login endpoint
  app.post("/api/login", sensitiveEndpointLimiter, responseSanitizationMiddleware, async (req, res) => {
    logger.info("Cognito login endpoint hit");
    
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          message: "Email and password are required"
        });
      }
      
      logger.info('Cognito login attempt', { email });
      
      // Authenticate with Cognito
      const cognitoResult = await cognitoAuth.signIn(email, password);
      
      // Get or sync local user data
      let localUser = await storage.getUserByCognitoId(cognitoResult.cognitoUserId);
      
      if (!localUser) {
        // Check if user exists by email (migration case)
        localUser = await storage.getUserByEmail(email);
        
        if (localUser) {
          // Link existing user to Cognito
          await storage.updateUser(localUser.id, {
            cognitoUserId: cognitoResult.cognitoUserId
          });
          logger.info('Linked existing user to Cognito', { 
            userId: localUser.id, 
            cognitoUserId: cognitoResult.cognitoUserId 
          });
        } else {
          // Create new local user (shouldn't happen in normal flow)
          logger.warn('User authenticated in Cognito but not found locally', {
            cognitoUserId: cognitoResult.cognitoUserId,
            email
          });
          return res.status(401).json({
            message: "User account not found. Please contact support."
          });
        }
      }
      
      // Set tokens in secure HTTP-only cookies
      res.cookie('accessToken', cognitoResult.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600000, // 1 hour
      });
      
      res.cookie('refreshToken', cognitoResult.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 3600000, // 30 days
      });
      
      logger.info('Cognito login successful', { 
        userId: localUser.id,
        cognitoUserId: cognitoResult.cognitoUserId 
      });
      
      res.json(sanitizeUser(localUser));
    } catch (error: any) {
      logger.error('Cognito login error', { 
        email: req.body.email,
        errorMessage: error.message 
      });
      
      res.status(401).json({
        message: error.message || "Login failed. Please try again."
      });
    }
  });

  // Register endpoint
  app.post("/api/register", registrationUpload.fields([
    { name: 'businessLogo', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
  ]), sensitiveEndpointLimiter, responseSanitizationMiddleware, async (req, res) => {
    logger.info("Cognito registration endpoint hit");
    
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { email, password, name, businessName, phoneNumber, adminCode, agreeToTerms } = req.body;
      
      // Get files from the request
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      logger.debug("Cognito registration request", {
        email,
        password: password ? '[REDACTED]' : 'MISSING',
        name,
        businessName,
        phoneNumber,
        agreeToTerms,
        adminCode: adminCode ? '[PROVIDED]' : 'NOT_PROVIDED'
      });
      
      // Basic validation
      if (!email || !password || !agreeToTerms || agreeToTerms !== 'true') {
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

      // Register with Cognito
      const cognitoResult = await cognitoAuth.signUp(email, password, name);
      
      // Special admin code check
      const isAdmin = adminCode && 
                     process.env.ADMIN_CODE && 
                     adminCode === process.env.ADMIN_CODE;

      // Create local user
      const user = await storage.createUser({
        email,
        password: '', // Not needed anymore, using empty string for compatibility
        cognitoUserId: cognitoResult.cognitoUserId,
        name: name || undefined,
        businessName: businessName || undefined,
        phoneNumber: phoneNumber || undefined,
        businessLogo: null,
        profilePhoto: null,
        isAdmin,
      });

      logger.info("Cognito user created", {
        id: user.id,
        email: user.email,
        cognitoUserId: user.cognitoUserId,
        needsVerification: cognitoResult.needsVerification
      });

      // Handle file uploads
      let updateData: any = {};
      
      if (files?.businessLogo?.[0]) {
        try {
          const logoBuffer = files.businessLogo[0].buffer;
          const logoFilename = `business-logo-${Date.now()}.${files.businessLogo[0].mimetype.split('/')[1]}`;
          const finalLogoPath = await objectStorageImageManager.saveBusinessImage(logoBuffer, logoFilename, user.id.toString());
          updateData.businessLogo = finalLogoPath;
          user.businessLogo = finalLogoPath;
        } catch (logoError) {
          logger.error('Failed to save business logo:', logoError);
        }
      }
      
      if (files?.profilePhoto?.[0]) {
        try {
          const photoBuffer = files.profilePhoto[0].buffer;
          const photoFilename = `profile-photo-${Date.now()}.${files.profilePhoto[0].mimetype.split('/')[1]}`;
          const finalPhotoPath = await objectStorageImageManager.saveBusinessImage(photoBuffer, photoFilename, user.id.toString());
          updateData.profilePhoto = finalPhotoPath;
          user.profilePhoto = finalPhotoPath;
        } catch (photoError) {
          logger.error('Failed to save profile photo:', photoError);
        }
      }
      
      // Update user if we have new file paths
      if (Object.keys(updateData).length > 0) {
        await storage.updateUser(user.id, updateData);
      }

      // Create default resources for new user
      try {
        const { populateDefaultNDAForUser } = await import("./populate-default-nda");
        await populateDefaultNDAForUser(user.id);
        logger.info(`Created default NDA template for new user ${user.id}`);
      } catch (ndaError) {
        logger.error(`Failed to create default NDA template for user ${user.id}:`, ndaError);
      }

      await storage.createExampleCimDocument(user.id);
      logger.info(`Created example CIM document for new user ${user.id}`);

      // If Cognito requires email verification, inform the user
      if (cognitoResult.needsVerification) {
        return res.status(201).json({
          message: "Registration successful! Please check your email to verify your account before logging in.",
          needsVerification: true,
          user: sanitizeUser(user)
        });
      }

      // Auto-login if no verification needed
      try {
        const loginResult = await cognitoAuth.signIn(email, password);
        
        res.cookie('accessToken', loginResult.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 3600000, // 1 hour
        });
        
        res.cookie('refreshToken', loginResult.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 3600000, // 30 days
        });
        
        res.status(201).json(sanitizeUser(user));
      } catch (loginError) {
        logger.error('Auto-login after registration failed:', loginError);
        res.status(201).json({
          message: "Registration successful! Please log in with your credentials.",
          user: sanitizeUser(user)
        });
      }
    } catch (error: any) {
      logger.error("Cognito registration error", {
        email: req.body.email,
        errorMessage: error.message,
        errorStack: error.stack
      });
      
      res.status(500).json({
        message: error.message || "Registration failed. Please try again."
      });
    }
  });

  // Forgot password endpoint
  app.post("/api/forgot-password", sensitiveEndpointLimiter, responseSanitizationMiddleware, async (req, res) => {
    logger.info("Cognito forgot password endpoint hit");
    
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          message: "Email is required"
        });
      }
      
      await cognitoAuth.forgotPassword(email);
      
      res.json({
        message: "Password reset instructions have been sent to your email address."
      });
    } catch (error: any) {
      logger.error('Cognito forgot password error', { 
        email: req.body.email,
        errorMessage: error.message 
      });
      
      // Always return success to prevent email enumeration
      res.json({
        message: "If an account with that email exists, password reset instructions have been sent."
      });
    }
  });

  // Reset password endpoint
  app.post("/api/reset-password", sensitiveEndpointLimiter, responseSanitizationMiddleware, async (req, res) => {
    logger.info("Cognito reset password endpoint hit");
    
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { email, code, password } = req.body;
      
      if (!email || !code || !password) {
        return res.status(400).json({
          message: "Email, reset code, and new password are required"
        });
      }
      
      await cognitoAuth.confirmForgotPassword(email, code, password);
      
      res.json({
        message: "Password has been reset successfully. You can now log in with your new password."
      });
    } catch (error: any) {
      logger.error('Cognito reset password error', { 
        email: req.body.email,
        errorMessage: error.message 
      });
      
      res.status(400).json({
        message: error.message || "Password reset failed. Please try again."
      });
    }
  });

  // Get current user endpoint
  app.get("/api/user", async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      // Check for access token in cookies
      const accessToken = req.cookies.accessToken;
      
      if (!accessToken) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      // Verify token
      const cognitoUser = await cognitoAuth.verifyAccessToken(accessToken);
      
      // Get local user data
      const localUser = await storage.getUserByCognitoId(cognitoUser.sub);
      
      if (!localUser) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      res.json(sanitizeUser(localUser));
    } catch (error: any) {
      logger.debug('User authentication check failed', { 
        errorMessage: error.message 
      });
      
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    // Clear tokens from cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.json({ message: 'Logged out successfully' });
  });

  // Verify email endpoint (for new registrations)
  app.post("/api/verify-email", sensitiveEndpointLimiter, responseSanitizationMiddleware, async (req, res) => {
    logger.info("Cognito verify email endpoint hit");
    
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({
          message: "Email and verification code are required"
        });
      }
      
      await cognitoAuth.confirmSignUp(email, code);
      
      res.json({
        message: "Email verified successfully. You can now log in."
      });
    } catch (error: any) {
      logger.error('Cognito verify email error', { 
        email: req.body.email,
        errorMessage: error.message 
      });
      
      res.status(400).json({
        message: error.message || "Email verification failed. Please try again."
      });
    }
  });

  // Resend verification code endpoint
  app.post("/api/resend-verification", sensitiveEndpointLimiter, responseSanitizationMiddleware, async (req, res) => {
    logger.info("Cognito resend verification endpoint hit");
    
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          message: "Email is required"
        });
      }
      
      await cognitoAuth.resendConfirmationCode(email);
      
      res.json({
        message: "Verification code has been resent to your email address."
      });
    } catch (error: any) {
      logger.error('Cognito resend verification error', { 
        email: req.body.email,
        errorMessage: error.message 
      });
      
      res.status(400).json({
        message: error.message || "Failed to resend verification code. Please try again."
      });
    }
  });
}