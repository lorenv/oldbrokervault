import crypto from "crypto";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import os from "os";
import * as fsSync from "fs";
import { promises as fs } from "fs";
import sharp from "sharp";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";

// Constants for bcrypt password hashing
const BCRYPT_ROUNDS = 10;

// Helper function to hash a share password
export async function hashSharePassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Helper function to verify a share password
// Handles both bcrypt hashed passwords and legacy plaintext passwords
export async function verifySharePassword(providedPassword: string, storedPassword: string): Promise<boolean> {
  // Check if the stored password is a bcrypt hash (starts with $2a$ or $2b$)
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compare(providedPassword, storedPassword);
  }
  // Legacy plaintext password - use timing-safe comparison
  const providedBuffer = Buffer.from(providedPassword);
  const storedBuffer = Buffer.from(storedPassword);
  if (providedBuffer.length !== storedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, storedBuffer);
}

// Helper function to check if user is an authorized admin using database field
export function isAuthorizedAdmin(user: any): boolean {
  if (!user) return false;
  return user.isAdmin === true;
}

// Helper function to check if user has premium access
export function hasPremiumAccess(user: any): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;

  // Free users don't have premium access
  if (user.subscriptionStatus === 'free') return false;

  // For canceled subscriptions, check if they still have time remaining
  if (user.subscriptionStatus === 'canceled') {
    return user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > new Date();
  }

  // All other subscription statuses (standard, premium, enterprise) have access
  return true;
}

// Function to add rounded corners to images using Sharp with memory optimization
export async function addRoundedCorners(imageBuffer: Buffer, radius: number = 30): Promise<Buffer> {
  let sharpInstance: sharp.Sharp | null = null;

  try {
    // Create Sharp instance with memory optimization
    sharpInstance = sharp(imageBuffer, {
      limitInputPixels: 268402689, // ~16k x 16k limit
      sequentialRead: true,
      density: 72 // Lower DPI for web use
    });

    // Get image metadata
    const metadata = await sharpInstance.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine image dimensions');
    }

    // Limit maximum dimensions to prevent memory issues
    const maxDimension = 2048;
    let { width, height } = metadata;

    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    // Create rounded rectangle mask with optimized dimensions
    const roundedCorners = Buffer.from(
      `<svg width="${width}" height="${height}">
        <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
      </svg>`
    );

    // Apply the mask with memory-optimized processing and preserve transparency
    const processedImage = await sharpInstance
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      })
      .png({
        quality: 85,
        compressionLevel: 6,
        progressive: false,
        force: true // Force PNG to preserve transparency
      })
      .composite([
        {
          input: roundedCorners,
          blend: 'dest-in'
        }
      ])
      .toBuffer();

    return processedImage;
  } catch (error) {
    console.error('Error adding rounded corners:', error);
    // Return original buffer if processing fails
    return imageBuffer;
  } finally {
    // Clean up Sharp instance to free memory
    if (sharpInstance) {
      sharpInstance.destroy();
    }
  }
}

// Directory paths
export const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
export const businessImagesDir = path.join(process.cwd(), 'public', 'business-images');
export const financialFilesDir = path.join(process.cwd(), 'private', 'financial-files');
export const uploadedCimsDir = path.join(process.cwd(), 'private', 'uploaded-cims');

// Configure temporary uploads directory for disk storage
export const tmpUploadsDir = path.join(os.tmpdir(), 'brokervault-uploads');
if (!fsSync.existsSync(tmpUploadsDir)) {
  fsSync.mkdirSync(tmpUploadsDir, { recursive: true });
}

// Configure multer to use disk storage for large files (prevents OOM on concurrent uploads)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tmpUploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename to prevent collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `upload-${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
  }
});

// Main upload handler - uses disk storage to prevent memory issues
export const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    fieldSize: 10 * 1024 * 1024, // 10MB limit for field data
    fields: 30,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // Log large file uploads for monitoring
    if (process.env.NODE_ENV !== 'production') {
      console.log(`File upload: ${file.originalname}`);
    }
    cb(null, true);
  }
});

// Large file upload handler for CIM files (up to 200MB)
export const largeFileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit for financial files
    fieldSize: 200 * 1024 * 1024, // 200MB limit for field data
    fields: 100,
    files: 50
  }
});

// Helper to clean up temporary files after request processing (path-based)
export async function cleanupTempFilePath(filePath: string | undefined): Promise<void> {
  if (filePath && filePath.startsWith(tmpUploadsDir)) {
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // File may already be deleted or moved, ignore
    }
  }
}

// Helper to clean up temporary files after processing (multer file-based)
export async function cleanupTempFile(file: Express.Multer.File): Promise<void> {
  if (file.path) {
    try {
      await fs.unlink(file.path);
    } catch (err) {
      console.warn(`Failed to cleanup temp file ${file.path}:`, err);
    }
  }
}

// Helper function to read file from disk and return buffer (for disk-based uploads)
export async function readFileFromDisk(file: Express.Multer.File): Promise<Buffer> {
  if (file.buffer) {
    // File is already in memory (for backwards compatibility)
    return file.buffer;
  }
  // Read from disk path
  return await fs.readFile(file.path);
}

// Rate limiter for share endpoints to prevent brute-force slug discovery
export const shareLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for expensive AI generation endpoints
export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // 10 requests per hour per user
  keyGenerator: (req) => {
    // Use user ID for authenticated requests, fall back to IP
    return (req as any).user?.id?.toString() || req.ip || 'unknown';
  },
  message: { error: 'Too many AI generation requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for users with unlimited plans (enterprise)
  skip: async (req) => {
    if (!(req as any).user) return false;
    try {
      const user = await storage.getUser((req as any).user.id);
      return user?.subscriptionStatus === 'enterprise';
    } catch {
      return false;
    }
  }
});

// Password reset rate limiter - strict limits to prevent abuse and email enumeration
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per 15 minutes per IP
  message: { error: "Too many password reset requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
