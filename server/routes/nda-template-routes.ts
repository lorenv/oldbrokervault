import { Express } from "express";
import { storage } from "../storage";
import { insertNdaTemplateSchema } from "@shared/schema";
import { validateZodSchema } from "../middleware/validation";

export function registerNdaTemplateRoutes(app: Express) {
  console.log('=== SETTING UP NDA TEMPLATE ROUTES ===');
  // Get all NDA templates for user
  app.get("/api/nda-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templates = await storage.getNdaTemplates(req.user!.id);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching NDA templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Get specific NDA template
  app.get("/api/nda-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templateId = parseInt(req.params.id);
      const template = await storage.getNdaTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Verify ownership
      if (template.userId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching NDA template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // Create new NDA template with signature fields
  app.post("/api/nda-templates", validateZodSchema(insertNdaTemplateSchema), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      console.log("Creating NDA template for user:", req.user!.id);
      console.log("Request body:", {
        name: req.body.name,
        hasFileContent: !!req.body.fileContent,
        signatureFieldsCount: req.body.signatureFields?.length || 0
      });
      
      const template = await storage.createNdaTemplate(req.user!.id, {
        name: req.body.name,
        fileContent: req.body.fileContent,
        isDefault: req.body.isDefault || false,
        signatureFields: req.body.signatureFields || []
      });
      
      console.log("Template created successfully:", template.id);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating NDA template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Update NDA template
  app.put("/api/nda-templates/:id", validateZodSchema(insertNdaTemplateSchema.partial()), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templateId = parseInt(req.params.id);
      
      // Verify ownership first
      const existingTemplate = await storage.getNdaTemplate(templateId);
      if (!existingTemplate || existingTemplate.userId !== req.user!.id) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const template = await storage.updateNdaTemplate(templateId, {
        name: req.body.name,
        fileContent: req.body.fileContent,
        signatureFields: req.body.signatureFields
      });
      
      res.json(template);
    } catch (error) {
      console.error("Error updating NDA template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  // Delete NDA template
  app.delete("/api/nda-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const templateId = parseInt(req.params.id);
      
      // Verify ownership first
      const existingTemplate = await storage.getNdaTemplate(templateId);
      if (!existingTemplate || existingTemplate.userId !== req.user!.id) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Prevent deletion of default templates
      if (existingTemplate.isDefault) {
        return res.status(400).json({ error: "Cannot delete default template" });
      }
      
      await storage.deleteNdaTemplate(templateId);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting NDA template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Get template for signature process (public endpoint for signers)
  console.log('=== REGISTERING /api/share/:shareSlug/nda-template ROUTE ===');
  app.get("/api/share/:shareSlug/nda-template", async (req, res) => {
    console.log('=== NDA TEMPLATE ENDPOINT HIT ===');
    console.log('Share slug:', req.params.shareSlug);
    console.log('Full URL:', req.url);
    console.log('Request method:', req.method);
    try {
      const { shareSlug } = req.params;
      
      // Get document by share slug
      const cimDoc = await storage.getCimByShareSlug(shareSlug);
      if (!cimDoc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (!cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Sharing is disabled for this document" });
      }
      
      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }
      
      if (!cimDoc.ndaProtected || !cimDoc.ndaTemplateId) {
        return res.status(400).json({ error: "This document does not require NDA signature" });
      }
      
      // Get NDA template with signature fields
      const template = await storage.getNdaTemplate(cimDoc.ndaTemplateId);
      if (!template) {
        return res.status(404).json({ error: "NDA template not found" });
      }
      
      // Return template data for signature process
      res.json({
        id: template.id,
        name: template.name,
        fileContent: template.fileContent,
        signatureFields: template.signatureFields || [],
        documentTitle: cimDoc.title
      });
      
    } catch (error) {
      console.error("Error fetching NDA template for signing:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });
}