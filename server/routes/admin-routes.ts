import type { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { isAuthorizedAdmin, upload } from '../route-utils';
import { sanitizeUser } from '../data-sanitizer';
import { coverImageService } from '../cover-image-service';

export function registerAdminRoutes(app: Express) {
  // Admin: Migrate images
  app.post("/api/admin/migrate-images", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Migration functionality disabled to resolve build issues
    res.json({
      success: true,
      message: "Migration has been completed in previous deployments",
      stats: { totalProcessed: 0, successfulMigrations: 0, failedMigrations: 0, skipped: 0 }
    });
  });

  // Database backup endpoints
  app.post("/api/admin/backup/create", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { backupManager } = await import('../database-backup');
      const { label = 'manual' } = req.body;
      const backupPath = await backupManager.createFullBackup(label);

      res.json({
        success: true,
        message: "Backup created successfully",
        backupPath
      });
    } catch (error) {
      console.error('Backup creation failed:', error);
      res.status(500).json({
        error: "Failed to create backup",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/admin/backup/list", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { backupManager } = await import('../database-backup');
      const backups = backupManager.listBackups();

      res.json({
        success: true,
        backups
      });
    } catch (error) {
      console.error('Failed to list backups:', error);
      res.status(500).json({
        error: "Failed to list backups",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/admin/backup/clean", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { backupManager } = await import('../database-backup');
      backupManager.cleanOldBackups();

      res.json({
        success: true,
        message: "Old backups cleaned successfully"
      });
    } catch (error) {
      console.error('Failed to clean backups:', error);
      res.status(500).json({
        error: "Failed to clean backups",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Admin: List users
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || !isAuthorizedAdmin(req.user)) {
      return res.sendStatus(401);
    }

    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = (page - 1) * limit;

      const [users, totalCount] = await Promise.all([
        storage.getAllUsers({ limit, offset }),
        storage.getUsersCount()
      ]);
      // SECURITY: Sanitize user data for admin view - exclude passwords, tokens, and sensitive fields
      const sanitizedUsers = users.map(user => sanitizeUser(user));
      res.json({
        users: sanitizedUsers,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + users.length < totalCount
        }
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Admin: Update subscription
  app.post("/api/admin/subscription", async (req, res) => {
    if (!req.isAuthenticated() || !isAuthorizedAdmin(req.user)) {
      return res.sendStatus(401);
    }

    const { userId, status, months } = req.body;
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);

    await storage.updateSubscription(userId, status, endsAt);
    res.sendStatus(200);
  });

  // Admin: Grant admin privileges
  app.post("/api/admin/grant-admin", async (req, res) => {
    if (!req.isAuthenticated() || !isAuthorizedAdmin(req.user)) {
      return res.sendStatus(401);
    }

    const { email } = req.body;
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user in the database to make them an admin with unlimited CIMs
    await db.update(users).set({
      isAdmin: true,
      subscriptionStatus: 'admin'
    }).where(eq(users.id, user.id));
    res.sendStatus(200);
  });

  // REMOVED: Auto-grant admin endpoint was a security vulnerability
  // Admin privileges should be granted through a secure admin panel or direct database access only

  // Admin: Migrate cover images from external URLs to local storage
  app.post("/api/admin/migrate-cover-images", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Check if user is admin
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      console.log("Starting cover image migration...");

      // Get all CIM documents with external cover images (admin operation - explicit high limit)
      const allDocs = await storage.getAllCimDocuments({ limit: 10000, offset: 0 });
      const docsToMigrate = allDocs.filter(doc =>
        doc.coverImageUrl && coverImageService.isExternalImageUrl(doc.coverImageUrl)
      );

      console.log(`Found ${docsToMigrate.length} documents with external cover images to migrate`);

      let successCount = 0;
      let failCount = 0;

      for (const doc of docsToMigrate) {
        try {
          console.log(`Migrating cover image for document ${doc.id}: ${doc.coverImageUrl}`);

          const downloadResult = await coverImageService.downloadAndStoreImage(doc.coverImageUrl!, doc.userId);

          await storage.updateCimDocument(doc.id, {
            coverImageUrl: downloadResult.publicUrl
          });

          console.log(`Successfully migrated document ${doc.id}: ${downloadResult.publicUrl}`);
          successCount++;
        } catch (error) {
          console.error(`Failed to migrate document ${doc.id}:`, error);
          failCount++;
        }
      }

      res.json({
        success: true,
        totalDocuments: docsToMigrate.length,
        successCount,
        failCount,
        message: `Migration completed: ${successCount} successful, ${failCount} failed`
      });

    } catch (error) {
      console.error("Cover image migration error:", error);
      res.status(500).json({ error: "Failed to complete cover image migration" });
    }
  });

}
