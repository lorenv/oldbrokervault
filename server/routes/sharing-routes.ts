import type { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { financialFiles } from '@shared/schema';
import { shareLimiter, verifySharePassword, hashSharePassword, addRoundedCorners } from '../route-utils';
import { objectStorage } from '../object-storage';
import { generateWordDocument, generatePDF } from '../document-export';
import { sanitizeUser, sanitizeUserForSharing } from '../data-sanitizer';
import { fileStorageManager } from '../file-storage';
import { dispatchWebhookEvent } from '../webhook-dispatcher';
import { dispatchIntegrationEvent } from '../integrations';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import archiver from 'archiver';
import JSZip from 'jszip';

export function registerSharingRoutes(app: Express) {

  // Serve uploaded file content for sharing
  app.get("/api/share/:shareSlug/file", shareLimiter, async (req, res) => {
    try {
      const { shareSlug } = req.params;
      console.log("Serving uploaded file for slug:", shareSlug);

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

      // Only serve uploaded files
      if (!cimDoc.isUploadedFile) {
        return res.status(404).json({ error: "No uploaded file found" });
      }

      // Increment view count
      await storage.incrementShareViewCount(cimDoc.id);

      // Check for files in the new uploadedFiles table first
      const uploadedFiles = await storage.getUploadedFiles(cimDoc.id);

      if (uploadedFiles.length > 0) {
        // Serve the first uploaded file (for single file uploads)
        const firstFile = uploadedFiles[0];

        try {
          const fileBuffer = await fileStorageManager.downloadFile(firstFile.filePath);

          // Set appropriate content type
          res.setHeader('Content-Type', firstFile.mimeType);

          // For PDF, set inline disposition for browser viewing and allow iframe embedding
          if (firstFile.mimeType === 'application/pdf') {
            res.setHeader('Content-Disposition', `inline; filename="${firstFile.fileName}"`);
            // Allow iframe embedding for PDFs
            res.removeHeader('X-Frame-Options');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
          } else {
            // For other files, set attachment disposition for download
            res.setHeader('Content-Disposition', `attachment; filename="${firstFile.fileName}"`);
          }

          res.send(fileBuffer);
          return;

        } catch (fileError) {
          console.error("Error reading uploaded file from object storage:", fileError);
        }
      }

      // Fallback to old uploadedFilePath system (try object storage first, then filesystem)
      if (cimDoc.uploadedFilePath) {
        try {
          let fileBuffer;

          // Try object storage first (for migrated files)
          try {
            fileBuffer = await fileStorageManager.downloadFile(cimDoc.uploadedFilePath);
          } catch (objectStorageError) {
            // Fallback to filesystem for legacy files
            try {
              fileBuffer = await fs.readFile(cimDoc.uploadedFilePath);
              console.log("Served legacy file from filesystem:", cimDoc.uploadedFilePath);
            } catch (fsError) {
              throw new Error("File not found in object storage or filesystem");
            }
          }

          // Set appropriate content type based on file type
          let contentType = 'application/octet-stream';
          if (cimDoc.uploadedFileMimeType === 'application/pdf') {
            contentType = 'application/pdf';
          } else if (cimDoc.uploadedFileMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (cimDoc.uploadedFileMimeType === 'text/plain') {
            contentType = 'text/plain';
          }

          res.setHeader('Content-Type', contentType);

          // For PDF, set inline disposition for browser viewing and allow iframe embedding
          if (cimDoc.uploadedFileMimeType === 'application/pdf') {
            res.setHeader('Content-Disposition', `inline; filename="${cimDoc.uploadedFileName}"`);
            // Allow iframe embedding for PDFs
            res.removeHeader('X-Frame-Options');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
          } else {
            // For other files, set attachment disposition for download
            res.setHeader('Content-Disposition', `attachment; filename="${cimDoc.uploadedFileName}"`);
          }

          res.send(fileBuffer);

        } catch (fileError) {
          console.error("Error reading uploaded file:", fileError);
          res.status(404).json({ error: "File not found" });
        }
      } else {
        res.status(404).json({ error: "No file path found" });
      }

    } catch (error) {
      console.error("Error serving uploaded file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Lightweight NDA check endpoint - optimized with caching
  app.get('/api/share/:shareSlug/nda-check', async (req, res) => {
    const { shareSlug } = req.params;
    const startTime = Date.now();


    try {
      // Direct database lookup without cache complications

      // Use standard lookup to avoid optimization issues
      const cimDoc = await storage.getCimByShareSlug(shareSlug);

      if (!cimDoc) {
        console.log("Document not found for slug:", shareSlug);
        return res.status(404).json({ error: "Document not found" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      // Check if the current user is the document owner or collaborator
      const isOwner = req.isAuthenticated() && req.user && req.user.id === cimDoc.userId;
      let isCollaborator = false;
      if (req.isAuthenticated() && req.user && !isOwner) {
        const collaboration = await storage.getUserCollaboration(cimDoc.id, req.user.id);
        isCollaborator = !!collaboration;
      }

      // Fetch owner's business logo for branding on password/NDA screens
      let ownerBusinessLogo = null;
      try {
        const ownerProfile = await storage.getUserProfile(cimDoc.userId);
        if (ownerProfile?.businessLogo) {
          ownerBusinessLogo = ownerProfile.businessLogo;
        }
      } catch (e) {
        // Ignore errors fetching owner profile
      }

      const result = {
        requiresNda: Boolean(cimDoc.ndaProtected) && !isOwner && !isCollaborator, // Bypass NDA for owner and collaborators
        requiresApproval: Boolean(cimDoc.ndaApprovalRequired),
        title: cimDoc.title || 'Untitled Document',
        documentId: cimDoc.id,
        isOwner: isOwner,
        isCollaborator: isCollaborator,
        bypassedNda: (isOwner || isCollaborator) && Boolean(cimDoc.ndaProtected), // Let frontend know NDA was bypassed
        currentUserId: req.user?.id || null,
        ownerBusinessLogo: ownerBusinessLogo
      };

      // Skip caching to avoid import issues

      res.json(result);

    } catch (error) {
      console.error('NDA check error:', error);
      res.status(500).json({ error: "Failed to check NDA status" });
    }
  });

  // Public share endpoints (comprehensively optimized for performance)
  app.get("/api/share/:shareSlug", shareLimiter, async (req, res) => {
    const startTime = Date.now();
    try {
      const { shareSlug } = req.params;
      const { token } = req.query;

      console.log("=== OPTIMIZED SHARE LINK ACCESS ===");
      console.log("Processing share request for slug:", shareSlug.substring(0, 8) + "...");

      // PERFORMANCE OPTIMIZATION 6: Cache integration with timeout protection
      let shareCache, CACHE_TTL, cacheKey, cachedData;
      try {
        const cacheModule = await import('../cache');
        shareCache = cacheModule.shareCache;
        CACHE_TTL = cacheModule.CACHE_TTL;
        cacheKey = shareCache.keys.shareDocument(shareSlug);
        cachedData = shareCache.get(cacheKey);

        if (cachedData && !token) {
          console.log("Cache hit - returning cached data, time:", Date.now() - startTime + "ms");
          return res.json(cachedData);
        }
      } catch (cacheError) {
        console.log("Cache unavailable, proceeding without cache:", cacheError.message);
      }

      // Immediate validation
      if (!shareSlug || shareSlug.length < 3) {
        return res.status(400).json({ error: "Invalid share slug" });
      }

      // PERFORMANCE OPTIMIZATION 1: Use reliable database query with timeout protection
      let cimDoc;
      try {
        cimDoc = await Promise.race([
          storage.getCimByShareSlugOptimized(shareSlug),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), 6000)
          )
        ]);
      } catch (error) {
        cimDoc = await storage.getCimByShareSlug(shareSlug);
      }

      console.log("Document lookup time:", Date.now() - startTime + "ms");

      if (!cimDoc) {
        console.log("Document not found for share slug");
        return res.status(404).json({ error: "Document not found" });
      }

      if (!cimDoc.shareEnabled) {
        console.log("ERROR: Sharing disabled for document:", cimDoc.id);
        return res.status(404).json({ error: "Sharing is disabled for this document" });
      }

      // Check expiration with detailed logging
      if (cimDoc.shareExpiresAt) {
        const now = new Date();
        const expirationDate = new Date(cimDoc.shareExpiresAt);
        console.log("Expiration check:", {
          now: now.toISOString(),
          expiresAt: expirationDate.toISOString(),
          isExpired: now > expirationDate
        });

        if (now > expirationDate) {
          console.log("ERROR: Document has expired");
          return res.status(410).json({ error: "This shared link has expired" });
        }
      } else {
        console.log("No expiration date set - link never expires");
      }

      // Check password protection
      if (cimDoc.sharePassword) {
        const { password } = req.query;
        const passwordsMatch = password ? await verifySharePassword(password as string, cimDoc.sharePassword) : false;
        console.log("Password protection check:", {
          hasPassword: !!cimDoc.sharePassword,
          providedPassword: !!password,
          passwordsMatch
        });

        if (!password || !passwordsMatch) {
          console.log("ERROR: Invalid or missing password for protected document");
          return res.status(401).json({
            error: "Password required",
            requiresPassword: true
          });
        }
        console.log("Password authentication successful");
      }

      // Check if the current user is the document owner (before view tracking and NDA checks)
      const isOwner = req.isAuthenticated() && req.user && req.user.id === cimDoc.userId;

      // PERFORMANCE OPTIMIZATION 2: Async view tracking (non-blocking)
      console.log("Starting async view tracking for document:", cimDoc.id);

      // Generate a unique session ID for time tracking
      const viewSessionId = `view_${cimDoc.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let viewerEmail: string | null = null;

      const viewTrackingPromise = (async () => {
        try {
          const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
          const userAgent = req.get('User-Agent') || 'unknown';

          if (isOwner) {
            // Track owner view but don't increment general view count to avoid inflating analytics
            console.log("Tracking document owner view (skipping to avoid inflating analytics)");
            // Don't track owner views in documentViews table to keep analytics clean
          } else if (cimDoc.ndaProtected && token) {
            // Track NDA signer view when accessing CIM content with token
            const accessToken = await storage.getNdaAccessToken(token as string);
            if (accessToken && accessToken.isActive) {
              viewerEmail = accessToken.signerEmail;
              await Promise.all([
                storage.trackDocumentView(cimDoc.id, 'nda_signer', {
                  viewerIdentifier: accessToken.signerEmail,
                  ipAddress: clientIp,
                  userAgent: userAgent,
                  sessionId: viewSessionId
                }),
                storage.incrementShareViewCount(cimDoc.id)
              ]);

              // Dispatch cim.viewed event for NDA signer views
              const cimViewedPayload = {
                cim_id: cimDoc.id,
                title: cimDoc.title,
                viewer_email: accessToken.signerEmail,
                viewer_name: accessToken.signerName,
                viewer_type: 'nda_signer',
                viewed_at: new Date().toISOString(),
              };
              dispatchIntegrationEvent(cimDoc.userId, 'cim.viewed', cimViewedPayload)
                .catch(err => console.error('Integration dispatch error:', err));
              dispatchWebhookEvent(cimDoc.userId, 'cim.viewed', cimViewedPayload)
                .catch(err => console.error('Webhook dispatch error:', err));
            }
          } else if (!cimDoc.ndaProtected) {
            // Track anonymous view for non-NDA protected documents
            await Promise.all([
              storage.trackDocumentView(cimDoc.id, 'anonymous', {
                ipAddress: clientIp,
                userAgent: userAgent,
                sessionId: viewSessionId
              }),
              storage.incrementShareViewCount(cimDoc.id)
            ]);

            // Dispatch cim.viewed event for anonymous views
            const cimViewedPayload = {
              cim_id: cimDoc.id,
              title: cimDoc.title,
              viewer_type: 'anonymous',
              viewed_at: new Date().toISOString(),
            };
            dispatchIntegrationEvent(cimDoc.userId, 'cim.viewed', cimViewedPayload)
              .catch(err => console.error('Integration dispatch error:', err));
            dispatchWebhookEvent(cimDoc.userId, 'cim.viewed', cimViewedPayload)
              .catch(err => console.error('Webhook dispatch error:', err));
          }
        } catch (error) {
          console.error('Async view tracking error:', error);
        }
      })();

      // PERFORMANCE OPTIMIZATION 3: Parallel data fetching with timeout protection
      const dataFetchStart = Date.now();
      let userProfile, customSections, ndaApprovalStatus;

      try {
        [userProfile, customSections, ndaApprovalStatus] = await Promise.all([
          storage.getUser(cimDoc.userId),
          storage.getCustomSections(cimDoc.id),
        // NDA approval check as async operation
        (async () => {
          // Skip NDA approval requirement for document owners
          if (isOwner) {
            return null;
          }

          if (!cimDoc.ndaProtected || !cimDoc.ndaApprovalRequired) return null;

          if (token) {
            try {
              const accessToken = await storage.getNdaAccessToken(token as string);
              if (accessToken && accessToken.isActive) {
                const signature = await storage.getNdaSignatureById(accessToken.ndaSignatureId);
                if (signature && !signature.approved) {
                  return {
                    requiresApproval: true,
                    isApproved: false,
                    message: "Thank you for signing the NDA. Your signature has been received and someone will follow up as soon as possible to share the document once it is approved."
                  };
                } else if (signature && signature.approved) {
                  return { requiresApproval: true, isApproved: true };
                }
              }
            } catch (error) {
              console.error('NDA approval check error:', error);
            }
          }

          return {
            requiresApproval: true,
            isApproved: false,
            message: "This document requires NDA approval before viewing."
          };
        })()
        ]);
      } catch (error) {
        console.log("Parallel query failed, using fallback:", error.message);
        // Fallback to sequential standard queries
        userProfile = await storage.getUser(cimDoc.userId);
        customSections = await storage.getCustomSections(cimDoc.id);
        ndaApprovalStatus = null;
      }

      console.log("Parallel data fetch time:", Date.now() - dataFetchStart + "ms");

      if (!userProfile) {
        console.log("ERROR: User profile not found for document owner:", cimDoc.userId);
        return res.status(404).json({ error: "Document owner not found" });
      }

      // PERFORMANCE OPTIMIZATION 4: Pre-compute URLs with simplified processing
      const urlProcessingStart = Date.now();
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');

      // Use production domain for image URLs - force brokervault.ai for any production request
      let baseUrl;
      if (host?.includes('brokervault.ai') || req.headers['x-forwarded-host']?.includes('brokervault.ai') || req.headers.host?.includes('brokervault.ai')) {
        baseUrl = 'https://brokervault.ai';
      } else {
        baseUrl = `${protocol}://${host}`;
      }

      // Enhanced URL processing function for all image types
      const processImageUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:') || url.startsWith('http')) return url;

        // Handle object storage URLs - these should be served as-is since they're internal API paths
        if (url.startsWith('/api/object-storage/')) {
          return `${baseUrl}${url}`;
        }

        // For custom section images and other user-specific images, ensure proper serving
        if (url.startsWith('/user-images/')) {
          return `${baseUrl}${url}`;
        }

        // For legacy logos/images without object storage prefix
        if (url.startsWith('/logos/') || url.startsWith('/business-images/') || url.startsWith('/profile-photos/')) {
          return `${baseUrl}${url}`;
        }

        return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      };

      // Process images and URLs in parallel
      const [absoluteSelectedImages, absoluteLogoUrl, ndaUrl] = [
        (cimDoc.selectedImages || []).map(processImageUrl).filter(Boolean),
        processImageUrl(cimDoc.logoUrl),
        cimDoc.ndaProtected ? `${baseUrl}/nda/${shareSlug}` : null
      ];

      console.log("=== SHARE ROUTE IMAGE DEBUG ===");
      console.log("Original logo URL:", cimDoc.logoUrl);
      console.log("Processed logo URL:", absoluteLogoUrl);
      console.log("Original selected images:", cimDoc.selectedImages);
      console.log("Processed selected images:", absoluteSelectedImages);

      console.log("URL processing time:", Date.now() - urlProcessingStart + "ms");

      // PERFORMANCE OPTIMIZATION 5: Streamlined profile sanitization with URL processing
      const sanitizedUserProfile = {
        name: userProfile.name,
        title: userProfile.title,
        email: userProfile.email,
        phoneNumber: userProfile.phoneNumber, // Use correct field name
        businessName: userProfile.businessName,
        businessLogo: processImageUrl(userProfile.businessLogo), // Process business logo URL
        profilePhoto: processImageUrl(userProfile.profilePhoto), // Process profile photo URL
        brandColors: userProfile.brandColors // Include brand colors for theme support
      };

      console.log("=== USER PROFILE IMAGE DEBUG ===");
      console.log("Original business logo:", userProfile.businessLogo);
      console.log("Processed business logo:", sanitizedUserProfile.businessLogo);
      console.log("Original profile photo:", userProfile.profilePhoto);
      console.log("Processed profile photo:", sanitizedUserProfile.profilePhoto);

      console.log("=== USER PROFILE PHONE DEBUG ===");
      console.log("userProfile.phoneNumber:", userProfile.phoneNumber);
      console.log("Final phoneNumber:", sanitizedUserProfile.phoneNumber);

      // Ensure view tracking completes (but don't wait for it)
      viewTrackingPromise.catch(error =>
        console.error('View tracking failed (non-blocking):', error)
      );

      console.log("Total optimized response time:", Date.now() - startTime + "ms");

      // Check if the current user is a collaborator (isOwner already computed earlier)
      let isCollaborator = false;
      if (req.isAuthenticated() && req.user && !isOwner) {
        const collaboration = await storage.getUserCollaboration(cimDoc.id, req.user.id);
        isCollaborator = !!collaboration;
      }

      const responseData = {
        cim: {
          id: cimDoc.id,
          title: cimDoc.title,
          analysis: cimDoc.analysis,
          logoUrl: absoluteLogoUrl,
          selectedImages: absoluteSelectedImages,
          financialsEnabled: cimDoc.financialsEnabled,
          askingPrice: cimDoc.askingPrice,
          askingPriceIncluded: cimDoc.askingPriceIncluded,
          revenue: cimDoc.revenue,
          revenueIncluded: cimDoc.revenueIncluded,
          ebitda: cimDoc.ebitda,
          ebitdaIncluded: cimDoc.ebitdaIncluded,
          coverImageUrl: cimDoc.coverImageUrl,
          coverImagePosition: cimDoc.coverImagePosition,
          coverImageAttribution: cimDoc.coverImageAttribution,
          createdAt: cimDoc.createdAt ? cimDoc.createdAt.toISOString() : null,
          userProfile: sanitizedUserProfile,
          userId: cimDoc.userId,
          shareSlug: cimDoc.shareSlug,
          displaySettings: cimDoc.displaySettings,
          externalUrl: cimDoc.externalUrl || null
        },
        websiteUrl: cimDoc.websiteUrl || '',
        selectedImages: absoluteSelectedImages,
        logoUrl: absoluteLogoUrl,
        userProfileData: sanitizedUserProfile,
        requiresNda: (cimDoc.ndaProtected || false) && !isOwner && !isCollaborator, // Bypass NDA for owner and collaborators
        ndaUrl,
        customSections: customSections ? customSections.map(section => ({
          ...section,
          imageUrls: section.imageUrls ? section.imageUrls.map(processImageUrl).filter(Boolean) : [],
          imageUrl: section.imageUrl ? processImageUrl(section.imageUrl) : null
        })) : [],
        ndaApprovalStatus,
        isOwner: isOwner,
        isCollaborator: isCollaborator,
        bypassedNda: (isOwner || isCollaborator) && Boolean(cimDoc.ndaProtected), // Let frontend know NDA was bypassed
        currentUserId: req.user?.id || null,
        // Analytics tracking info for frontend heartbeats
        viewSessionId: isOwner ? null : viewSessionId,
        viewerEmail: viewerEmail
      };

      // PERFORMANCE OPTIMIZATION 7: Cache successful responses (except when using tokens)
      if (shareCache && !token && !cimDoc.ndaProtected) {
        try {
          shareCache.set(cacheKey, responseData, CACHE_TTL.SHARE_DOCUMENT);
          console.log("Response cached for future requests");
        } catch (cacheError) {
          console.log("Cache write failed:", cacheError.message);
        }
      }

      res.json(responseData);
    } catch (error) {
      console.error("Share endpoint error:", error);
      res.status(500).json({
        error: "Failed to load shared document"
      });
    }
  });

  // Shared document export endpoints - PDF (OPTIMIZED)
  app.post("/api/share/:shareSlug/export/pdf", async (req, res) => {
    const startTime = Date.now();
    console.log("🔴🔴🔴 SHARE PDF EXPORT ENDPOINT HIT 🔴🔴🔴");
    const fsDebug = await import('fs');
    fsDebug.appendFileSync('/tmp/pdf-debug.log', `\n\n=== PDF EXPORT ${new Date().toISOString()} ===\n`);
    try {
      const { shareSlug } = req.params;
      console.log("Shared PDF export request for slug:", shareSlug);
      fsDebug.appendFileSync('/tmp/pdf-debug.log', `shareSlug: ${shareSlug}\n`);

      // PERFORMANCE OPTIMIZATION: Direct database query for shared PDF export
      const cimDoc = await storage.getCimByShareSlug(shareSlug);

      console.log("Document lookup time:", Date.now() - startTime + "ms");

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

      // Check password protection for PDF export
      if (cimDoc.sharePassword) {
        const { password } = req.body;
        const passwordsMatch = password ? await verifySharePassword(password as string, cimDoc.sharePassword) : false;
        console.log("PDF export password protection check:", {
          hasPassword: !!cimDoc.sharePassword,
          providedPassword: !!password,
          passwordsMatch
        });

        if (!password || !passwordsMatch) {
          console.log("ERROR: Invalid or missing password for protected document PDF export");
          return res.status(401).json({
            error: "Password required for PDF export",
            requiresPassword: true
          });
        }
        console.log("PDF export password authentication successful");
      }

      // PERFORMANCE OPTIMIZATION: Parallel data fetching for shared PDF export
      const dataFetchStart = Date.now();
      const [userProfile, documentFinancialFiles, customSections] = await Promise.all([
        storage.getUser(cimDoc.userId),
        db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, cimDoc.id)),
        storage.getCustomSections(cimDoc.id)
      ]);

      console.log("Data fetch time:", Date.now() - dataFetchStart + "ms");
      console.log("Financial files for PDF export:", documentFinancialFiles?.length || 0, "files");
      if (documentFinancialFiles?.length > 0) {
        console.log("Sample financial file:", JSON.stringify(documentFinancialFiles[0], null, 2));
        console.log("ALL financial files for debugging:");
        documentFinancialFiles.forEach((file, index) => {
          console.log(`File ${index}:`, {
            id: file.id,
            filename: file.filename,
            cimDocumentId: file.cimDocumentId,
            filePath: file.filePath,
            fileSize: file.fileSize
          });
        });
      } else {
        console.log("ERROR: No financial files found for CIM document ID:", cimDoc.id);
      }

      if (!userProfile) {
        return res.status(404).json({ error: "Document owner not found" });
      }

      // Get document owner's PDF template preference
      const pdfTemplate = userProfile.pdfBackgroundTemplate || 'classic';

      // Prepare financial data from cached document properties
      const financialData = {
        enabled: cimDoc.financialsEnabled || false,
        askingPrice: cimDoc.askingPrice,
        askingPriceIncluded: cimDoc.askingPriceIncluded || false,
        revenue: cimDoc.revenue,
        revenueIncluded: cimDoc.revenueIncluded || false,
        ebitda: cimDoc.ebitda,
        ebitdaIncluded: cimDoc.ebitdaIncluded || false
      };

      console.log("Using cached analysis data - no reprocessing needed for shared PDF export");

      // Get the base URL from the request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host || 'brokervault.ai';
      // Use production domain for image URLs in production environment
      let baseUrl;
      if (process.env.NODE_ENV === 'production' || host?.includes('brokervault.ai')) {
        baseUrl = 'https://brokervault.ai';
      } else {
        baseUrl = `${protocol}://${host}`;
      }

      // Process user profile images for PDF generation using same logic as share route
      const processImageUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:') || url.startsWith('http')) return url;

        // Handle object storage URLs
        if (url.startsWith('/api/object-storage/')) {
          return `${baseUrl}${url}`;
        }

        // For user-specific images
        if (url.startsWith('/user-images/')) {
          return `${baseUrl}${url}`;
        }

        // For legacy logos/images
        if (url.startsWith('/logos/') || url.startsWith('/business-images/') || url.startsWith('/profile-photos/')) {
          return `${baseUrl}${url}`;
        }

        return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      };

      // Create processed user profile for PDF generation with proper image URLs
      const processedUserProfile = {
        ...userProfile,
        businessLogo: processImageUrl(userProfile.businessLogo),
        profilePhoto: processImageUrl(userProfile.profilePhoto)
      };

      console.log("=== PDF EXPORT USER PROFILE IMAGE DEBUG ===");
      console.log("Original business logo:", userProfile.businessLogo);
      console.log("Processed business logo:", processedUserProfile.businessLogo);
      console.log("Original profile photo:", userProfile.profilePhoto);
      console.log("Processed profile photo:", processedUserProfile.profilePhoto);
      console.log("===========================================");

      // Process logo URL and selected images with proper URL conversion for PDF export
      const processedLogoUrl = processImageUrl(cimDoc.logoUrl);
      const processedSelectedImages = (cimDoc.selectedImages || []).map(processImageUrl).filter(Boolean);
      const processedCoverImageUrl = processImageUrl(cimDoc.coverImageUrl);

      // Process custom section images for PDF export (similar to share route processing)
      const processedCustomSections = customSections ? customSections.map(section => ({
        ...section,
        imageUrls: section.imageUrls ? section.imageUrls.map(processImageUrl).filter(Boolean) : [],
        imageUrl: section.imageUrl ? processImageUrl(section.imageUrl) : null
      })) : [];

      console.log("=== PDF EXPORT IMAGE URL PROCESSING ===");
      console.log("Original logo URL:", cimDoc.logoUrl);
      console.log("Processed logo URL:", processedLogoUrl);
      console.log("Original selected images:", cimDoc.selectedImages);
      console.log("Processed selected images:", processedSelectedImages);
      console.log("Original cover image URL:", cimDoc.coverImageUrl);
      console.log("Processed cover image URL:", processedCoverImageUrl);
      console.log("Custom sections count:", customSections?.length || 0);
      if (customSections && customSections.length > 0) {
        console.log("Custom sections image processing:");
        customSections.forEach((section, index) => {
          console.log(`Section ${index}:`, {
            type: section.type,
            originalImageUrls: section.imageUrls,
            processedImageUrls: processedCustomSections[index]?.imageUrls
          });
        });
      }
      console.log("==========================================");

      // Debug financial files before PDF generation
      console.log("=== PDF EXPORT FINANCIAL FILES DEBUG ===");
      console.log("documentFinancialFiles count:", documentFinancialFiles?.length || 0);
      if (documentFinancialFiles && documentFinancialFiles.length > 0) {
        console.log("Financial files data structure:");
        documentFinancialFiles.forEach((file, index) => {
          console.log(`File ${index}:`, {
            id: file.id,
            filename: file.filename,
            file_size: file.file_size,
            fileSize: file.fileSize,
            cim_document_id: file.cim_document_id,
            cimDocumentId: file.cimDocumentId,
            filePath: file.filePath,
            file_path: file.file_path
          });
        });
      } else {
        console.log("No financial files found for PDF generation");
      }
      console.log("shareSlug being passed:", shareSlug);
      console.log("==========================================");

      // PERFORMANCE OPTIMIZATION: Direct PDF generation with cached data
      const pdfGenStart = Date.now();

      // Get branded PDF template settings from user profile
      const brandedPdfTemplate = userProfile.brandedPdfTemplate || 'none';

      // Build effective brand colors: use user-selected colors if set, otherwise fall back to extracted colors
      const extractedColors = userProfile.brandColors || [];
      const effectivePrimaryColor = userProfile.pdfPrimaryColor || (extractedColors[0] as string) || '#3b82f6';
      const effectiveSecondaryColor = userProfile.pdfSecondaryColor || (extractedColors[1] as string) || '#e5e7eb';
      const brandColors = [effectivePrimaryColor, effectiveSecondaryColor];

      console.log("=== BRANDED PDF TEMPLATE DEBUG ===");
      console.log("brandedPdfTemplate:", brandedPdfTemplate);
      console.log("extractedColors:", extractedColors);
      console.log("effectivePrimaryColor:", effectivePrimaryColor);
      console.log("effectiveSecondaryColor:", effectiveSecondaryColor);
      console.log("brandColors (final):", brandColors);
      console.log("businessLogo (processed):", processedUserProfile.businessLogo);
      console.log("==================================");

      // Write to debug file
      fsDebug.appendFileSync('/tmp/pdf-debug.log', `brandedPdfTemplate: ${brandedPdfTemplate}\n`);
      fsDebug.appendFileSync('/tmp/pdf-debug.log', `brandColors: ${JSON.stringify(brandColors)}\n`);
      fsDebug.appendFileSync('/tmp/pdf-debug.log', `businessLogo: ${processedUserProfile.businessLogo}\n`);

      // PERF-016: TODO - Move PDF generation to worker thread for better scalability
      // PDF generation is CPU-intensive and blocks the main event loop, causing latency
      // for other concurrent requests. To fix this:
      //
      // 1. Create server/workers/pdf-worker.ts:
      //    import { parentPort, workerData } from 'worker_threads';
      //    import { generatePDF } from '../document-export';
      //    async function run() {
      //      try {
      //        const pdfBuffer = await generatePDF(...workerData.params);
      //        parentPort?.postMessage({ success: true, buffer: pdfBuffer });
      //      } catch (error) {
      //        parentPort?.postMessage({ success: false, error: error.message });
      //      }
      //    }
      //    run();
      //
      // 2. Create helper function in routes.ts:
      //    import { Worker } from 'worker_threads';
      //    function generatePDFInWorker(params: any[]): Promise<Buffer> {
      //      return new Promise((resolve, reject) => {
      //        const worker = new Worker('./workers/pdf-worker.js', { workerData: { params } });
      //        worker.on('message', (result) => {
      //          if (result.success) resolve(Buffer.from(result.buffer));
      //          else reject(new Error(result.error));
      //        });
      //        worker.on('error', reject);
      //      });
      //    }
      //
      // 3. Replace this generatePDF call with generatePDFInWorker(params)
      //
      // Alternative: Use setImmediate() to yield to event loop during PDF generation,
      // or implement a job queue (e.g., BullMQ) for background PDF processing.
      const pdfBuffer = await generatePDF(
        cimDoc.analysis, // Use cached analysis - no regeneration
        processedLogoUrl, // Use processed logo URL with proper base URL
        cimDoc.websiteUrl || undefined,
        processedSelectedImages, // Use processed images with proper base URLs
        processedUserProfile, // Use processed user profile with correct image URLs
        financialData,
        documentFinancialFiles,
        baseUrl,
        cimDoc.title,
        processedCustomSections, // Use processed custom sections with proper image URLs
        processedCoverImageUrl, // Use processed cover image URL
        cimDoc.coverImagePosition,
        cimDoc.id,
        pdfTemplate, // Pass user's template preference
        shareSlug, // Pass shareSlug to PDF generator for shared links
        brandedPdfTemplate, // Pass branded template preference (accent-bar, etc.)
        brandColors, // Pass user's brand colors
        processedUserProfile.businessLogo // Pass processed business logo URL
      );

      console.log("PDF generation time:", Date.now() - pdfGenStart + "ms");
      console.log("Total shared PDF export time:", Date.now() - startTime + "ms");
      console.log("PDF generation completed, buffer length:", pdfBuffer.length);

      // Dispatch cim.downloaded event
      const viewerEmail = req.body.viewerEmail || 'anonymous';
      const cimDownloadedPayload = {
        cim_id: cimDoc.id,
        title: cimDoc.title,
        viewer_email: viewerEmail,
        download_type: 'pdf',
        downloaded_at: new Date().toISOString(),
      };
      dispatchIntegrationEvent(cimDoc.userId, 'cim.downloaded', cimDownloadedPayload)
        .catch(err => console.error('Integration dispatch error:', err));
      dispatchWebhookEvent(cimDoc.userId, 'cim.downloaded', cimDownloadedPayload)
        .catch(err => console.error('Webhook dispatch error:', err));

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="cim-${cimDoc.id}.pdf"`);
      res.send(pdfBuffer);

    } catch (error) {
      console.error("Shared PDF export error:", error);
      res.status(500).json({ error: "Failed to generate PDF document" });
    }
  });

  // Shared document export endpoints - Word
  app.post("/api/share/:shareSlug/export/word", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      console.log("Shared Word export request for slug:", shareSlug);

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

      // Check password protection for Word export
      if (cimDoc.sharePassword) {
        const { password } = req.body;
        const passwordsMatch = password ? await verifySharePassword(password as string, cimDoc.sharePassword) : false;
        console.log("Word export password protection check:", {
          hasPassword: !!cimDoc.sharePassword,
          providedPassword: !!password,
          passwordsMatch
        });

        if (!password || !passwordsMatch) {
          console.log("ERROR: Invalid or missing password for protected document Word export");
          return res.status(401).json({
            error: "Password required for Word export",
            requiresPassword: true
          });
        }
        console.log("Word export password authentication successful");
      }

      // Get user profile for contact information
      const userProfile = await storage.getUser(cimDoc.userId);

      // Get financial data if available
      const financialData = {
        enabled: cimDoc.financialsEnabled || false,
        askingPrice: cimDoc.askingPrice,
        askingPriceIncluded: cimDoc.askingPriceIncluded || false,
        revenue: cimDoc.revenue,
        revenueIncluded: cimDoc.revenueIncluded || false,
        ebitda: cimDoc.ebitda,
        ebitdaIncluded: cimDoc.ebitdaIncluded || false
      };

      console.log("Generating Word document with full context:", {
        logoUrl: cimDoc.logoUrl,
        selectedImages: cimDoc.selectedImages?.length || 0,
        websiteUrl: cimDoc.websiteUrl,
        hasUserProfile: !!userProfile,
        financialData: financialData.enabled
      });

      const wordBuffer = await generateWordDocument(
        cimDoc.analysis,
        cimDoc.logoUrl || undefined,
        cimDoc.websiteUrl || undefined,
        cimDoc.selectedImages ? cimDoc.selectedImages : undefined,
        userProfile,
        financialData,
        cimDoc.id
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="cim-${cimDoc.id}.docx"`);
      res.send(wordBuffer);

    } catch (error) {
      console.error("Shared Word export error:", error);
      res.status(500).json({ error: "Failed to generate Word document" });
    }
  });

  // Get uploaded files for a shared CIM document (public endpoint)
  app.get("/api/share/:shareSlug/files", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);

      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      const files = await storage.getUploadedFiles(cimDoc.id);
      res.json(files);
    } catch (error) {
      console.error("Error fetching shared document files:", error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // Get financial files for a shared CIM document (public endpoint)
  app.get("/api/share/:shareSlug/financial-files", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);

      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      const files = await db
        .select()
        .from(financialFiles)
        .where(eq(financialFiles.cimDocumentId, cimDoc.id))
        .orderBy(desc(financialFiles.uploadedAt));

      res.json(files);
    } catch (error) {
      console.error("Error fetching shared document financial files:", error);
      res.status(500).json({ error: "Failed to fetch financial files" });
    }
  });

  // Download financial file from shared document (public endpoint)
  app.get("/api/share/:shareSlug/financial-files/:fileId/download", async (req, res) => {
    try {
      const { shareSlug, fileId } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);

      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      const file = await db
        .select()
        .from(financialFiles)
        .where(eq(financialFiles.id, parseInt(fileId)))
        .then(files => files[0]);

      if (!file || file.cimDocumentId !== cimDoc.id) {
        return res.status(404).json({ error: "Financial file not found" });
      }

      // All files are available since there's no included field in current schema

      // Download file from object storage
      try {
        const fileBuffer = await fileStorageManager.downloadFile(file.filePath);

        // Get MIME type from file extension
        const ext = path.extname(file.filename).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
          '.pdf': 'application/pdf',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png'
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // Set appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.setHeader('Content-Type', mimeType);

        // Send the file buffer
        res.send(fileBuffer);
      } catch (downloadError) {
        console.error('Error downloading file from object storage:', downloadError);
        return res.status(404).json({ error: "File not found in storage" });
      }
    } catch (error) {
      console.error('Error downloading shared financial file:', error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Bulk download all financial files from shared document (public endpoint)
  app.get("/api/share/:shareSlug/financial-files/bulk-download", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);

      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      // Check expiration
      if (cimDoc.shareExpiresAt && new Date() > cimDoc.shareExpiresAt) {
        return res.status(410).json({ error: "This shared link has expired" });
      }

      const files = await db
        .select()
        .from(financialFiles)
        .where(eq(financialFiles.cimDocumentId, cimDoc.id))
        .orderBy(desc(financialFiles.uploadedAt));

      // All files are included since there's no included field in current schema
      const includedFiles = files;

      if (includedFiles.length === 0) {
        return res.status(404).json({ error: "No financial files available" });
      }

      const archive = archiver('zip', { zlib: { level: 9 } });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="financial-documents-${cimDoc.title || 'document'}.zip"`);

      archive.pipe(res);

      for (const file of includedFiles) {
        try {
          const fileBuffer = await fileStorageManager.downloadFile(file.filePath);
          archive.append(fileBuffer, { name: file.filename });
        } catch (fileError) {
          console.error(`Error adding file ${file.filename} to archive:`, fileError);
        }
      }

      await archive.finalize();
    } catch (error) {
      console.error('Error creating bulk download:', error);
      res.status(500).json({ error: "Failed to create download archive" });
    }
  });

  // Download individual uploaded file from shared document
  app.get("/api/share/:shareSlug/download/:fileId", async (req, res) => {
    try {
      const { shareSlug, fileId } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);

      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      const files = await storage.getUploadedFiles(cimDoc.id);
      const file = files.find(f => f.id === parseInt(fileId));

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      try {
        let fileBuffer;

        // Try object storage first (for migrated files)
        try {
          fileBuffer = await fileStorageManager.downloadFile(file.filePath);
        } catch (objectStorageError) {
          // Fallback to filesystem for legacy files
          try {
            await fs.access(file.filePath);
            fileBuffer = await fs.readFile(file.filePath);
            console.log("Served legacy shared file from filesystem:", file.filePath);
          } catch (fsError) {
            throw new Error("File not found in object storage or filesystem");
          }
        }

        // Set appropriate headers
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);

        // Stream the file
        res.send(fileBuffer);
      } catch (fileError) {
        return res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      console.error("Shared file download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Download all files as ZIP from shared document
  app.get("/api/share/:shareSlug/download-all", async (req, res) => {
    try {
      const { shareSlug } = req.params;
      const cimDoc = await storage.getCimByShareSlug(shareSlug);

      if (!cimDoc || !cimDoc.shareEnabled) {
        return res.status(404).json({ error: "Document not found or not shared" });
      }

      const files = await storage.getUploadedFiles(cimDoc.id);

      if (files.length === 0) {
        return res.status(404).json({ error: "No files found" });
      }

      const zip = new JSZip();

      // Add each file to the ZIP
      for (const file of files) {
        try {
          let fileBuffer;

          // Try object storage first (for migrated files)
          try {
            fileBuffer = await fileStorageManager.downloadFile(file.filePath);
          } catch (objectStorageError) {
            // Fallback to filesystem for legacy files
            try {
              fileBuffer = await fs.readFile(file.filePath);
              console.log("Added legacy file from filesystem to ZIP:", file.filePath);
            } catch (fsError) {
              console.warn(`Could not add file ${file.fileName} to ZIP - not found in object storage or filesystem:`, fsError);
              continue;
            }
          }

          zip.file(file.fileName, fileBuffer);
        } catch (fileError) {
          console.warn(`Could not add file ${file.fileName} to ZIP:`, fileError);
        }
      }

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Set headers for ZIP download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${cimDoc.title}_files.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error("Bulk download error:", error);
      res.status(500).json({ error: "Failed to create ZIP file" });
    }
  });

}
