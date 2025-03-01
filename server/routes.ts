import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { analyzeCimTranscript } from "./perplexity";
import { insertCimDocumentSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // CIM Document Routes
  app.post("/api/cim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const data = insertCimDocumentSchema.parse(req.body);
      const analysis = await analyzeCimTranscript(data.transcript);

      const doc = await storage.createCimDocument(req.user!.id, {
        ...data,
        analysis,
      });

      res.json(doc);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/cim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const docs = await storage.getCimDocuments(req.user!.id);
    res.json(docs);
  });

  // Admin Routes
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.sendStatus(401);
    }
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.post("/api/admin/subscription", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.sendStatus(401);
    }

    const { userId, status, months } = req.body;
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);

    await storage.updateSubscription(userId, status, endsAt);
    res.sendStatus(200);
  });

  const httpServer = createServer(app);
  return httpServer;
}