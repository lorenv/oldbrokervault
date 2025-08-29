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
      
      // Get the user's stored Cognito username for authentication
      const localUser = await storage.getUserByEmail(email);
      const cognitoUsername = localUser?.cognitoUsername;
      
      logger.info('Using Cognito username for auth', { 
        email, 
        hasCognitoUsername: !!cognitoUsername 
      });
      
      // Authenticate with Cognito using the correct username  
      let cognitoResult;
      try {
        cognitoResult = await cognitoAuth.signIn(email, password, cognitoUsername);
      } catch (authError: any) {
        // Check if this is likely an unverified user scenario
        if (authError.message === 'Invalid email or password' && localUser && !localUser.emailVerified) {
          logger.info('Login failed for unverified user, prompting for verification', { email });
          
          return res.status(403).json({
            message: "Please verify your email address before logging in. Check your inbox for the verification link or enter your verification code below.",
            needsVerification: true,
            email: email
          });
        }
        
        // Re-throw the original error for other cases
        throw authError;
      }
      
      // Get or sync local user data
      let userForToken = await storage.getUserByCognitoId(cognitoResult.cognitoUserId);
      
      if (!userForToken) {
        // Use the already-fetched user data from the auth lookup
        userForToken = localUser;
        
        if (userForToken) {
          // Link existing user to Cognito
          await storage.updateUser(userForToken.id, {
            cognitoUserId: cognitoResult.cognitoUserId
          });
          logger.info('Linked existing user to Cognito', { 
            userId: userForToken.id, 
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
        userId: userForToken.id,
        cognitoUserId: cognitoResult.cognitoUserId 
      });
      
      res.json(sanitizeUser(userForToken));
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
      const { email, password, firstName, lastName, name, businessName, phoneNumber, adminCode, agreeToTerms } = req.body;
      
      // Get files from the request
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      logger.debug("Cognito registration request", {
        email,
        password: password ? '[REDACTED]' : 'MISSING',
        firstName,
        lastName,
        name, // Legacy field
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

      // During Cognito migration: Only check for users who are already in Cognito
      // This allows new users to register even if old local-only accounts exist
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.cognitoUserId) {
        return res.status(400).json({
          message: "An account with this email already exists"
        });
      }
      
      // Use firstName/lastName if provided, otherwise parse the legacy name field
      const finalFirstName = firstName || (name ? name.split(' ')[0] : undefined);
      const finalLastName = lastName || (name && name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : undefined);
      
      // Register with Cognito first
      let cognitoResult;
      try {
        cognitoResult = await cognitoAuth.signUp(email, password, finalFirstName, finalLastName, businessName, phoneNumber);
        logger.info('Cognito user registration successful', {
          email,
          firstName: finalFirstName,
          lastName: finalLastName,
          cognitoUserId: cognitoResult.cognitoUserId,
          needsVerification: cognitoResult.needsVerification
        });
      } catch (cognitoError: any) {
        logger.error('Cognito user registration failed', {
          email,
          errorMessage: cognitoError.message,
          errorCode: cognitoError.name,
          errorStack: cognitoError.stack
        });
        throw cognitoError; // Re-throw to be handled by outer catch
      }
      
      // Special admin code check
      const isAdmin = adminCode && 
                     process.env.ADMIN_CODE && 
                     adminCode === process.env.ADMIN_CODE;

      let user;
      
      // If there's an existing local-only user (no Cognito ID), update it with Cognito info
      if (existingUser && !existingUser.cognitoUserId) {
        logger.info("Updating existing local user with Cognito information", {
          email,
          existingUserId: existingUser.id,
          cognitoUserId: cognitoResult.cognitoUserId
        });
        
        // Update the existing user record with Cognito information
        user = await storage.updateUser(existingUser.id, {
          cognitoUserId: cognitoResult.cognitoUserId,
          cognitoUsername: cognitoResult.cognitoUsername,
          firstName: finalFirstName || existingUser.firstName,
          lastName: finalLastName || existingUser.lastName,
          name: name || existingUser.name, // Keep for backward compatibility
          businessName: businessName || existingUser.businessName,
          phoneNumber: phoneNumber || existingUser.phoneNumber,
          isAdmin: isAdmin || existingUser.isAdmin,
        });
      } else {
        // Create new local user
        user = await storage.createUser({
          email,
          password: '', // Not needed anymore, using empty string for compatibility
          cognitoUserId: cognitoResult.cognitoUserId,
          cognitoUsername: cognitoResult.cognitoUsername,
          firstName: finalFirstName || undefined,
          lastName: finalLastName || undefined,
          name: name || undefined, // Keep for backward compatibility
          businessName: businessName || undefined,
          phoneNumber: phoneNumber || undefined,
          businessLogo: undefined,
          profilePhoto: undefined,
          isAdmin,
        });
      }

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

      // If Cognito requires email verification, send our custom verification email
      if (cognitoResult.needsVerification) {
        // Generate and store our own verification code
        const { VerificationEmailService } = await import('./verification-email-service');
        const verificationCode = VerificationEmailService.generateVerificationCode();
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours (2 days) from now
        
        // Store verification code in our database
        await storage.createVerificationCode(email, verificationCode, expiresAt);
        
        // Send verification email with both code and link
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? `https://${req.get('host')}`
          : `http://${req.get('host')}`;
          
        const fullName = finalFirstName && finalLastName 
          ? `${finalFirstName} ${finalLastName}`
          : (name || email.split('@')[0]);
          
        const emailSent = await VerificationEmailService.sendVerificationEmail(
          email,
          fullName,
          verificationCode,
          baseUrl
        );
        
        if (!emailSent) {
          logger.error('Failed to send verification email', { email });
          return res.status(500).json({
            message: "Registration successful, but we couldn't send the verification email. Please try again later."
          });
        }
        
        logger.info('Custom verification email sent successfully', { 
          email,
          codePrefix: verificationCode.substring(0, 2)
        });
        
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
    logger.info("Custom verify email endpoint hit");
    
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({
          message: "Email and verification code are required"
        });
      }
      
      // Check our custom verification code
      const verificationResult = await storage.getVerificationCode(email, code);
      
      if (!verificationResult) {
        return res.status(400).json({
          message: "Invalid verification code. Please try again."
        });
      }
      
      if (verificationResult.verified) {
        return res.status(400).json({
          message: "This verification code has already been used."
        });
      }
      
      if (verificationResult.expired) {
        return res.status(400).json({
          message: "Verification code has expired. Please request a new one."
        });
      }
      
      // Mark our code as used
      await storage.markVerificationCodeAsUsed(email, code);
      
      // Now verify the user in AWS Cognito using a dummy confirmation
      // Since Cognito codes expire immediately, we'll try to confirm with our code
      // If that fails, we'll use admin operations to confirm the user
      try {
        await cognitoAuth.confirmSignUp(email, code);
      } catch (cognitoError: any) {
        logger.info('Cognito confirmation failed, using admin confirmation', { 
          email, 
          cognitoError: cognitoError.message 
        });
        
        // Use admin API to confirm the user in Cognito
        try {
          await cognitoAuth.adminConfirmSignUp(email);
          logger.info('User confirmed via admin API', { email });
        } catch (adminError: any) {
          logger.error('Admin confirmation also failed', { 
            email, 
            adminError: adminError.message 
          });
          
          // Don't fail the request - the user is verified in our system
          logger.info('Proceeding with verification despite Cognito issues', { email });
        }
      }
      
      // Mark user as verified in our database
      await storage.markUserAsVerified(email);
      
      logger.info('Email verification completed successfully', { email });
      
      res.json({
        message: "Email verified successfully. You can now log in."
      });
    } catch (error: any) {
      logger.error('Custom verify email error', { 
        email: req.body.email,
        errorMessage: error.message 
      });
      
      res.status(400).json({
        message: "Email verification failed. Please try again."
      });
    }
  });

  // Resend verification code endpoint
  app.post("/api/resend-verification", sensitiveEndpointLimiter, responseSanitizationMiddleware, async (req, res) => {
    logger.info("Custom resend verification endpoint hit");
    
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          message: "Email is required"
        });
      }
      
      // Get user information for personalized email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({
          message: "User not found. Please register first."
        });
      }
      
      if (user.emailVerified) {
        return res.status(400).json({
          message: "Email is already verified. You can log in."
        });
      }
      
      // Generate new verification code with extended expiration (48 hours)
      const { VerificationEmailService } = await import('./verification-email-service');
      const verificationCode = VerificationEmailService.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours (2 days) from now
      
      // Store verification code in our database
      await storage.createVerificationCode(email, verificationCode, expiresAt);
      
      // Send verification email with both code and link
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${req.get('host')}`
        : `http://${req.get('host')}`;
        
      const fullName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : (user.name || email.split('@')[0]);
        
      const emailSent = await VerificationEmailService.sendVerificationEmail(
        email,
        fullName,
        verificationCode,
        baseUrl
      );
      
      if (!emailSent) {
        logger.error('Failed to resend verification email', { email });
        return res.status(500).json({
          message: "Failed to send verification email. Please try again later."
        });
      }
      
      logger.info('Custom verification email resent successfully', { 
        email,
        codePrefix: verificationCode.substring(0, 2)
      });
      
      res.json({
        message: "Verification email has been resent. Please check your inbox. The link is valid for 48 hours."
      });
    } catch (error: any) {
      logger.error('Custom resend verification error', { 
        email: req.body.email,
        errorMessage: error.message 
      });
      
      res.status(400).json({
        message: error.message || "Failed to resend verification code. Please try again."
      });
    }
  });

  // Get verification link endpoint (for clickable links in emails)
  app.get("/verify-email", async (req, res) => {
    try {
      const { token, email, code } = req.query as { token: string; email: string; code: string };
      
      logger.info("Email verification attempt", { 
        hasToken: !!token, 
        hasEmail: !!email, 
        hasCode: !!code,
        email: email || 'missing',
        codePrefix: code ? code.substring(0, 2) : 'missing'
      });
      
      if (!token || !email || !code) {
        logger.warn("Verification link missing required parameters", { token: !!token, email: !!email, code: !!code });
        return res.redirect(`/?error=${encodeURIComponent('Invalid verification link')}`);
      }
      
      // Verify the token
      const { VerificationEmailService } = await import('./verification-email-service');
      const isValidToken = VerificationEmailService.verifyToken(token, email, code);
      
      logger.info("Token verification result", { 
        email, 
        codePrefix: code.substring(0, 2),
        isValidToken,
        tokenLength: token.length
      });
      
      if (!isValidToken) {
        logger.warn("Token verification failed", { email, codePrefix: code.substring(0, 2) });
        return res.redirect(`/?error=${encodeURIComponent('Invalid verification link')}`);
      }
      
      // Check our custom verification code
      const verificationResult = await storage.getVerificationCode(email, code);
      
      if (!verificationResult) {
        return res.redirect(`/?error=${encodeURIComponent('Verification code not found')}`);
      }
      
      if (verificationResult.verified) {
        return res.redirect(`/?message=${encodeURIComponent('Email already verified. You can log in.')}`);
      }
      
      if (verificationResult.expired) {
        return res.redirect(`/?error=${encodeURIComponent('Verification link has expired')}`);
      }
      
      // Mark our code as used
      await storage.markVerificationCodeAsUsed(email, code);
      
      // Verify user in AWS Cognito
      try {
        await cognitoAuth.confirmSignUp(email, code);
      } catch (cognitoError: any) {
        logger.info('Cognito confirmation failed, using admin confirmation for link verification', { 
          email, 
          cognitoError: cognitoError.message 
        });
        
        try {
          await cognitoAuth.adminConfirmSignUp(email);
          logger.info('User confirmed via admin API (link verification)', { email });
        } catch (adminError: any) {
          logger.error('Admin confirmation failed for link verification', { 
            email, 
            adminError: adminError.message 
          });
        }
      }
      
      // Mark user as verified in our database
      await storage.markUserAsVerified(email);
      
      logger.info('Email verification completed successfully via link', { email });
      
      // Redirect to success page
      res.redirect(`/?message=${encodeURIComponent('Email verified successfully! You can now log in.')}`);
      
    } catch (error: any) {
      logger.error('Verification link error', { 
        email: req.query.email,
        errorMessage: error.message 
      });
      
      res.redirect(`/?error=${encodeURIComponent('Verification failed. Please try again.')}`);
    }
  });
}