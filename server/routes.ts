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
        username: user.username,
        email: user.email,
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        businessWebsite: user.businessWebsite,
        contactInfo: user.contactInfo,
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
      
      const document = await storage.createCimDocument({
        userId: req.user!.id,
        title: analysis.story?.businessSummary || "Business Analysis",
        transcript,
        analysis,
        customDirections
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

  const httpServer = createServer(app);
  return httpServer;
}