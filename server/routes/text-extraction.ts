import { Router } from 'express';
import multer from 'multer';
import { textExtractionService } from '../text-extraction-service';
import { Request, Response } from 'express';

const router = Router();

// Configure multer for text extraction uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for text documents
    files: 1, // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    const supportedTypes = textExtractionService.getSupportedTypes();
    
    // Check file extension
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (!extension || !supportedTypes.extensions.includes(`.${extension}`)) {
      return cb(new Error(`File type not supported. Supported formats: ${supportedTypes.extensions.join(', ')}`));
    }
    
    // Check MIME type if available
    if (file.mimetype && !supportedTypes.mimeTypes.includes(file.mimetype)) {
      // Allow some common MIME type variations
      const allowedVariations = [
        'application/octet-stream', // Generic binary
        'text/plain', // Plain text
      ];
      
      if (!allowedVariations.includes(file.mimetype)) {
        console.warn(`File upload warning: MIME type ${file.mimetype} not in supported list, but extension is valid`);
      }
    }
    
    cb(null, true);
  }
});

// Rate limiting for text extraction (prevent abuse)
const extractionAttempts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = {
  maxAttempts: 5, // 5 extractions per hour per IP
  windowMs: 60 * 60 * 1000, // 1 hour
};

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userAttempts = extractionAttempts.get(ip);
  
  if (!userAttempts || now > userAttempts.resetTime) {
    // Reset or initialize
    extractionAttempts.set(ip, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return true;
  }
  
  if (userAttempts.count >= RATE_LIMIT.maxAttempts) {
    return false;
  }
  
  userAttempts.count++;
  return true;
}

/**
 * Extract text from uploaded file
 * POST /api/text-extraction/extract
 */
router.post('/extract', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // Authentication check
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // Rate limiting
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: 3600 // 1 hour in seconds
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    // Additional file validation
    const fileInfo = {
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    };

    // Security check - scan for potential issues
    if (fileInfo.originalName.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Filename too long'
      });
    }

    // Check for suspicious patterns in filename
    const suspiciousPatterns = [
      /\.(exe|bat|cmd|scr|vbs|js|jar)$/i, // Executable files
      /\x00/, // Null bytes
      /.{100,}/, // Extremely long names
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fileInfo.originalName)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file name'
        });
      }
    }

    console.log(`📄 Text extraction request: ${fileInfo.originalName} (${fileInfo.size} bytes) from user ${req.user?.id}`);

    // Extract text using the service
    const extractionResult = await textExtractionService.extractText(fileInfo);

    if (!extractionResult.success) {
      return res.status(400).json({
        success: false,
        error: extractionResult.error || 'Text extraction failed'
      });
    }

    // Log successful extraction
    console.log(`✅ Text extracted: ${extractionResult.metadata.wordCount} words from ${fileInfo.originalName} in ${extractionResult.metadata.processingTime}ms`);

    // Return the extracted text and metadata
    res.json({
      success: true,
      text: extractionResult.text,
      metadata: {
        filename: extractionResult.metadata.filename,
        fileType: extractionResult.metadata.fileType,
        fileSize: extractionResult.metadata.fileSize,
        pageCount: extractionResult.metadata.pageCount,
        wordCount: extractionResult.metadata.wordCount,
        processingTime: extractionResult.metadata.processingTime
      }
    });

  } catch (error) {
    console.error('Text extraction endpoint error:', error);
    
    // Handle specific error types
    if (error instanceof multer.MulterError) {
      let errorMessage = 'File upload error';
      
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          errorMessage = 'File too large. Maximum size is 10MB.';
          break;
        case 'LIMIT_FILE_COUNT':
          errorMessage = 'Too many files. Only one file allowed.';
          break;
        case 'LIMIT_UNEXPECTED_FILE':
          errorMessage = 'Unexpected file field.';
          break;
        default:
          errorMessage = error.message;
      }
      
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error during text extraction'
    });
  }
});

/**
 * Get supported file types and limits
 * GET /api/text-extraction/info
 */
router.get('/info', (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const supportedTypes = textExtractionService.getSupportedTypes();
    
    res.json({
      success: true,
      supportedTypes: {
        extensions: supportedTypes.extensions,
        mimeTypes: supportedTypes.mimeTypes,
        maxSize: supportedTypes.maxSize,
        maxSizeFormatted: `${(supportedTypes.maxSize / 1024 / 1024).toFixed(1)}MB`
      },
      rateLimit: {
        maxAttempts: RATE_LIMIT.maxAttempts,
        windowMs: RATE_LIMIT.windowMs,
        windowFormatted: '1 hour'
      }
    });
  } catch (error) {
    console.error('Text extraction info endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get extraction info'
    });
  }
});

export { router as textExtractionRouter };