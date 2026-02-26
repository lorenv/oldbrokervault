import type { Express } from 'express';
import { storage } from '../storage';
import { insertCollaboratorSchema, subscriptionPlans } from '@shared/schema';
import {
  sendCollaborationInvitationEmail,
  sendCollaboratorRemovedEmail,
  sendEditLockTakenOverEmail,
} from '../email';

// Helper function for access control
async function getUserDocumentPermission(
  documentId: number,
  userId: number
): Promise<"owner" | "edit" | "assist" | null> {
  const document = await storage.getCimDocument(documentId);
  if (!document) return null;
  if (document.userId === userId) return "owner";

  const collaboration = await storage.getCollaboratorAccess(documentId, userId);
  if (collaboration?.permission === "Edit") return "edit";
  if (collaboration?.permission === "Assist") return "assist";

  return null;
}

export function registerCollaborationRoutes(app: Express) {
  // Start editing a document (acquire editing session)
  app.post("/api/cim/:id/start-editing", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;
      const userName = req.user!.name || req.user!.email;

      // Collaboration features are now available to all users
      const user = await storage.getUser(userId);

      // Check document access
      const doc = await storage.getCimDocument(docId);
      if (!doc) return res.sendStatus(404);

      // Check if user owns the document or is a collaborator
      let hasAccess = doc.userId === userId;
      if (!hasAccess) {
        const collaboratorAccess = await storage.getCollaboratorAccess(docId, userId);
        hasAccess = collaboratorAccess?.permission === 'edit';
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "No edit access to this document" });
      }

      const success = await storage.startEditing(docId, userId, userName);

      if (!success) {
        const updatedDoc = await storage.getCimDocument(docId);
        return res.status(409).json({
          error: "Document is currently being edited",
          currentEditor: updatedDoc?.currentEditorName,
          editStartedAt: updatedDoc?.editStartedAt
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Start editing error:", error);
      res.status(500).json({ error: "Failed to start editing" });
    }
  });

  // Stop editing a document (release lock)
  app.post("/api/cim/:id/stop-editing", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;

      await storage.stopEditing(docId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Stop editing error:", error);
      res.status(500).json({ error: "Failed to stop editing" });
    }
  });

  // Heartbeat to maintain editing session
  app.post("/api/cim/:id/heartbeat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;

      await storage.heartbeat(docId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Heartbeat error:", error);
      res.status(500).json({ error: "Failed to send heartbeat" });
    }
  });

  // Check editing status
  app.get("/api/cim/:id/editing-status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);

      if (!doc) return res.sendStatus(404);

      // Check if current editing session is active (within 5 minutes)
      let isBeingEdited = false;
      let currentEditor = null;

      if (doc.currentEditorId && doc.lastActivityAt) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (doc.lastActivityAt > fiveMinutesAgo) {
          isBeingEdited = true;
          currentEditor = {
            id: doc.currentEditorId,
            name: doc.currentEditorName,
            editStartedAt: doc.editStartedAt
          };
        }
      }

      res.json({
        isBeingEdited,
        currentEditor,
        canEdit: !isBeingEdited || doc.currentEditorId === req.user!.id
      });
    } catch (error) {
      console.error("Check editing status error:", error);
      res.status(500).json({ error: "Failed to check editing status" });
    }
  });

  // Invite collaborator
  app.post("/api/cim/:id/invite", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Collaboration features are now available to all users
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Validate request body
      const validation = insertCollaboratorSchema.safeParse({
        ...req.body,
        cimDocumentId: docId,
        invitedBy: userId
      });

      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors });
      }

      // Check document ownership
      const doc = await storage.getCimDocument(docId);
      if (!doc || doc.userId !== userId) {
        return res.status(403).json({ error: "Only document owner can invite collaborators" });
      }

      // Check subscription limits
      const currentCollaboratorCount = await storage.getCollaboratorCount(docId);
      const subscriptionPlan = subscriptionPlans[user.subscriptionStatus as keyof typeof subscriptionPlans] || subscriptionPlans.free;

      let collaboratorLimit = 0;
      switch (user.subscriptionStatus) {
        case 'starter':
          collaboratorLimit = 1;
          break;
        case 'standard':
          collaboratorLimit = 3;
          break;
        case 'enterprise':
        case 'admin':
          collaboratorLimit = 999; // Unlimited
          break;
        default:
          collaboratorLimit = 0; // Free users can't add collaborators
          break;
      }

      if (currentCollaboratorCount >= collaboratorLimit) {
        return res.status(403).json({
          error: "Collaborator limit reached for your subscription plan",
          limit: collaboratorLimit,
          current: currentCollaboratorCount
        });
      }

      const collaborator = await storage.inviteCollaborator(validation.data);

      // Send invitation email
      try {
        const inviteeName = validation.data.email.split('@')[0]; // Use email prefix if no name provided
        const inviterProfile = await storage.getUserProfile(userId);
        const inviterName = inviterProfile?.firstName
          ? `${inviterProfile.firstName}${inviterProfile.lastName ? ' ' + inviterProfile.lastName : ''}`
          : (inviterProfile?.name || inviterProfile?.email || 'Someone');

        await sendCollaborationInvitationEmail(
          validation.data.email,
          inviteeName,
          doc.title,
          inviterName,
          validation.data.permission,
          collaborator.inviteToken
        );
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Continue even if email fails - collaborator is already added
      }

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "collaborator_invited", {
        collaboratorEmail: validation.data.email,
        permission: validation.data.permission
      });

      res.json(collaborator);
    } catch (error) {
      console.error("Invite collaborator error:", error);
      res.status(500).json({ error: "Failed to invite collaborator", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get collaborators for a document
  app.get("/api/cim/:id/collaborators", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check document access
      const doc = await storage.getCimDocument(docId);
      if (!doc) return res.sendStatus(404);

      // Only owner or collaborators can see the collaborator list
      let hasAccess = doc.userId === userId;
      if (!hasAccess) {
        const collaboratorAccess = await storage.getCollaboratorAccess(docId, userId);
        hasAccess = !!collaboratorAccess;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "No access to this document" });
      }

      const collaborators = await storage.getCollaborators(docId);
      res.json(collaborators);
    } catch (error) {
      console.error("Get collaborators error:", error);
      res.status(500).json({ error: "Failed to get collaborators" });
    }
  });

  // Update collaborator permission
  app.patch("/api/cim/:docId/collaborators/:collaboratorId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const collaboratorId = parseInt(req.params.collaboratorId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner") {
        return res.status(403).json({ error: "Only document owner can update collaborator permissions" });
      }

      const { permission: newPermission } = req.body;
      if (!newPermission || !["Edit", "Assist"].includes(newPermission)) {
        return res.status(400).json({ error: "Invalid permission. Must be 'Edit' or 'Assist'" });
      }

      await storage.updateCollaborator(collaboratorId, { permission: newPermission });

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "collaborator_permission_changed", {
        collaboratorId,
        newPermission
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Update collaborator error:", error);
      res.status(500).json({ error: "Failed to update collaborator" });
    }
  });

  // Remove collaborator
  app.delete("/api/cim/:docId/collaborators/:collaboratorId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const collaboratorId = parseInt(req.params.collaboratorId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner") {
        return res.status(403).json({ error: "Only document owner can remove collaborators" });
      }

      const collaborators = await storage.getCollaborators(docId);
      const collaborator = collaborators.find(c => c.id === collaboratorId);

      if (!collaborator) {
        return res.status(404).json({ error: "Collaborator not found" });
      }

      const doc = await storage.getCimDocument(docId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      await storage.deleteCollaborator(collaboratorId);

      if (collaborator.userId) {
        await storage.releaseUserLocks(collaborator.userId, docId);
      }

      // Send removal email notification
      const collaboratorName = collaborator.email.split('@')[0];
      const removerProfile = await storage.getUserProfile(userId);
      const removerName = removerProfile?.firstName
        ? `${removerProfile.firstName}${removerProfile.lastName ? ' ' + removerProfile.lastName : ''}`
        : (removerProfile?.name || removerProfile?.email || 'The document owner');

      await sendCollaboratorRemovedEmail(
        collaborator.email,
        collaboratorName,
        doc.title,
        removerName
      );

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "collaborator_removed", {
        collaboratorId,
        collaboratorEmail: collaborator.email
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Remove collaborator error:", error);
      res.status(500).json({ error: "Failed to remove collaborator" });
    }
  });

  // Get pending invitations for current user
  app.get("/api/collaborator/pending", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const userEmail = req.user!.email;
      const pendingInvitations = await storage.getPendingInvitationsByEmail(userEmail);

      // Enrich with document details
      const enrichedInvitations = await Promise.all(
        pendingInvitations.map(async (invitation) => {
          const document = await storage.getCimDocument(invitation.cimDocumentId);
          const inviter = await storage.getUser(invitation.invitedBy);

          return {
            id: invitation.id,
            documentId: invitation.cimDocumentId,
            documentTitle: document?.title || "Unknown Document",
            inviterName: inviter?.firstName && inviter?.lastName
              ? `${inviter.firstName} ${inviter.lastName}`
              : (inviter?.name || inviter?.email || "Unknown"),
            inviterEmail: inviter?.email || "",
            permission: invitation.permission,
            invitedAt: invitation.invitedAt,
            inviteToken: invitation.inviteToken
          };
        })
      );

      res.json(enrichedInvitations);
    } catch (error) {
      console.error("Get pending invitations error:", error);
      res.status(500).json({ error: "Failed to get pending invitations" });
    }
  });

  // Get invitation details (public - no auth required)
  app.get("/api/collaborator/invitation/:token", async (req, res) => {
    try {
      const token = req.params.token;

      const collaborator = await storage.getCollaboratorByToken(token);
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }

      // Get document details
      const document = await storage.getCimDocument(collaborator.cimDocumentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get inviter details
      const inviter = await storage.getUser(collaborator.invitedBy);
      if (!inviter) {
        return res.status(404).json({ error: "Inviter not found" });
      }

      // Return public invitation info
      res.json({
        documentTitle: document.title,
        inviterName: inviter.firstName && inviter.lastName
          ? `${inviter.firstName} ${inviter.lastName}`
          : (inviter.name || inviter.email),
        inviterEmail: inviter.email,
        permission: collaborator.permission,
        invitedEmail: collaborator.email,
        status: collaborator.status,
        alreadyAccepted: collaborator.status === "active"
      });
    } catch (error) {
      console.error("Get invitation details error:", error);
      res.status(500).json({ error: "Failed to get invitation details" });
    }
  });

  // Accept collaboration invitation
  app.post("/api/collaborator/accept/:token", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const token = req.params.token;
      const userId = req.user!.id;

      const collaborator = await storage.getCollaboratorByToken(token);
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }

      if (collaborator.status === "active") {
        return res.status(400).json({ error: "Invitation already accepted" });
      }

      await storage.updateCollaborator(collaborator.id, {
        status: "active",
        acceptedAt: new Date(),
        userId
      });

      await storage.logActivity(collaborator.cimDocumentId, userId, req.user!.name || null, req.user!.email, "collaborator_accepted", {
        collaboratorId: collaborator.id
      });

      res.json({ success: true, documentId: collaborator.cimDocumentId });
    } catch (error) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // Self-remove from document
  app.post("/api/cim/:docId/collaborators/:collaboratorId/leave", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const collaboratorId = parseInt(req.params.collaboratorId);
      const userId = req.user!.id;

      const collaborators = await storage.getCollaborators(docId);
      const collaborator = collaborators.find(c => c.id === collaboratorId);

      if (!collaborator || collaborator.userId !== userId) {
        return res.status(403).json({ error: "You can only remove yourself" });
      }

      await storage.deleteCollaborator(collaboratorId);
      await storage.releaseUserLocks(userId, docId);

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "collaborator_left", {
        collaboratorId
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Leave collaboration error:", error);
      res.status(500).json({ error: "Failed to leave collaboration" });
    }
  });

  // Get lock status
  app.get("/api/cim/:docId/lock/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (!permission) {
        return res.status(403).json({ error: "No access to this document" });
      }

      const lock = await storage.getLock(docId);
      if (!lock) {
        return res.json({ locked: false });
      }

      // If the lock belongs to the current user, don't show it as "locked by someone else"
      if (lock.userId === userId) {
        return res.json({ locked: false });
      }

      const duration = Date.now() - new Date(lock.lockedAt).getTime();
      res.json({
        locked: true,
        user: {
          name: lock.userName,
          email: lock.userEmail,
          lockedAt: lock.lockedAt,
          duration
        }
      });
    } catch (error) {
      console.error("Get lock status error:", error);
      res.status(500).json({ error: "Failed to get lock status" });
    }
  });

  // Acquire edit lock
  app.post("/api/cim/:docId/lock", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner" && permission !== "edit") {
        return res.status(403).json({ error: "Only owners and editors can acquire locks" });
      }

      const existingLock = await storage.getLock(docId);
      if (existingLock && existingLock.userId !== userId) {
        return res.status(409).json({
          success: false,
          error: "Document is locked by another user",
          user: {
            name: existingLock.userName,
            email: existingLock.userEmail
          }
        });
      }

      const lock = await storage.createLock(docId, userId, req.user!.name || "Unknown", req.user!.email);

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "lock_acquired", {});

      res.json({ success: true, lock });
    } catch (error) {
      console.error("Acquire lock error:", error);
      res.status(500).json({ error: "Failed to acquire lock" });
    }
  });

  // Take over edit lock
  app.post("/api/cim/:docId/lock/takeover", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner" && permission !== "edit") {
        return res.status(403).json({ error: "Only owners and editors can take over locks" });
      }

      const existingLock = await storage.getLock(docId);
      const previousUser = existingLock ? existingLock.userName : null;
      const previousUserId = existingLock ? existingLock.userId : null;
      const previousUserEmail = existingLock ? existingLock.userEmail : null;

      const doc = await storage.getCimDocument(docId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const lock = await storage.createLock(docId, userId, req.user!.name || "Unknown", req.user!.email, previousUserId || undefined);

      // Send email notification to previous editor
      if (previousUserEmail && previousUser) {
        const newEditorName = req.user!.name || req.user!.email || "Another user";
        await sendEditLockTakenOverEmail(
          previousUserEmail,
          previousUser,
          doc.title,
          newEditorName
        );
      }

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "lock_taken_over", {
        previousUser,
        previousUserId
      });

      res.json({ success: true, previousUser });
    } catch (error) {
      console.error("Takeover lock error:", error);
      res.status(500).json({ error: "Failed to take over lock" });
    }
  });

  // Release edit lock
  app.delete("/api/cim/:docId/lock", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (permission !== "owner" && permission !== "edit") {
        return res.status(403).json({ error: "Only owners and editors can release locks" });
      }

      const existingLock = await storage.getLock(docId);
      if (existingLock && existingLock.userId !== userId) {
        return res.status(403).json({ error: "You can only release your own locks" });
      }

      await storage.releaseLock(docId);

      await storage.logActivity(docId, userId, req.user!.name || null, req.user!.email, "lock_released", {});

      res.json({ success: true });
    } catch (error) {
      console.error("Release lock error:", error);
      res.status(500).json({ error: "Failed to release lock" });
    }
  });

  // Lock heartbeat
  app.post("/api/cim/:docId/lock/heartbeat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const existingLock = await storage.getLock(docId);
      if (!existingLock || existingLock.userId !== userId) {
        return res.status(403).json({ error: "You don't hold the lock" });
      }

      await storage.updateLockActivity(docId);

      res.json({ success: true });
    } catch (error) {
      console.error("Lock heartbeat error:", error);
      res.status(500).json({ error: "Failed to update heartbeat" });
    }
  });

  // Get activity log
  app.get("/api/cim/:docId/activity", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const docId = parseInt(req.params.docId);
      const userId = req.user!.id;

      const permission = await getUserDocumentPermission(docId, userId);
      if (!permission) {
        return res.status(403).json({ error: "No access to this document" });
      }

      const maxLimit = 100;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, maxLimit);
      const offset = parseInt(req.query.offset as string) || 0;

      const activities = await storage.getActivityLog(docId, { limit, offset });

      res.json(activities);
    } catch (error) {
      console.error("Get activity log error:", error);
      res.status(500).json({ error: "Failed to get activity log" });
    }
  });
}
