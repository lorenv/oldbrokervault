import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const subscriptionPlans = {
  free: {
    name: "Free Trial",
    limit: 1,
    regenerationLimit: 2,
    price: 0
  },
  standard: {
    name: "CIM Share Standard Plan",
    limit: 20,
    regenerationLimit: Infinity,
    price: 99
  },
  enterprise: {
    name: "Enterprise",
    limit: Infinity,
    regenerationLimit: Infinity,
    price: 0 // Contact for pricing
  },
  admin: {
    name: "Admin",
    limit: Infinity,
    regenerationLimit: Infinity,
    price: 0
  }
} as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  subscriptionStatus: text("subscription_status").default("free").notNull(),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  monthlyUsage: integer("monthly_usage").default(0).notNull(), // Legacy field, keep for backward compatibility
  monthlyDocumentsCreated: integer("monthly_documents_created").default(0).notNull(),
  monthlyRegenerationsUsed: integer("monthly_regenerations_used").default(0).notNull(),
  lastUsageReset: timestamp("last_usage_reset").defaultNow().notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  subscriptionId: text("subscription_id").unique(),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiry: timestamp("google_token_expiry"),
  // Profile information fields
  name: text("name"),
  title: text("title"),
  phoneNumber: text("phone_number"),
  businessName: text("business_name"),
  businessLogo: text("business_logo"), // File path to business logo image
  profilePhoto: text("profile_photo"), // File path to profile photo image
  businessLogoBackup: text("business_logo_backup"), // Base64 backup during migration
  profilePhotoBackup: text("profile_photo_backup"), // Base64 backup during migration
  // Password reset fields
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  // PDF export preferences
  pdfBackgroundTemplate: text("pdf_background_template").default("classic"),
});

export const cimDocuments = pgTable("cim_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  transcript: text("transcript").notNull(),
  directions: text("directions").notNull(),
  regenerationCount: integer("regeneration_count").default(0).notNull(),
  analysis: jsonb("analysis").notNull(),
  // Uploaded file fields
  isUploadedFile: boolean("is_uploaded_file").default(false).notNull(),
  uploadedFileName: text("uploaded_file_name"),
  uploadedFilePath: text("uploaded_file_path"),
  uploadedFileSize: integer("uploaded_file_size"),
  uploadedFileMimeType: text("uploaded_file_mime_type"),
  editedContent: jsonb("edited_content"),
  logoUrl: text("logo_url"), // File path to logo image
  websiteUrl: text("website_url"),
  websiteScreenshotUrl: text("website_screenshot_url"),
  selectedImages: text("selected_images").array(), // File paths to selected images
  logoUrlBackup: text("logo_url_backup"), // Base64 backup during migration
  selectedImagesBackup: text("selected_images_backup").array(), // Base64 backup during migration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Sharing functionality
  shareEnabled: boolean("share_enabled").default(false).notNull(),
  shareSlug: text("share_slug").unique(),
  customSlug: text("custom_slug").unique(),
  sharePassword: text("share_password"),
  shareExpiresAt: timestamp("share_expires_at"),
  shareViewCount: integer("share_view_count").default(0).notNull(),
  shareLastViewed: timestamp("share_last_viewed"),
  // NDA protection
  ndaProtected: boolean("nda_protected").default(false).notNull(),
  ndaTemplateId: integer("nda_template_id"),
  ndaApprovalRequired: boolean("nda_approval_required").default(false).notNull(),
  // Financial data fields
  financialsEnabled: boolean("financials_enabled").default(false).notNull(),
  askingPrice: text("asking_price"),
  askingPriceIncluded: boolean("asking_price_included").default(false).notNull(),
  revenue: text("revenue"),
  revenueIncluded: boolean("revenue_included").default(false).notNull(),
  ebitda: text("ebitda"),
  ebitdaIncluded: boolean("ebitda_included").default(false).notNull(),
  // Collaboration fields
  currentEditorId: integer("current_editor_id"),
  currentEditorName: text("current_editor_name"),
  editStartedAt: timestamp("edit_started_at"),
  lastActivityAt: timestamp("last_activity_at"),
  // Cover image fields
  coverImageUrl: text("cover_image_url"),
  coverImagePosition: text("cover_image_position"), // JSON string for image positioning within 16:3 frame
  coverImageAttribution: text("cover_image_attribution"), // For Unsplash credits
  coverImageBackup: text("cover_image_backup"), // Base64 backup for deployment persistence
  // Search and version tracking (premium features)
  searchVector: text("search_vector"), // Full-text search vector
  version: integer("version").default(1).notNull(),
  lastModifiedBy: integer("last_modified_by")
});

export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull()
});

export const customSections = pgTable("custom_sections", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  type: text("type").notNull(), // 'text' or 'image'
  title: text("title"), // Section title
  content: text("content"), // Rich text content for text sections
  imageUrls: text("image_urls").array(), // Array of image file paths for image sections
  imageUrl: text("image_url"), // Legacy single image URL - kept for backward compatibility
  imageUrlsBackup: text("image_urls_backup").array(), // Base64 backup during migration
  position: integer("position").notNull(), // Order position in the document
  insertAfterSection: text("insert_after_section").notNull(), // Which section this appears after
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const customTags = pgTable("custom_tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const ndaTemplates = pgTable("nda_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  fileContent: text("file_content").notNull(), // Base64 encoded PDF
  isDefault: boolean("is_default").default(false).notNull(),
  signatureFields: jsonb("signature_fields").default([]).notNull(), // Array of field definitions
  pageImages: jsonb("page_images").default([]).notNull(), // Array of processed page image data
  totalPages: integer("total_pages").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const shareLinks = pgTable("share_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  cimDocumentId: integer("cim_document_id").notNull(),
  shareSlug: text("share_slug").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  viewCount: integer("view_count").default(0).notNull()
});

export const ndaSignatures = pgTable("nda_signatures", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  shareSlug: text("share_slug"),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  signerIpAddress: text("signer_ip_address").notNull(),
  signerLocation: text("signer_location"), // Geographic location from IP
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  signedNdaContent: text("signed_nda_content").notNull(), // Base64 encoded signed PDF
  approved: boolean("approved").default(false).notNull(),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by"), // User ID who approved
  fieldValues: jsonb("field_values").default({}).notNull() // Field ID to value mapping
});

// NDA Access Tokens - unique tokens for users who signed NDAs
export const ndaAccessTokens = pgTable("nda_access_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").unique().notNull(), // Unique secure token
  cimDocumentId: integer("cim_document_id").notNull(),
  ndaSignatureId: integer("nda_signature_id").notNull(),
  signerEmail: text("signer_email").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
  expiresAt: timestamp("expires_at"), // Optional expiration
});

// NDA Redirect Links - stable URLs that redirect to current tokens
export const ndaRedirectLinks = pgTable("nda_redirect_links", {
  id: serial("id").primaryKey(),
  redirectId: text("redirect_id").unique().notNull(), // Stable redirect identifier
  currentTokenId: integer("current_token_id").notNull(),
  cimDocumentId: integer("cim_document_id").notNull(),
  signerEmail: text("signer_email").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// View tracking for granular analytics based on NDA protection
export const documentViews = pgTable("document_views", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  viewerType: text("viewer_type").notNull(), // 'anonymous' or 'nda_signer'
  ndaAccessTokenId: integer("nda_access_token_id"), // Only for NDA signers
  signerEmail: text("signer_email"), // Only for NDA signers
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  sessionDuration: integer("session_duration"), // Optional: time spent on document in seconds
});



export const financialFiles = pgTable("financial_files", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(), // Secure path outside public folder
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  included: boolean("included").default(true).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull()
});

export const collaborators = pgTable("collaborators", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  userId: integer("user_id").notNull(),
  invitedBy: integer("invited_by").notNull(),
  email: text("email").notNull(),
  permission: text("permission").notNull(), // 'view' or 'edit'
  status: text("status").notNull(), // 'pending', 'accepted', 'declined'
  inviteToken: text("invite_token").unique(),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at")
});

// Premium feature: Document version history
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  version: integer("version").notNull(),
  changes: jsonb("changes").notNull(), // Store changed fields
  changedBy: integer("changed_by").notNull(),
  changeDescription: text("change_description"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Premium feature: Usage analytics
export const documentAnalytics = pgTable("document_analytics", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(), // 'view', 'edit', 'export', 'share'
  metadata: jsonb("metadata"), // Additional context
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  sessionId: text("session_id")
});

// Premium feature: Document search index
export const searchIndex = pgTable("search_index", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  content: text("content").notNull(),
  contentType: text("content_type").notNull(), // 'title', 'summary', 'section'
  searchVector: text("search_vector"),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Document baseline for regeneration validation
export const documentBaselines = pgTable("document_baselines", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull().unique(),
  baselineTranscript: text("baseline_transcript"), // Legacy field
  baselineDirections: text("baseline_directions"), // Legacy field
  baselineFinancials: jsonb("baseline_financials"), // Legacy field
  originalTranscript: text("original_transcript").notNull(),
  originalDirections: text("original_directions").notNull(),
  companyName: text("company_name"),
  industry: text("industry"),
  businessModel: text("business_model"),
  primaryMarket: text("primary_market"),
  originalRevenue: text("original_revenue"),
  originalEbitda: text("original_ebitda"),
  originalEmployeeCount: integer("original_employee_count"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Investor contact management for premium users
export const investorContacts = pgTable("investor_contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  notes: text("notes"),
  tags: text("tags").array().default([]).notNull(),
  status: text("status").default("new").notNull(), // 'new', 'contacted', 'interested', 'under_review', 'declined', 'closed'
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  totalDocumentViews: integer("total_document_views").default(0).notNull(),
  totalTimeSpentMinutes: integer("total_time_spent_minutes").default(0).notNull(),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  location: text("location"),
  isPotentialVpn: boolean("is_potential_vpn").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
}).extend({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
    .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
    .regex(/(?=.*\d)/, "Password must contain at least one number")
    .regex(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?])/, "Password must contain at least one special character"),
  email: z.string().email("Please enter a valid email address"),
  adminCode: z.string().optional()
});

export const insertCimDocumentSchema = createInsertSchema(cimDocuments).pick({
  title: true,
  transcript: true,
  directions: true,
}).extend({
  websiteUrl: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  websiteScreenshotUrl: z.string().nullable().optional(),
  selectedImages: z.array(z.string()).optional(),
  coverImageUrl: z.string().nullable().optional(),
  coverImagePosition: z.string().nullable().optional(),
  coverImageAttribution: z.string().nullable().optional()
});

export const insertUploadedCimSchema = createInsertSchema(cimDocuments).pick({
  title: true,
}).extend({
  isUploadedFile: z.boolean().default(true),
  uploadedFileName: z.string(),
  directions: z.string().optional(),
  websiteUrl: z.string().optional(),
  selectedImages: z.array(z.string()).optional(),
  coverImageUrl: z.string().nullable().optional(),
  coverImagePosition: z.string().nullable().optional(),
  coverImageAttribution: z.string().nullable().optional(),
  financials: z.any().optional(),
  customizations: z.any().optional(),
  docId: z.string().optional(),
  purpose: z.string().optional(),
  tone: z.string().optional(),
  audience: z.string().optional(),
  uploadedFilePath: z.string(),
  uploadedFileSize: z.number(),
  uploadedFileMimeType: z.string()
});

export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).pick({
  cimDocumentId: true,
  fileName: true,
  filePath: true,
  fileSize: true,
  mimeType: true
});

// Signature field schema for drag & drop functionality
export const signatureFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['signature', 'name', 'date', 'email', 'text']),
  label: z.string(),
  x: z.number(), // X coordinate on PDF page
  y: z.number(), // Y coordinate on PDF page
  width: z.number(),
  height: z.number(),
  pageNumber: z.number(),
  required: z.boolean().default(true),
  fontSize: z.number().default(12),
  placeholder: z.string().optional()
});

export const insertNdaTemplateSchema = createInsertSchema(ndaTemplates).pick({
  name: true,
  fileContent: true,
}).extend({
  isDefault: z.boolean().optional(),
  signatureFields: z.array(signatureFieldSchema).optional(),
  pageImages: z.array(z.object({
    pageNumber: z.number(),
    imagePath: z.string(),
    width: z.number(),
    height: z.number()
  })).optional(),
  totalPages: z.number().optional()
});

export const insertShareLinkSchema = createInsertSchema(shareLinks).pick({
  cimDocumentId: true,
  shareSlug: true,
}).extend({
  expiresAt: z.date().optional()
});

export const insertNdaSignatureSchema = createInsertSchema(ndaSignatures).pick({
  cimDocumentId: true,
  signerName: true,
  signerEmail: true,
  signerIpAddress: true,
  signerLocation: true,
  signedNdaContent: true
}).extend({
  shareSlug: z.string().optional(),
  fieldValues: z.record(z.string()).optional() // Field ID to value mapping
});

export const insertNdaAccessTokenSchema = createInsertSchema(ndaAccessTokens).pick({
  token: true,
  cimDocumentId: true,
  ndaSignatureId: true,
  signerEmail: true
}).extend({
  expiresAt: z.date().optional()
});

export const insertNdaRedirectLinkSchema = createInsertSchema(ndaRedirectLinks).pick({
  redirectId: true,
  currentTokenId: true,
  cimDocumentId: true,
  signerEmail: true
});

export const insertDocumentViewSchema = createInsertSchema(documentViews).pick({
  cimDocumentId: true,
  viewerType: true,
}).extend({
  ndaAccessTokenId: z.number().optional(),
  signerEmail: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  sessionDuration: z.number().optional()
});



export const insertFinancialFileSchema = createInsertSchema(financialFiles).pick({
  cimDocumentId: true,
  fileName: true,
  originalName: true,
  filePath: true,
  fileSize: true,
  mimeType: true,
  included: true
});

export const insertCustomTagSchema = createInsertSchema(customTags).pick({
  userId: true,
  name: true,
  color: true
});

export const insertCollaboratorSchema = createInsertSchema(collaborators).pick({
  cimDocumentId: true,
  email: true,
  permission: true,
  invitedBy: true
}).extend({
  permission: z.enum(["view", "edit"]),
  email: z.string().email("Please enter a valid email address")
});

export const insertDocumentBaselineSchema = createInsertSchema(documentBaselines).pick({
  cimDocumentId: true,
  originalTranscript: true,
  originalDirections: true,
  companyName: true,
  industry: true,
  businessModel: true,
  primaryMarket: true,
  originalRevenue: true,
  originalEbitda: true,
  originalEmployeeCount: true
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CimDocument = typeof cimDocuments.$inferSelect;
export type InsertCimDocument = z.infer<typeof insertCimDocumentSchema>;
export type InsertUploadedCim = z.infer<typeof insertUploadedCimSchema>;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
export type NdaTemplate = typeof ndaTemplates.$inferSelect;
export type InsertNdaTemplate = z.infer<typeof insertNdaTemplateSchema>;
export type NdaSignature = typeof ndaSignatures.$inferSelect;
export type InsertNdaSignature = z.infer<typeof insertNdaSignatureSchema>;
export type NdaAccessToken = typeof ndaAccessTokens.$inferSelect;
export type InsertNdaAccessToken = z.infer<typeof insertNdaAccessTokenSchema>;
export type NdaRedirectLink = typeof ndaRedirectLinks.$inferSelect;
export type InsertNdaRedirectLink = z.infer<typeof insertNdaRedirectLinkSchema>;
export type CustomSection = typeof customSections.$inferSelect;
export type FinancialFile = typeof financialFiles.$inferSelect;
export type InvestorContact = typeof investorContacts.$inferSelect;
export type DocumentBaseline = typeof documentBaselines.$inferSelect;
export type InsertDocumentBaseline = z.infer<typeof insertDocumentBaselineSchema>;

export const insertInvestorContactSchema = createInsertSchema(investorContacts).pick({
  email: true,
  name: true,
  notes: true,
  tags: true,
  status: true,
  lastContactDate: true,
  nextFollowUpDate: true
}).extend({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Name is required"),
  status: z.enum(["new", "contacted", "interested", "under_review", "declined", "closed"]).optional()
});

export type InsertInvestorContact = z.infer<typeof insertInvestorContactSchema>;
export type InsertFinancialFile = z.infer<typeof insertFinancialFileSchema>;
export type Collaborator = typeof collaborators.$inferSelect;
export type InsertCollaborator = z.infer<typeof insertCollaboratorSchema>;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type DocumentAnalytics = typeof documentAnalytics.$inferSelect;
export type SearchIndex = typeof searchIndex.$inferSelect;

// Simplified analysis templates - only save name and directions text
export const analysisTemplates = pgTable("analysis_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  customDirections: text("custom_directions").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Default analysis directions for different purposes
export const DEFAULT_ANALYSIS_TEMPLATES = {
  business_overview: {
    purpose: 'business_overview',
    tone: 'professional',
    audience: 'investors',
    customDirections: `Create a comprehensive business overview document that provides a complete picture of the company for potential stakeholders. Focus on:

1. Business Summary - Clear description of what the company does, its value proposition, and market position
2. Market Opportunity - Size of market, growth trends, and competitive landscape
3. Business Model - How the company generates revenue and key success factors
4. Operations - Key processes, suppliers, customers, and operational strengths
5. Financial Overview - Revenue trends, profitability, and key financial metrics
6. Growth Opportunities - Areas for expansion and potential value creation
7. Management & Team - Key personnel and organizational structure
8. Investment Highlights - Key reasons why this business is attractive

Write in a professional tone suitable for investors and business partners. Include specific details from the transcript and avoid generic statements.`
  },
  equity_raise: {
    purpose: 'equity_raise',
    tone: 'professional',
    audience: 'investors',
    customDirections: `Create an investment-focused document for an equity raise. Emphasize:

1. Investment Opportunity - Clear value proposition for investors
2. Market Size & Growth - Total addressable market and growth potential
3. Competitive Advantages - What makes this business unique and defensible
4. Financial Performance - Historical performance and future projections
5. Use of Funds - How investment capital will be deployed
6. Management Team - Track record and expertise of leadership
7. Growth Strategy - Plans for scaling and expansion
8. Exit Strategy - Potential paths to liquidity for investors
9. Risk Factors - Key risks and mitigation strategies

Focus on metrics, growth potential, and return on investment. Use confident, professional language that builds investor confidence.`
  },
  acquisition_summary: {
    purpose: 'acquisition_summary',
    tone: 'professional',
    audience: 'potential_buyers',
    customDirections: `Create a detailed acquisition summary for potential buyers. Cover:

1. Business Overview - Complete description of operations and market position
2. Financial Performance - Detailed financial history and current performance
3. Assets & IP - Tangible and intangible assets included in the sale
4. Customer Base - Customer relationships, contracts, and retention
5. Operational Systems - Key processes, technology, and infrastructure
6. Growth Opportunities - Potential for expansion under new ownership
7. Transition Planning - How ownership transfer will be managed
8. Strategic Value - Why this acquisition makes strategic sense

Be thorough and factual, providing all information a buyer would need for due diligence.`
  }
};

// Schema for inserting analysis templates - simplified to only name and directions
export const insertAnalysisTemplateSchema = createInsertSchema(analysisTemplates).pick({
  name: true,
  customDirections: true
}).extend({
  name: z.string().min(1, "Template name is required"),
  customDirections: z.string().min(10, "Custom directions must be at least 10 characters")
});

export type AnalysisTemplate = typeof analysisTemplates.$inferSelect;
export type InsertAnalysisTemplate = z.infer<typeof insertAnalysisTemplateSchema>;

// Default CIM directions for backwards compatibility
export const DEFAULT_CIM_DIRECTIONS = DEFAULT_ANALYSIS_TEMPLATES.business_overview.customDirections;