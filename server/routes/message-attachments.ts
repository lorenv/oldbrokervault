import { Router } from 'express';
import { storage } from '../storage';
import { ObjectStorageService } from '../object-storage';
import { randomUUID } from 'crypto';
import multer from 'multer';
import path from 'path';
import { sanitizeFilename } from '../utils/sanitize-filename';

const router = Router();

// Configure multer for file upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Upload attachment endpoint - handles direct file upload
router.post('/upload-attachment', upload.single('file'), async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const objectStorageService = new ObjectStorageService();

    // Sanitize filename to prevent path traversal attacks
    const safeOriginalName = sanitizeFilename(req.file.originalname);

    // Generate unique file path
    const storageFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}-${safeOriginalName}`;

    // Upload to object storage
    const uploadResult = await objectStorageService.uploadBuffer(
      `message-attachments/${storageFileName}`,
      req.file.buffer,
      req.file.mimetype
    );

    res.json({
      filePath: uploadResult.url,
      fileName: safeOriginalName,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
    
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Handle attachment metadata after upload
router.post('/attachment-metadata', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  try {
    const { messageId, fileName, filePath, fileSize, mimeType } = req.body;
    
    if (!messageId || !fileName || !filePath || !fileSize || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const attachment = await storage.createMessageAttachment({
      messageId,
      fileName,
      filePath,
      fileSize,
      mimeType
    });
    
    res.json(attachment);
  } catch (error) {
    console.error('Error creating attachment metadata:', error);
    res.status(500).json({ error: 'Failed to create attachment metadata' });
  }
});

// Get attachments for a message
router.get('/message/:messageId/attachments', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  try {
    const messageId = parseInt(req.params.messageId);
    const attachments = await storage.getMessageAttachments(messageId);
    res.json(attachments);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Download attachment
router.get('/attachment/:attachmentId/download', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  try {
    const attachmentId = parseInt(req.params.attachmentId);
    const attachment = await storage.getMessageAttachment(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    // For now, just redirect to the file path directly 
    // In production, you might want to generate presigned URLs
    res.redirect(attachment.filePath);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

export default router;