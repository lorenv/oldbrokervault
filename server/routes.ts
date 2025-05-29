import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import sharp from "sharp";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript } from "./perplexity";
import { generateHtml, generateWordDocument, generatePDF, formatTextContent } from "./document-export";
import { getGoogleAuthUrl, handleGoogleCallback, createGoogleDoc } from "./google-auth";

const upload = multer({ storage: multer.memoryStorage() });

async function addRoundedCorners(imageBuffer: Buffer, radius: number = 30): Promise<Buffer> {
  const { width, height } = await sharp(imageBuffer).metadata();
  
  if (!width || !height) {
    throw new Error('Unable to get image dimensions');
  }

  const mask = Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  );

  return sharp(imageBuffer)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Basic endpoints
  app.get("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndsAt: user.subscriptionEndsAt,
        isAdmin: user.isAdmin
      });
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  app.post("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const updateData = {
        businessName: req.body.businessName,
        businessWebsite: req.body.businessWebsite,
        contactInfo: req.body.contactInfo
      };
      
      const updatedUser = await storage.updateUserProfile(req.user!.id, updateData);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Failed to update user profile" });
    }
  });

  app.post("/api/cim/generate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { transcript, customDirections } = req.body;
      
      if (!transcript || transcript.trim().length === 0) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const analysis = await analyzeCimTranscript(transcript, customDirections);
      
      const document = await storage.createCimDocument(req.user!.id, {
        title: analysis.story?.businessSummary || "Business Analysis",
        transcript,
        analysis,
        customDirections,
        regenerationCount: 0
      });

      res.json({ 
        id: document.id,
        analysis,
        title: document.title
      });
    } catch (error: any) {
      console.error("Error generating CIM:", error);
      res.status(500).json({ 
        error: "Failed to generate CIM",
        details: error.message 
      });
    }
  });

  app.get("/api/cim/documents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const documents = await storage.getCimDocuments(req.user!.id);
      res.json(documents);
    } catch (error: any) {
      console.error("Error fetching CIM documents:", error);
      res.status(500).json({ error: "Failed to fetch CIM documents" });
    }
  });

  app.get("/api/cim/documents/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const document = await storage.getCimDocument(parseInt(req.params.id));
      
      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(document);
    } catch (error: any) {
      console.error("Error fetching CIM document:", error);
      res.status(500).json({ error: "Failed to fetch CIM document" });
    }
  });

  // Website analysis endpoint
  app.post("/api/analyze-website", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // For now, return a simple response - website analysis would require additional setup
      res.json({
        logoUrl: null,
        images: [],
        message: "Website analysis completed"
      });
    } catch (error: any) {
      console.error("Error analyzing website:", error);
      res.status(500).json({ error: "Failed to analyze website" });
    }
  });

  // Upload logo endpoint
  app.post("/api/upload-logo", upload.single('logo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Add rounded corners to the uploaded image
      const processedImageBuffer = await addRoundedCorners(req.file.buffer);
      
      // Convert to base64 for storage
      const base64Image = `data:${req.file.mimetype};base64,${processedImageBuffer.toString('base64')}`;
      
      // Update user's business logo
      await storage.updateUserProfile(req.user!.id, { businessLogo: base64Image });

      res.json({
        success: true,
        logoUrl: base64Image,
        message: "Logo uploaded successfully"
      });
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ error: "Failed to upload logo" });
    }
  });

  // Update CIM content (for inline editing)
  app.put("/api/cim/documents/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const document = await storage.getCimDocument(parseInt(req.params.id));
      
      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const updatedDocument = await storage.updateCimDocumentContent(parseInt(req.params.id), req.body.editedContent);
      res.json(updatedDocument);
    } catch (error: any) {
      console.error("Error updating CIM document:", error);
      res.status(500).json({ error: "Failed to update CIM document" });
    }
  });

  // Export endpoints
  app.post("/api/cim/export/word/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const document = await storage.getCimDocument(parseInt(req.params.id));
      
      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const user = await storage.getUser(req.user!.id);
      const analysis = document.editedContent || document.analysis;
      
      const wordBuffer = await generateWordDocument(
        analysis,
        user?.businessLogo,
        user?.businessWebsite,
        undefined,
        user
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${document.title || 'CIM'}.docx"`);
      res.send(wordBuffer);
    } catch (error: any) {
      console.error("Error generating Word document:", error);
      res.status(500).json({ error: "Failed to generate Word document" });
    }
  });

  app.post("/api/cim/export/pdf/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const document = await storage.getCimDocument(parseInt(req.params.id));
      
      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const user = await storage.getUser(req.user!.id);
      const analysis = document.editedContent || document.analysis;
      
      const pdfBuffer = await generatePDF(
        analysis,
        document.title,
        user?.businessLogo,
        user?.businessWebsite,
        undefined,
        user
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${document.title || 'CIM'}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Share functionality
  app.post("/api/cim/share/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const document = await storage.getCimDocument(parseInt(req.params.id));
      
      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const { enabled, password, expiresAt, customSlug } = req.body;
      
      const updatedDocument = await storage.updateShareSettings(parseInt(req.params.id), {
        shareEnabled: enabled,
        sharePassword: password,
        shareExpiresAt: expiresAt,
        shareSlug: customSlug
      });

      res.json(updatedDocument);
    } catch (error: any) {
      console.error("Error updating share settings:", error);
      res.status(500).json({ error: "Failed to update share settings" });
    }
  });

  // Public share route
  app.get("/share/:slug", async (req, res) => {
    try {
      const doc = await storage.getCimByShareSlug(req.params.slug);
      
      if (!doc || !doc.shareEnabled) {
        return res.status(404).send("CIM not found or sharing is disabled");
      }

      // Check expiration
      if (doc.shareExpiresAt && new Date(doc.shareExpiresAt) < new Date()) {
        return res.status(410).send("This shared CIM has expired");
      }

      // Check password
      if (doc.sharePassword && req.query.password !== doc.sharePassword) {
        return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Password Required</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; text-align: center; }
            .form { max-width: 400px; margin: 0 auto; }
            input, button { padding: 12px; margin: 8px; border: 1px solid #ddd; border-radius: 6px; }
            button { background: #3b82f6; color: white; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="form">
            <h2>Password Required</h2>
            <p>This CIM is password protected. Please enter the password to continue.</p>
            <form method="get">
              <input type="password" name="password" placeholder="Enter password" required>
              <button type="submit">Access CIM</button>
            </form>
          </div>
        </body>
        </html>
        `);
      }

      // Increment view count
      await storage.incrementShareViewCount(doc.id);

      // Get user profile for branding
      const user = await storage.getUser(doc.userId);
      const analysis = doc.editedContent || doc.analysis;
      const businessName = analysis.story?.businessSummary || doc.title;
      
      const sharedCimHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${businessName} - Confidential Information Memorandum</title>
          <meta name="robots" content="noindex, nofollow">
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; margin: 0; padding: 0; background: #ffffff; }
            .header { background: #1f2937; color: white; padding: 20px 0; margin-bottom: 40px; }
            .header-content { max-width: 800px; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; gap: 20px; }
            .logo { width: 60px; height: 60px; border-radius: 30px; object-fit: cover; }
            .header-text h1 { margin: 0; font-size: 28px; color: #3b82f6; }
            .header-text p { margin: 5px 0 0 0; opacity: 0.8; }
            .container { max-width: 800px; margin: 0 auto; padding: 0 20px 40px 20px; }
            .section { margin-bottom: 40px; }
            .section h2 { color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
            .section h3 { color: #374151; margin-top: 25px; margin-bottom: 15px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            .card { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; }
            .highlight { background: #dbeafe; padding: 15px; border-radius: 6px; margin: 15px 0; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; }
            .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-content">
              ${user?.businessLogo ? `<img src="${user.businessLogo}" alt="${businessName}" class="logo">` : ''}
              <div class="header-text">
                <h1>${businessName}</h1>
                <p>Confidential Information Memorandum</p>
              </div>
            </div>
          </div>
          
          <div class="container">
            ${generateHtml(analysis)}
          </div>
          
          <div class="footer">
            <p>This document contains confidential and proprietary information.</p>
          </div>
        </body>
        </html>
      `;
      
      res.send(sharedCimHtml);
    } catch (error) {
      console.error("Error serving shared CIM:", error);
      res.status(500).send("Error loading shared CIM");
    }
  });

  // Custom sections management
  app.post("/api/cim/sections/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const document = await storage.getCimDocument(parseInt(req.params.id));
      
      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const updatedDocument = await storage.addCustomSection(parseInt(req.params.id), req.body);
      res.json(updatedDocument);
    } catch (error: any) {
      console.error("Error adding custom section:", error);
      res.status(500).json({ error: "Failed to add custom section" });
    }
  });

  app.put("/api/cim/sections/:id/reorder", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const document = await storage.getCimDocument(parseInt(req.params.id));
      
      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const { sections } = req.body;
      const updatedDocument = await storage.reorderSections(parseInt(req.params.id), sections);
      res.json(updatedDocument);
    } catch (error: any) {
      console.error("Error reordering sections:", error);
      res.status(500).json({ error: "Failed to reorder sections" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}