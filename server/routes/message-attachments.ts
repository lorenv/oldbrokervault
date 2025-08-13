import { Router } from 'express';
import { storage } from '../storage';
import { ObjectStorageService } from '../object-storage';
// Remove this import - we'll check authentication directly
import { randomUUID } from 'crypto';

const router = Router();

// Get upload URL for message attachment
router.post('/upload-attachment', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  try {
    const objectStorageService = new ObjectStorageService();
    const fileKey = `message-attachments/${randomUUID()}`;
    
    // Generate a presigned URL for upload
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    
    res.json({ uploadURL });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
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