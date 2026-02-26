import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { financialFiles } from "@shared/schema";
import { generateWordDocument, generatePDF, generateHtml, formatTextContent } from "../document-export";
import { exportToWordPress, formatWordPressContent } from "../wordpress-export";

export function registerExportRoutes(app: Express) {
  app.post("/api/cim/export/word/:id", async (req, res) => {
    console.log("Word export request received for document ID:", req.params.id);

    if (!req.isAuthenticated()) {
      console.log("Word export authentication error - User not authenticated");
      return res.sendStatus(401);
    }

    try {
      console.log("User authenticated, retrieving document");
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);

      if (!doc) {
        console.log(`Document with ID ${docId} not found`);
        return res.status(404).json({ error: "Document not found" });
      }

      if (doc.userId !== req.user!.id) {
        console.log(`Access error: Document belongs to user ${doc.userId}, request from user ${req.user!.id}`);
        return res.status(404).json({ error: "Document not found" });
      }

      const user = await storage.getUser(req.user!.id);
      console.log(`User subscription status: ${user?.subscriptionStatus}, isAdmin: ${user?.isAdmin}`);

      if (!user?.isAdmin && user?.subscriptionStatus !== "premium" && user?.subscriptionStatus !== "admin") {
        console.log("Permission error: User does not have premium/admin access");
      }

      console.log("Generating Word document with complete data...");
      console.log("Document object logoUrl field:", doc.logoUrl);
      console.log("Document object keys:", Object.keys(doc));
      const userProfile = {
        name: user?.name,
        title: user?.title,
        phoneNumber: user?.phoneNumber,
        email: user?.email,
        businessName: user?.businessName,
        businessLogo: user?.businessLogo,
        profilePhoto: user?.profilePhoto
      };

      // Get financial data from CIM document
      const financialData = {
        enabled: doc.financialsEnabled || false,
        askingPrice: doc.askingPrice,
        askingPriceIncluded: doc.askingPriceIncluded || false,
        revenue: doc.revenue,
        revenueIncluded: doc.revenueIncluded || false,
        ebitda: doc.ebitda,
        ebitdaIncluded: doc.ebitdaIncluded || false
      };

      const buffer = await generateWordDocument(doc.analysis, doc.logoUrl || undefined, doc.websiteUrl || undefined, doc.selectedImages ? doc.selectedImages : undefined, userProfile, financialData, doc.id);
      console.log(`Word document generated, size: ${buffer.length} bytes`);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      // Use the document title in the filename for better user experience
      const safeTitle = doc.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      res.setHeader("Content-Disposition", `attachment; filename=cim-${safeTitle}.docx`);

      console.log("Sending Word document to client");
      res.send(buffer);
      console.log("Word document sent successfully");
    } catch (error) {
      console.error("Word export error:", error);
      res.status(500).json({ error: "Failed to generate Word document" });
    }
  });

  app.post("/api/cim/export/pdf/:id", async (req, res) => {
    console.log("PDF export request received for document ID:", req.params.id);

    if (!req.isAuthenticated()) {
      console.log("PDF export authentication error - User not authenticated");
      return res.sendStatus(401);
    }

    try {
      console.log("User authenticated, retrieving document");
      const docId = parseInt(req.params.id);
      const doc = await storage.getCimDocument(docId);

      if (!doc) {
        console.log(`Document with ID ${docId} not found`);
        return res.status(404).json({ error: "Document not found" });
      }

      if (doc.userId !== req.user!.id) {
        console.log(`Access error: Document belongs to user ${doc.userId}, request from user ${req.user!.id}`);
        return res.status(404).json({ error: "Document not found" });
      }

      // Parallel data fetching for better performance
      const [user, customSections, documentFinancialFiles] = await Promise.all([
        storage.getUser(req.user!.id),
        storage.getCustomSections(docId),
        db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, docId))
      ]);

      console.log(`User subscription status: ${user?.subscriptionStatus}, isAdmin: ${user?.isAdmin}`);

      if (!user?.isAdmin && user?.subscriptionStatus !== "premium" && user?.subscriptionStatus !== "admin") {
        console.log("Permission error: User does not have premium/admin access");
      }

      console.log("Generating PDF document with complete data...");

      // Prepare user profile and financial data
      const userProfile: Record<string, any> = {
        name: user?.name,
        title: user?.title,
        phoneNumber: user?.phoneNumber,
        email: user?.email,
        businessName: user?.businessName,
        businessLogo: user?.businessLogo,
        profilePhoto: user?.profilePhoto
      };

      const financialData = {
        enabled: doc.financialsEnabled || false,
        askingPrice: doc.askingPrice,
        askingPriceIncluded: doc.askingPriceIncluded || false,
        revenue: doc.revenue,
        revenueIncluded: doc.revenueIncluded || false,
        ebitda: doc.ebitda,
        ebitdaIncluded: doc.ebitdaIncluded || false
      };

      // Get the base URL from the request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host || req.get('host') || '';
      let baseUrl = `${protocol}://${host}`;

      // Get user's PDF template preferences
      const pdfTemplate = userProfile.pdfBackgroundTemplate || 'classic';
      const brandedPdfTemplate = userProfile.brandedPdfTemplate || 'none';

      // Build effective brand colors: use user-selected colors if set, otherwise fall back to extracted colors
      const extractedColors = userProfile.brandColors || [];
      const effectivePrimaryColor = userProfile.pdfPrimaryColor || (extractedColors[0] as string) || '#3b82f6';
      const effectiveSecondaryColor = userProfile.pdfSecondaryColor || (extractedColors[1] as string) || '#e5e7eb';
      const brandColors = [effectivePrimaryColor, effectiveSecondaryColor];

      const processedBusinessLogo = userProfile.businessLogo ?
        (userProfile.businessLogo.startsWith('http') || userProfile.businessLogo.startsWith('data:')
          ? userProfile.businessLogo
          : `${baseUrl}${userProfile.businessLogo.startsWith('/') ? '' : '/'}${userProfile.businessLogo}`)
        : null;

      // Process image URLs for PDF export using the same logic as share route
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

      // Process logo URL and selected images with proper URL conversion for PDF export
      const processedLogoUrl = processImageUrl(doc.logoUrl);
      const processedSelectedImages = (doc.selectedImages || []).map(processImageUrl).filter(Boolean) as string[];
      const processedCoverImageUrl = processImageUrl(doc.coverImageUrl);

      console.log("=== REGULAR PDF EXPORT IMAGE URL PROCESSING ===");
      console.log("Original logo URL:", doc.logoUrl);
      console.log("Processed logo URL:", processedLogoUrl);
      console.log("Original selected images:", doc.selectedImages);
      console.log("Processed selected images:", processedSelectedImages);
      console.log("Original cover image URL:", doc.coverImageUrl);
      console.log("Processed cover image URL:", processedCoverImageUrl);
      console.log("===============================================");

      // Pass all document data to the PDF generator
      console.log("=== BRANDED PDF TEMPLATE DEBUG (REGULAR EXPORT) ===");
      console.log("brandedPdfTemplate:", brandedPdfTemplate);
      console.log("brandColors:", brandColors);
      console.log("processedBusinessLogo:", processedBusinessLogo);
      console.log("===================================================");

      const buffer = await generatePDF(
        doc.analysis,
        processedLogoUrl,
        doc.websiteUrl || undefined,
        processedSelectedImages,
        userProfile,
        financialData,
        documentFinancialFiles,
        baseUrl,
        doc.title,
        customSections,
        processedCoverImageUrl,
        doc.coverImagePosition,
        doc.id,
        pdfTemplate,
        undefined, // shareSlug - not applicable for regular export
        brandedPdfTemplate, // Pass branded template preference
        brandColors, // Pass user's brand colors
        processedBusinessLogo // Pass processed business logo URL
      );
      console.log(`PDF document generated, size: ${buffer.length} bytes`);

      res.setHeader("Content-Type", "application/pdf");
      // Use the document title in the filename for better user experience
      const safeTitle = doc.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      res.setHeader("Content-Disposition", `attachment; filename=cim-${safeTitle}.pdf`);

      console.log("Sending PDF document to client");
      res.send(buffer);
      console.log("PDF document sent successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // HTML export endpoint for clipboard export with formatting
  app.post("/api/cim/export/html/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const docId = parseInt(req.params.id);
      console.log(`Processing HTML export request for document ID: ${docId}, user ID: ${req.user?.id}`);

      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID format" });
      }

      const doc = await storage.getCimDocument(docId);

      if (!doc) {
        console.log(`Document with ID ${docId} not found`);
        return res.status(404).json({ error: "Document not found" });
      }

      if (doc.userId !== req.user!.id) {
        console.log(`Access denied: Document belongs to user ${doc.userId}, but request is from user ${req.user!.id}`);
        return res.status(403).json({ error: "You don't have permission to access this document" });
      }

      console.log(`Generating HTML for document: ${doc.title}, analysis present: ${Boolean(doc.analysis)}`);

      if (!doc.analysis) {
        return res.status(400).json({ error: "Document has no analysis data" });
      }

      // Get user profile for contact footer
      const profileUser = await storage.getUser(req.user!.id);
      const userProfile = {
        name: profileUser?.name,
        title: profileUser?.title,
        phoneNumber: profileUser?.phoneNumber,
        email: profileUser?.email,
        businessName: profileUser?.businessName,
        businessLogo: profileUser?.businessLogo,
        profilePhoto: profileUser?.profilePhoto
      };

      // Get financial data from CIM document and files
      const financialData = {
        enabled: doc.financialsEnabled || false,
        askingPrice: doc.askingPrice,
        askingPriceIncluded: doc.askingPriceIncluded || false,
        revenue: doc.revenue,
        revenueIncluded: doc.revenueIncluded || false,
        ebitda: doc.ebitda,
        ebitdaIncluded: doc.ebitdaIncluded || false
      };

      let financialFilesList: any[] = [];
      try {
        const files = await db.select().from(financialFiles).where(eq(financialFiles.cimDocumentId, docId));
        financialFilesList = files;
      } catch (error) {
        console.log("Error fetching financial files:", error);
      }

      // Include logo URL, user profile, financial data, and files
      // Use production domain for image URLs in production environment
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      let baseUrl = `${protocol}://${host}`;

      const html = generateHtml(doc.analysis, doc.logoUrl || undefined, userProfile, doc.websiteUrl || undefined, doc.selectedImages ? doc.selectedImages : undefined, financialData, financialFilesList, baseUrl);

      if (!html) {
        return res.status(500).json({ error: "Failed to generate HTML content" });
      }

      console.log(`Successfully generated HTML content (${html.length} characters)`);
      res.json({ html });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("HTML export error:", error);
      console.error("Error details:", errorMessage);
      res.status(500).json({
        error: "Failed to generate HTML content",
        details: errorMessage
      });
    }
  });

  app.post("/api/cim/export/wordpress/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const doc = await storage.getCimDocument(parseInt(req.params.id));
      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ error: "Document not found" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user?.isAdmin && user?.subscriptionStatus !== "premium" && user?.subscriptionStatus !== "admin") {
      }

      const {
        wpUrl,
        username,
        password,
        postId,
        status,
        template,
        useCustomField,
        useToolsetFields = false,
        postType = 'listing'
      } = req.body;

      if (!wpUrl || !username || !password) {
        return res.status(400).json({
          error: "Missing WordPress credentials",
          requiredFields: ["wpUrl", "username", "password"]
        });
      }

      // Basic URL validation
      if (!wpUrl.startsWith('http://') && !wpUrl.startsWith('https://')) {
        return res.status(400).json({
          error: "WordPress URL must start with http:// or https://"
        });
      }

      // Format the CIM data for WordPress - both as rich content and plain text
      const wpContent = formatWordPressContent(doc.analysis);
      const plainTextContent = formatTextContent(doc.analysis);

      // Set up custom fields
      const customFields: Record<string, string | number> = {
        cim_generated: "true", // Convert to string as WordPress custom fields usually expect string values
        cim_generator_id: doc.id,
        cim_date: new Date().toISOString()
      };

      // Always store the raw text in wpcf-text-dump custom field for backward compatibility
      customFields['wpcf-text-dump'] = plainTextContent;

      // If template is a Beaver Builder template (numeric ID)
      if (template && !isNaN(parseInt(template))) {
        const templateId = parseInt(template);
        // Set the Beaver Builder template ID in _fl_builder_template_id custom field
        customFields['_fl_builder_template_id'] = templateId;
        // Also set a flag to enable Beaver Builder for this post
        customFields['_fl_builder_enabled'] = '1';
      }
      // If it's a regular WordPress page template
      else if (template && template !== 'default') {
        customFields['_wp_page_template'] = `template-${template}.php`;
      }

      // Create minimal content for the main post content if using custom field or Toolset fields
      const content = (useCustomField || useToolsetFields) ?
        `<!-- wp:paragraph -->
        <p>This is a business listing created by CIM Generator. The full content is available in the custom fields.</p>
        <!-- /wp:paragraph -->` :
        wpContent;

      try {
        // Export to WordPress
        // Ensure content is properly formatted based on whether we're using Toolset fields
        const formattedAnalysis = doc.analysis ?
          (typeof doc.analysis === 'string' ? JSON.parse(doc.analysis) : doc.analysis) :
          {};

        console.log("Preparing WordPress export. Analysis data:",
          Object.keys(formattedAnalysis).join(', '));

        const result = await exportToWordPress({
          wpUrl,
          username,
          password,
          postId: postId ? parseInt(postId) : undefined,
          title: doc.title,
          content: useToolsetFields ? formattedAnalysis : content,
          status: status || 'draft',
          excerpt: `CIM Document for ${doc.title}`,
          customFields,
          useToolsetFields,
          postType
        });

        if (result.success) {
          res.json({
            success: true,
            postId: result.postId,
            url: result.url,
            fieldsUpdated: result.fieldsUpdated || 0
          });
        } else {
          throw new Error(result.error || "Failed to export to WordPress");
        }
      } catch (error) {
        // Handle specific WordPress API errors
        const errorMessage = error instanceof Error ? error.message : "Failed to export to WordPress";

        if (errorMessage.includes('HTML instead of JSON')) {
          return res.status(400).json({
            error: "The WordPress site returned HTML instead of JSON. Please check that the REST API is enabled and the site URL is correct.",
            details: "This typically happens when a WordPress site has REST API disabled or is using a security plugin that blocks API access."
          });
        }

        if (errorMessage.includes('listing') && errorMessage.includes('not available')) {
          return res.status(404).json({
            error: "The 'listing' post type is not available on this WordPress site.",
            details: "Please ensure your WordPress site has the 'listing' custom post type registered and available via the REST API."
          });
        }

        if (errorMessage.includes('not allowed to create')) {
          return res.status(403).json({
            error: "You don't have permission to create posts with this WordPress user.",
            details: "Please use an administrator account or a user with Editor role that has permissions to create 'listing' posts."
          });
        }

        res.status(500).json({
          error: errorMessage,
          details: "There was a problem connecting to WordPress or creating the listing."
        });
      }
    } catch (error) {
      console.error("WordPress export error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to export to WordPress"
      });
    }
  });
}
