/**
 * Profile, settings, and user account routes
 * Handles user profile management, settings, password reset, support, and notification preferences
 */

import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { userBranding } from "@shared/schema";
import { upload, forgotPasswordLimiter, readFileFromDisk, cleanupTempFile } from "../route-utils";
import { imageManager } from "../image-manager";
import { invalidateUserCache } from "../auth";
import { escapeHtml } from "../utils/sanitize-filename";

export function registerProfileSettingsRoutes(app: Express) {
  // ========== Profile Routes ==========

  app.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log("=== PROFILE API DEBUG START ===");
      console.log("User from database:", {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        profilePhoto: user.profilePhoto,
        subscriptionStatus: user.subscriptionStatus
      });

      // SECURITY: Return only profile-specific fields, excluding sensitive data
      const profileData = {
        name: user.name,
        title: user.title,
        phoneNumber: user.phoneNumber,
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        profilePhoto: user.profilePhoto,
        email: user.email,
        brandColors: user.brandColors,
        pdfPrimaryColor: user.pdfPrimaryColor,
        pdfSecondaryColor: user.pdfSecondaryColor,
        brandedPdfTemplate: user.brandedPdfTemplate,
        customSubdomain: user.customSubdomain,
        timezone: user.timezone
      };

      console.log("Profile data being returned:", profileData);
      console.log("=== PROFILE API DEBUG END ===");

      res.json(profileData);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.put("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Add request timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`Profile update timeout for user ${req.user!.id}`);
        res.status(504).json({ error: "Profile update request timeout" });
      }
    }, 30000);

    try {
      const { name, title, phoneNumber, businessName, businessLogo, profilePhoto, customSubdomain, timezone } = req.body;

      // Validate input data
      if (typeof name !== 'string' && name !== undefined ||
          typeof title !== 'string' && title !== undefined ||
          typeof phoneNumber !== 'string' && phoneNumber !== undefined ||
          typeof businessName !== 'string' && businessName !== undefined ||
          typeof customSubdomain !== 'string' && customSubdomain !== undefined ||
          typeof timezone !== 'string' && timezone !== undefined) {
        clearTimeout(timeout);
        return res.status(400).json({ error: "Invalid input data types" });
      }

      // Validate timezone if provided (must be valid IANA timezone)
      if (timezone) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone });
        } catch (e) {
          clearTimeout(timeout);
          return res.status(400).json({ error: "Invalid timezone", message: "Please select a valid timezone" });
        }
      }

      // Validate custom subdomain format if provided
      let processedSubdomain = customSubdomain;
      if (customSubdomain) {
        // Must be 3-32 chars, lowercase alphanumeric and hyphens only, no leading/trailing hyphens
        const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$|^[a-z0-9]{1,2}$/;
        if (!subdomainRegex.test(customSubdomain)) {
          clearTimeout(timeout);
          return res.status(400).json({
            error: "Invalid subdomain format",
            message: "Subdomain must be 1-32 characters, using only lowercase letters, numbers, and hyphens"
          });
        }

        // Check for reserved subdomains
        const reservedSubdomains = ['www', 'app', 'api', 'mail', 'admin', 'support', 'help', 'blog', 'docs', 'status'];
        if (reservedSubdomains.includes(customSubdomain)) {
          clearTimeout(timeout);
          return res.status(400).json({
            error: "Reserved subdomain",
            message: "This subdomain is reserved and cannot be used"
          });
        }

        // Check if subdomain is already taken by another user
        const existingUser = await storage.getUserBySubdomain(customSubdomain);
        if (existingUser && existingUser.id !== req.user!.id) {
          clearTimeout(timeout);
          return res.status(409).json({
            error: "Subdomain already taken",
            message: "This subdomain is already in use by another account"
          });
        }
      }

      // Process images with size limits and better error handling
      let processedBusinessLogo = businessLogo;
      let processedProfilePhoto = profilePhoto;

      // Track if we need to extract brand colors from a new logo upload
      let extractedBrandColors: string[] | null = null;

      // Handle logo removal - sync to eSignature branding
      if (businessLogo === "" || businessLogo === null) {
        try {
          const [existingBranding] = await db
            .select()
            .from(userBranding)
            .where(eq(userBranding.userId, req.user!.id))
            .limit(1);

          if (existingBranding) {
            await db
              .update(userBranding)
              .set({ logoUrl: null, updatedAt: new Date() })
              .where(eq(userBranding.userId, req.user!.id));
            console.log('Synced logo removal to e-signature settings');
          }
        } catch (syncError) {
          console.warn('E-signature branding logo removal sync failed:', syncError);
        }
        processedBusinessLogo = null;
      }

      // Process business logo if it's a new upload - save as file instead of base64
      if (businessLogo && businessLogo.startsWith('data:image/')) {
        try {
          // Check size limit (increased to 10MB base64 for better handling)
          if (businessLogo.length > 10 * 1024 * 1024) {
            clearTimeout(timeout);
            return res.status(413).json({
              error: "Business logo file too large",
              message: "Please use an image smaller than 7MB"
            });
          }

          const base64Data = businessLogo.split(',')[1];
          if (!base64Data) {
            throw new Error("Invalid base64 data format");
          }

          const imageBuffer = Buffer.from(base64Data, 'base64');

          // Extract brand colors from the logo
          try {
            const { extractBrandColors } = await import('../services/brand-color-extractor');
            const colors = await extractBrandColors(imageBuffer);
            extractedBrandColors = colors.colors;
            console.log('Extracted brand colors from logo:', extractedBrandColors);

            // Sync primary brand color to e-signature branding settings
            if (extractedBrandColors.length > 0) {
              const primaryColor = extractedBrandColors[0];
              try {
                // Check if user has existing e-signature branding
                const [existingBranding] = await db
                  .select()
                  .from(userBranding)
                  .where(eq(userBranding.userId, req.user!.id))
                  .limit(1);

                if (existingBranding) {
                  // Update existing branding with primary color (logo will be synced after file save)
                  await db
                    .update(userBranding)
                    .set({ primaryColor, updatedAt: new Date() })
                    .where(eq(userBranding.userId, req.user!.id));
                } else {
                  // Create new branding entry with primary color (logo will be synced after file save)
                  await db.insert(userBranding).values({
                    userId: req.user!.id,
                    primaryColor,
                    companyName: businessName || null,
                  });
                }
                console.log('Synced primary brand color to e-signature settings:', primaryColor);
              } catch (syncError) {
                console.warn('E-signature branding sync failed:', syncError);
                // Continue - this is not a critical failure
              }
            }
          } catch (colorError) {
            console.warn('Brand color extraction failed:', colorError);
            // Continue without brand colors - not a critical failure
          }

          // Save as persistent file instead of base64 data
          try {
            const logoMetadata = await imageManager.saveImageFromBuffer(
              imageBuffer,
              `logo_${req.user!.id}_${Date.now()}.png`,
              'image/png',
              req.user!.id,
              'logos'
            );
            // Add cache-busting timestamp to prevent browser caching old image
            const logoUrlWithCacheBust = `${logoMetadata.publicPath}?t=${Date.now()}`;
            processedBusinessLogo = logoUrlWithCacheBust;
            console.log('Business logo saved as file:', logoUrlWithCacheBust);

            // Also sync the logo to e-signature branding settings
            try {
              const [existingBranding] = await db
                .select()
                .from(userBranding)
                .where(eq(userBranding.userId, req.user!.id))
                .limit(1);

              if (existingBranding) {
                await db
                  .update(userBranding)
                  .set({ logoUrl: logoUrlWithCacheBust, updatedAt: new Date() })
                  .where(eq(userBranding.userId, req.user!.id));
              } else {
                await db.insert(userBranding).values({
                  userId: req.user!.id,
                  logoUrl: logoUrlWithCacheBust,
                  companyName: businessName || null,
                });
              }
              console.log('Synced logo to e-signature settings:', logoUrlWithCacheBust);
            } catch (logoSyncError) {
              console.warn('E-signature logo sync failed:', logoSyncError);
              // Continue - this is not a critical failure
            }
          } catch (processingError) {
            console.warn('Logo file save failed, falling back to base64:', processingError);
            processedBusinessLogo = businessLogo;
          }
        } catch (error) {
          console.error('Business logo processing error:', error);
          clearTimeout(timeout);
          return res.status(400).json({
            error: "Invalid image format",
            message: "Please upload a valid image file"
          });
        }
      }

      // Process profile photo if it's a new upload - save as file instead of base64
      if (profilePhoto && profilePhoto.startsWith('data:image/')) {
        try {
          // Check size limit (increased to 10MB base64 for better handling)
          if (profilePhoto.length > 10 * 1024 * 1024) {
            clearTimeout(timeout);
            return res.status(413).json({
              error: "Profile photo file too large",
              message: "Please use an image smaller than 7MB"
            });
          }

          const base64Data = profilePhoto.split(',')[1];
          if (!base64Data) {
            throw new Error("Invalid base64 data format");
          }

          const imageBuffer = Buffer.from(base64Data, 'base64');

          // Save as persistent file instead of base64 data
          try {
            const photoMetadata = await imageManager.saveImageFromBuffer(
              imageBuffer,
              `profile_${req.user!.id}_${Date.now()}.png`,
              'image/png',
              req.user!.id,
              'profile-photos'
            );
            processedProfilePhoto = photoMetadata.publicPath; // Use file path instead of base64
            console.log('Profile photo saved as file:', photoMetadata.publicPath);
          } catch (processingError) {
            console.warn('Profile photo file save failed, falling back to base64:', processingError);
            processedProfilePhoto = profilePhoto;
          }
        } catch (error) {
          console.error('Profile photo processing error:', error);
          clearTimeout(timeout);
          return res.status(400).json({
            error: "Invalid image format",
            message: "Please upload a valid image file"
          });
        }
      }

      // Update user profile in database
      const profileUpdate: any = {
        name,
        title,
        phoneNumber,
        businessName,
        businessLogo: processedBusinessLogo,
        profilePhoto: processedProfilePhoto,
        customSubdomain: processedSubdomain || null,
        timezone: timezone || undefined
      };

      // Add brand colors if we extracted them from a new logo
      if (extractedBrandColors && extractedBrandColors.length > 0) {
        profileUpdate.brandColors = extractedBrandColors;
      }

      const updatedUser = await storage.updateUserProfile(req.user!.id, profileUpdate);

      // Invalidate user cache to ensure fresh data on next request
      invalidateUserCache(req.user!.id);

      clearTimeout(timeout);

      // Return sanitized response - explicitly excluding sensitive fields
      res.json({
        name: updatedUser.name,
        title: updatedUser.title,
        phoneNumber: updatedUser.phoneNumber,
        businessName: updatedUser.businessName,
        businessLogo: updatedUser.businessLogo,
        profilePhoto: updatedUser.profilePhoto,
        customSubdomain: updatedUser.customSubdomain,
        brandColors: updatedUser.brandColors,
        brandedPdfTemplate: updatedUser.brandedPdfTemplate,
        timezone: updatedUser.timezone,
        email: updatedUser.email
        // Explicitly omitting: password, stripeCustomerId, subscriptionId, googleTokens, etc.
      });
    } catch (error) {
      clearTimeout(timeout);

      console.error('Profile update error:', error);

      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('pool') || error.message.includes('connection')) {
          return res.status(503).json({
            error: "Database connection error",
            message: "Service temporarily unavailable"
          });
        }

        if (error.message.includes('timeout')) {
          return res.status(504).json({
            error: "Request timeout",
            message: "Profile update took too long"
          });
        }

        if (error.message.includes('size') || error.message.includes('large')) {
          return res.status(400).json({
            error: "File too large",
            message: "Please use smaller images"
          });
        }
      }

      res.status(500).json({
        error: "Failed to update profile",
        message: "Please try again later"
      });
    }
  });

  // ========== Branded PDF & Display Settings Routes ==========

  // Branded PDF template preference endpoint
  app.put("/api/user/branded-pdf-template", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { brandedPdfTemplate } = req.body;

      // Validate template option
      const validTemplates = ['none', 'watermark', 'footer', 'accent', 'full'];
      if (!validTemplates.includes(brandedPdfTemplate)) {
        return res.status(400).json({
          error: "Invalid template option",
          message: "Please select a valid template option"
        });
      }

      // Update user's branded PDF template preference
      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        brandedPdfTemplate
      });

      // Invalidate user cache
      invalidateUserCache(req.user!.id);

      res.json({
        brandedPdfTemplate: updatedUser.brandedPdfTemplate,
        message: "Branded PDF template updated successfully"
      });
    } catch (error) {
      console.error('Branded PDF template update error:', error);
      res.status(500).json({
        error: "Failed to update template preference",
        message: "Please try again later"
      });
    }
  });

  // PDF branding colors endpoint
  app.put("/api/user/pdf-branding-colors", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { pdfPrimaryColor, pdfSecondaryColor } = req.body;

      // Validate hex color format
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      const updates: any = {};

      if (pdfPrimaryColor !== undefined) {
        if (pdfPrimaryColor === null || pdfPrimaryColor === '') {
          updates.pdfPrimaryColor = null;
        } else if (hexColorRegex.test(pdfPrimaryColor)) {
          updates.pdfPrimaryColor = pdfPrimaryColor;
        } else {
          return res.status(400).json({
            error: "Invalid primary color",
            message: "Primary color must be a valid hex color (e.g., #FF5733)"
          });
        }
      }

      if (pdfSecondaryColor !== undefined) {
        if (pdfSecondaryColor === null || pdfSecondaryColor === '') {
          updates.pdfSecondaryColor = null;
        } else if (hexColorRegex.test(pdfSecondaryColor)) {
          updates.pdfSecondaryColor = pdfSecondaryColor;
        } else {
          return res.status(400).json({
            error: "Invalid secondary color",
            message: "Secondary color must be a valid hex color (e.g., #FF5733)"
          });
        }
      }

      // Update user's PDF branding colors
      const updatedUser = await storage.updateUserProfile(req.user!.id, updates);

      // Invalidate user cache
      invalidateUserCache(req.user!.id);

      res.json({
        pdfPrimaryColor: updatedUser.pdfPrimaryColor,
        pdfSecondaryColor: updatedUser.pdfSecondaryColor,
        message: "PDF branding colors updated successfully"
      });
    } catch (error) {
      console.error('PDF branding colors update error:', error);
      res.status(500).json({
        error: "Failed to update branding colors",
        message: "Please try again later"
      });
    }
  });

  // Save default display settings for new documents
  app.put("/api/user/default-display-settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { theme, sectionStyle, contactPosition, customColor, customColorSecondary } = req.body;

      // Validate theme
      const validThemes = ['corporate-blue', 'forest-green', 'charcoal', 'burgundy', 'brand', 'custom'];
      if (theme && !validThemes.includes(theme)) {
        return res.status(400).json({ error: "Invalid theme" });
      }

      // Validate sectionStyle
      const validStyles = ['cards', 'minimal'];
      if (sectionStyle && !validStyles.includes(sectionStyle)) {
        return res.status(400).json({ error: "Invalid section style" });
      }

      // Validate contactPosition
      const validPositions = ['sidebar', 'bottom'];
      if (contactPosition && !validPositions.includes(contactPosition)) {
        return res.status(400).json({ error: "Invalid contact position" });
      }

      // Validate custom colors if provided
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (customColor && !hexColorRegex.test(customColor)) {
        return res.status(400).json({ error: "Invalid custom color format" });
      }
      if (customColorSecondary && !hexColorRegex.test(customColorSecondary)) {
        return res.status(400).json({ error: "Invalid custom secondary color format" });
      }

      const defaultDisplaySettings = {
        theme: theme || 'corporate-blue',
        sectionStyle: sectionStyle || 'cards',
        contactPosition: contactPosition || 'sidebar',
        ...(customColor && { customColor }),
        ...(customColorSecondary && { customColorSecondary })
      };

      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        defaultDisplaySettings
      });

      // Invalidate user cache
      invalidateUserCache(req.user!.id);

      res.json({
        defaultDisplaySettings: updatedUser.defaultDisplaySettings,
        message: "Default display settings saved successfully"
      });
    } catch (error) {
      console.error('Default display settings update error:', error);
      res.status(500).json({
        error: "Failed to save default display settings",
        message: "Please try again later"
      });
    }
  });

  // ========== Settings Routes ==========

  app.get("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Return user settings for the settings page
      const settingsData = {
        fullName: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        profilePhoto: user.profilePhoto,
        companyName: user.businessName,
        companyLogo: user.businessLogo,
        // Default UI settings
        emailNotifications: true,
        documentCompleted: true,
        reminderEmails: false,
        twoFactorAuth: false,
        primaryColor: "#2563eb",
        secondaryColor: "#64748b",
        customEmailTemplate: true,
        brandingOnSigningPage: true,
        customFooterText: `Powered by ${user.businessName || user.name || 'Your Company'}`
      };

      res.json(settingsData);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`Settings update timeout for user ${req.user!.id}`);
        res.status(504).json({ error: "Settings update request timeout" });
      }
    }, 30000);

    try {
      const {
        fullName,
        phoneNumber,
        businessName,
        businessLogo,
        profilePhoto,
        companyName,
        companyLogo
      } = req.body;

      // Validate input data
      if (typeof fullName !== 'string' && fullName !== undefined ||
          typeof phoneNumber !== 'string' && phoneNumber !== undefined ||
          typeof businessName !== 'string' && businessName !== undefined ||
          typeof companyName !== 'string' && companyName !== undefined) {
        clearTimeout(timeout);
        return res.status(400).json({ error: "Invalid input data types" });
      }

      // Process images if they are new uploads
      let processedBusinessLogo = businessLogo || companyLogo;
      let processedProfilePhoto = profilePhoto;

      // Process business logo if it's a new upload
      if (processedBusinessLogo && processedBusinessLogo.startsWith('data:image/')) {
        try {
          if (processedBusinessLogo.length > 10 * 1024 * 1024) {
            clearTimeout(timeout);
            return res.status(413).json({
              error: "Business logo file too large",
              message: "Please use an image smaller than 7MB"
            });
          }

          const base64Data = processedBusinessLogo.split(',')[1];
          if (!base64Data) {
            throw new Error("Invalid base64 data format");
          }

          const imageBuffer = Buffer.from(base64Data, 'base64');

          try {
            const logoMetadata = await imageManager.saveImageFromBuffer(
              imageBuffer,
              `logo_${req.user!.id}_${Date.now()}.png`,
              'image/png',
              req.user!.id,
              'logos'
            );
            processedBusinessLogo = logoMetadata.publicPath;
            console.log('Business logo saved as file:', logoMetadata.publicPath);
          } catch (processingError) {
            console.warn('Logo file save failed, falling back to base64:', processingError);
            processedBusinessLogo = businessLogo || companyLogo;
          }
        } catch (error) {
          console.error('Business logo processing error:', error);
          clearTimeout(timeout);
          return res.status(400).json({
            error: "Invalid image format",
            message: "Please upload a valid image file"
          });
        }
      }

      // Process profile photo if it's a new upload
      if (processedProfilePhoto && processedProfilePhoto.startsWith('data:image/')) {
        try {
          if (processedProfilePhoto.length > 10 * 1024 * 1024) {
            clearTimeout(timeout);
            return res.status(413).json({
              error: "Profile photo file too large",
              message: "Please use an image smaller than 7MB"
            });
          }

          const base64Data = processedProfilePhoto.split(',')[1];
          if (!base64Data) {
            throw new Error("Invalid base64 data format");
          }

          const imageBuffer = Buffer.from(base64Data, 'base64');

          try {
            const photoMetadata = await imageManager.saveImageFromBuffer(
              imageBuffer,
              `profile_${req.user!.id}_${Date.now()}.png`,
              'image/png',
              req.user!.id,
              'profile-photos'
            );
            processedProfilePhoto = photoMetadata.publicPath;
            console.log('Profile photo saved as file:', photoMetadata.publicPath);
          } catch (processingError) {
            console.warn('Profile photo file save failed, falling back to base64:', processingError);
            processedProfilePhoto = profilePhoto;
          }
        } catch (error) {
          console.error('Profile photo processing error:', error);
          clearTimeout(timeout);
          return res.status(400).json({
            error: "Invalid image format",
            message: "Please upload a valid image file"
          });
        }
      }

      // Update user profile in database using the existing updateUserProfile method
      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        name: fullName,
        phoneNumber,
        businessName: businessName || companyName,
        businessLogo: processedBusinessLogo,
        profilePhoto: processedProfilePhoto
      });

      clearTimeout(timeout);

      // Return updated settings data
      const updatedSettings = {
        fullName: updatedUser.name,
        phoneNumber: updatedUser.phoneNumber,
        businessName: updatedUser.businessName,
        businessLogo: updatedUser.businessLogo,
        profilePhoto: updatedUser.profilePhoto,
        companyName: updatedUser.businessName,
        companyLogo: updatedUser.businessLogo
      };

      res.json({
        success: true,
        message: "Settings updated successfully",
        settings: updatedSettings
      });
    } catch (error: any) {
      clearTimeout(timeout);
      console.error("Settings update error:", error);

      // Handle specific error types
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          error: "Database connection failed",
          message: "Service temporarily unavailable"
        });
      }

      res.status(500).json({
        error: "Failed to update settings",
        message: "Please try again later"
      });
    }
  });

  // ========== Password Reset Routes ==========

  app.post("/api/forgot-password", forgotPasswordLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      const success = await storage.createPasswordResetToken(email, resetToken, expiry);

      if (success) {
        // Send password reset email using SendGrid
        const { sendPasswordResetEmail } = await import("../email");
        const emailSent = await sendPasswordResetEmail(email, resetToken);

        // Security: Don't log sensitive password reset tokens
        console.log(`Password reset email sent to ${email}: ${emailSent}`);
      }

      // Security: Always return success message, even if email doesn't exist
      // Use a small delay to normalize response time and prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      return res.json({ message: "If an account with that email exists, a reset link has been sent." });
    } catch (error) {
      console.error("Password reset error:", error);
      // Still normalize timing on error to prevent information leakage
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Password reset completion route
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
      }

      // Verify the reset token and get user
      const user = await storage.verifyPasswordResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      // Hash the new password using the consistent auth method
      const { hashPassword } = await import("../auth");
      const hashedPassword = await hashPassword(password);

      // Update the user's password
      await storage.updateUserPassword(user.id, hashedPassword);

      // Clear the reset token
      await storage.clearPasswordResetToken(user.id);

      console.log(`Password successfully reset for user: ${user.email}`);
      res.json({ message: "Password reset successfully" });

    } catch (error) {
      console.error("Password reset completion error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // SECURITY: Direct password reset endpoint disabled for production
  // This endpoint poses a severe security risk as it bypasses normal password reset flow
  /*
  app.post("/api/direct-password-reset", async (req, res) => {
    // This endpoint has been disabled for security reasons
    res.status(404).json({ error: "Endpoint not found" });
  });
  */

  // ========== User Account Update Route ==========

  // User account update route (email and password)
  app.post("/api/user/update", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { email, currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      // Verify current password is provided
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required for account changes" });
      }

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const { comparePasswords } = await import("../auth");
      const isValidPassword = await comparePasswords(currentPassword, user.password);

      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      let changes = [];

      // Update email if provided and different
      if (email && email !== user.email) {
        // Check if email already exists
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: "Email address is already in use by another account" });
        }

        await storage.updateUserEmail(userId, email);
        changes.push("email address");
      }

      // Update password if provided and not empty
      if (newPassword && newPassword.trim().length > 0) {
        const { hashPassword } = await import("../auth");
        const hashedPassword = await hashPassword(newPassword);
        await storage.updateUserPassword(userId, hashedPassword);
        changes.push("password");
      }

      // Return appropriate message based on what was changed
      if (changes.length === 0) {
        return res.status(400).json({ error: "No changes were made. Please update your email or password." });
      }

      const message = changes.length === 1
        ? `Your ${changes[0]} has been updated successfully`
        : `Your ${changes.join(' and ')} have been updated successfully`;

      res.json({ message });
    } catch (error) {
      console.error("Error updating user account:", error);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  // ========== Support Contact Form ==========

  app.post("/api/support", upload.fields([
    { name: 'attachment_0', maxCount: 1 },
    { name: 'attachment_1', maxCount: 1 },
    { name: 'attachment_2', maxCount: 1 },
    { name: 'attachment_3', maxCount: 1 },
    { name: 'attachment_4', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const { subject, message, email } = req.body;

      if (!subject || !message || !email) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Sanitize user inputs to prevent HTML injection
      const safeEmail = escapeHtml(email);
      const safeSubject = escapeHtml(subject);
      const safeMessage = escapeHtml(message);

      // Prepare email content with sanitized inputs
      let emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Support Request from Broker Vault</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>From:</strong> ${safeEmail}</p>
            <p><strong>Subject:</strong> ${safeSubject}</p>
          </div>
          <div style="background-color: white; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h3>Message:</h3>
            <p style="white-space: pre-wrap;">${safeMessage}</p>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This message was sent through the Broker Vault support form.
          </p>
        </div>
      `;

      // Prepare attachments from multiple file uploads
      let attachments: any[] = [];
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (files) {
        for (let i = 0; i < 5; i++) {
          const fieldName = `attachment_${i}`;
          if (files[fieldName] && files[fieldName][0]) {
            const file = files[fieldName][0];
            const fileBuffer = await readFileFromDisk(file);
            attachments.push({
              content: fileBuffer.toString('base64'),
              filename: file.originalname,
              type: file.mimetype,
              disposition: 'attachment'
            });
            await cleanupTempFile(file);
          }
        }
      }

      // Send email using existing email service
      const { sendEmail } = await import("../email");
      const emailSent = await sendEmail({
        to: 'system@brokervault.ai',
        from: 'system@brokervault.ai', // Verified sender
        replyTo: email, // User's email as reply-to
        subject: `Support Request: ${subject}`,
        html: emailHtml,
        text: `Support Request from ${email}\n\nSubject: ${subject}\n\nMessage:\n${message}`,
        attachments: attachments.length > 0 ? attachments : undefined
      });

      if (emailSent) {
        res.json({ message: "Support message sent successfully" });
      } else {
        throw new Error("Failed to send email");
      }
    } catch (error) {
      console.error("Support form error:", error);
      res.status(500).json({ error: "Failed to send support message" });
    }
  });

  // ========== Notification Preferences Routes ==========

  // Get current user's notification preferences
  app.get("/api/user/notification-preferences", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = (req.user as any).id;
      let preferences = await storage.getNotificationPreferences(userId);

      // If no preferences exist, return defaults
      if (!preferences) {
        preferences = {
          id: 0,
          userId,
          // Email defaults
          emailMentions: true,
          emailTaskAssigned: true,
          emailTaskReminder: true,
          emailDealUpdates: false,
          emailTeamInvites: true,
          emailEsignRequests: true,
          emailEsignCompleted: true,
          emailWeeklyDigest: false,
          // In-app defaults
          inappMentions: true,
          inappTaskAssigned: true,
          inappTaskReminder: true,
          inappDealUpdates: true,
          inappEsignRequests: true,
          inappEsignCompleted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ error: "Failed to fetch notification preferences" });
    }
  });

  // Update user's notification preferences
  app.put("/api/user/notification-preferences", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = (req.user as any).id;
      const updates = req.body;

      // Validate the fields - only allow known preference fields
      const allowedFields = [
        'emailMentions', 'emailTaskAssigned', 'emailTaskReminder', 'emailDealUpdates',
        'emailTeamInvites', 'emailEsignRequests', 'emailEsignCompleted', 'emailWeeklyDigest',
        'inappMentions', 'inappTaskAssigned', 'inappTaskReminder', 'inappDealUpdates',
        'inappEsignRequests', 'inappEsignCompleted'
      ];

      const filteredUpdates: Record<string, boolean> = {};
      for (const key of allowedFields) {
        if (key in updates && typeof updates[key] === 'boolean') {
          filteredUpdates[key] = updates[key];
        }
      }

      const preferences = await storage.upsertNotificationPreferences(userId, filteredUpdates);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });
}
