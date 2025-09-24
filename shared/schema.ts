import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const subscriptionPlans = {
  free: {
    name: "Free Trial",
    limit: 1,
    regenerationLimit: 2,
    price: 0,
    billing: "trial"
  },
  starter: {
    name: "Starter Plan",
    limit: 3,
    regenerationLimit: Infinity,
    price: 599,
    billing: "annual"
  },
  standard: {
    name: "Pro Plan",
    limit: 10,
    regenerationLimit: Infinity,
    price: 999,
    billing: "annual"
  },
  canceled: {
    name: "Plan (Canceled)",
    limit: 0,
    regenerationLimit: 0,
    price: 0,
    billing: "canceled"
  },
  enterprise: {
    name: "Enterprise",
    limit: Infinity,
    regenerationLimit: Infinity,
    price: 0,
    billing: "custom"
  },
  admin: {
    name: "Admin",
    limit: Infinity,
    regenerationLimit: Infinity,
    price: 0,
    billing: "admin"
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
  annualDocumentsCreated: integer("annual_documents_created").default(0).notNull(),
  annualRegenerationsUsed: integer("annual_regenerations_used").default(0).notNull(),
  lastUsageReset: timestamp("last_usage_reset").defaultNow().notNull(),
  // Keep old fields for backward compatibility during transition
  monthlyDocumentsCreated: integer("monthly_documents_created").default(0).notNull(),
  monthlyRegenerationsUsed: integer("monthly_regenerations_used").default(0).notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  subscriptionId: text("subscription_id").unique(),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiry: timestamp("google_token_expiry"),
  // Profile information fields
  name: text("name"), // Legacy field - kept for backward compatibility
  firstName: text("first_name"),
  lastName: text("last_name"),
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
  // Alternative user system integration fields
  cognitoUserId: text("cognito_user_id"),
  cognitoUsername: text("cognito_username"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  verificationCode: text("verification_code"),
  verificationCodeExpiry: timestamp("verification_code_expiry"),
  // PDF export preferences
  pdfBackgroundTemplate: text("pdf_background_template").default("classic"),
  // Email preferences
  emailPreferences: jsonb("email_preferences").default({ onboarding: true, marketing: true, transactional: true }),
  unsubscribeToken: text("unsubscribe_token"),
  unsubscribeTokenExpiry: timestamp("unsubscribe_token_expiry"),
});

export const cimDocuments = pgTable("cim_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  transcript: text("transcript").notNull(),
  directions: text("directions").notNull(), // Legacy field for backward compatibility
  // New section-based directions
  sectionDirections: jsonb("section_directions"), // Object with section-specific directions
  formattingProfile: text("formatting_profile").default("balanced"), // balanced, professional, memo, etc.
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
  // Financial data fields - always enabled by default
  financialsEnabled: boolean("financials_enabled").default(true).notNull(),
  askingPrice: text("asking_price"),
  askingPriceIncluded: boolean("asking_price_included").default(true).notNull(),
  revenue: text("revenue"),
  revenueIncluded: boolean("revenue_included").default(true).notNull(),
  ebitda: text("ebitda"),
  ebitdaIncluded: boolean("ebitda_included").default(true).notNull(),
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
  lastModifiedBy: integer("last_modified_by"),
  // Example document flag - doesn't count towards subscription limits
  isExample: boolean("is_example").default(false).notNull()
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
  recipients: jsonb("recipients").default([]).notNull(), // Array of template recipients
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

// E-Signature Signing Sessions - Master workflow management
export const ndaSigningSessions = pgTable("nda_signing_sessions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull(),
  cimDocumentId: integer("cim_document_id"),
  shareSlug: text("share_slug").unique(),
  title: text("title").notNull(),
  message: text("message"), // Custom message for signers
  status: text("status").notNull().default("draft"), // draft, active, completed, cancelled
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  settings: jsonb("settings").default({}).notNull(), // Signing preferences, reminders, etc.
});

// E-Signature Recipients - Multi-party signing support
export const ndaRecipients = pgTable("nda_recipients", {
  id: serial("id").primaryKey(),
  signingSessionId: integer("signing_session_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("signer"), // signer, cc, approver
  status: text("status").notNull().default("pending"), // pending, sent, viewed, signed, declined
  accessToken: text("access_token").unique().notNull(),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  ipAddress: text("ip_address"),
  location: text("location"), // Geographic location from IP
  userAgent: text("user_agent"),
  remindersSent: integer("reminders_sent").default(0).notNull(),
  lastReminderAt: timestamp("last_reminder_at"),
});

// Enhanced signature fields with recipient assignments
export const ndaFieldAssignments = pgTable("nda_field_assignments", {
  id: serial("id").primaryKey(),
  fieldId: text("field_id").notNull(), // References field ID in template signatureFields JSON
  recipientId: integer("recipient_id").notNull(),
  signingSessionId: integer("signing_session_id").notNull(),
  required: boolean("required").default(true).notNull(),
  prefilled: boolean("prefilled").default(false).notNull(),
  prefilledValue: text("prefilled_value"),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  fieldValue: text("field_value"), // The actual signed/filled value
});

// Audit trail for e-signature compliance
export const ndaAuditLog = pgTable("nda_audit_log", {
  id: serial("id").primaryKey(),
  signingSessionId: integer("signing_session_id").notNull(),
  recipientId: integer("recipient_id"),
  action: text("action").notNull(), // session_created, document_sent, document_viewed, field_signed, document_completed
  details: jsonb("details").default({}).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
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
  fieldValues: jsonb("field_values").default({}).notNull(), // Field ID to value mapping
  signingSessionId: integer("signing_session_id"), // Link to new signing session
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
  viewerIdentifier: text("viewer_identifier"), // Email or session ID
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  location: text("location"), // Geolocation data
});



export const financialFiles = pgTable("financial_files", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  filename: text("filename").notNull(), // Match actual database column
  filePath: text("file_path").notNull(), // Secure path outside public folder
  fileSize: integer("file_size").notNull(),
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

// Message Center Tables
export const messageThreads = pgTable("message_threads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // CIM owner
  cimDocumentId: integer("cim_document_id").notNull(),
  inquirerEmail: text("inquirer_email").notNull(),
  inquirerName: text("inquirer_name").notNull(),
  subject: text("subject").notNull(),
  status: text("status").default("active").notNull(), // active, archived, closed
  threadEmailAddress: text("thread_email_address").unique(), // unique email for this thread
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull()
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull(),
  senderType: text("sender_type").notNull(), // inquirer, owner
  senderEmail: text("sender_email").notNull(),
  content: text("content").notNull(),
  richContent: jsonb("rich_content"), // TipTap editor JSON content for rich text
  messageType: text("message_type").notNull(), // contact_form, email_reply, app_message
  sendgridMessageId: text("sendgrid_message_id"), // for tracking
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Message attachments table for file uploads
export const messageAttachments = pgTable("message_attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // Object storage path
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull()
});

export const emailSyncLog = pgTable("email_sync_log", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull(),
  messageId: integer("message_id"),
  sendgridMessageId: text("sendgrid_message_id"),
  direction: text("direction").notNull(), // inbound, outbound
  status: text("status").notNull(), // pending, sent, delivered, bounced, failed
  errorMessage: text("error_message"),
  syncAt: timestamp("sync_at").defaultNow().notNull()
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
  businessName: true,
  phoneNumber: true,
  businessLogo: true,
}).extend({
  name: z.string().optional(), // Legacy field
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profilePhoto: z.string().optional(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
    .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
    .regex(/(?=.*\d)/, "Password must contain at least one number")
    .regex(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?])/, "Password must contain at least one special character"),
  email: z.string().email("Please enter a valid email address"),
  businessName: z.string().optional(),
  phoneNumber: z.string().optional(),
  businessLogo: z.string().optional(),
  adminCode: z.string().optional()
});

// Default section directions
export const DEFAULT_SECTION_DIRECTIONS = {
  businessSummary: "Clear description of what the company does, its value proposition, and market position",
  marketOpportunity: "Size of market, growth trends, and competitive landscape", 
  businessModel: "How the company generates revenue and key success factors",
  operations: "Key processes, suppliers, customers, and operational strengths",
  growthOpportunities: "Areas for expansion and potential value creation",
  managementTeam: "Key personnel and organizational structure"
};

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
  coverImageAttribution: z.string().nullable().optional(),
  financials: z.any().optional(),
  customizations: z.any().optional(),
  docId: z.string().optional(),
  purpose: z.string().optional(),
  tone: z.string().optional(),
  audience: z.string().optional(),
  // New section-based fields
  sectionDirections: z.array(z.object({
    id: z.string(),
    content: z.string()
  })).optional(),
  formattingProfile: z.string().optional()
});

export const insertUploadedCimSchema = createInsertSchema(cimDocuments).pick({
  title: true,
}).extend({
  isUploadedFile: z.boolean().default(false).optional(),
  uploadedFileName: z.string().optional(),
  directions: z.string().optional(),
  transcript: z.string().optional(),
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
  uploadedFilePath: z.string().optional(),
  uploadedFileSize: z.number().optional(),
  uploadedFileMimeType: z.string().optional(),
  // New section-based fields
  sectionDirections: z.array(z.object({
    id: z.string(),
    content: z.string()
  })).optional(),
  formattingProfile: z.string().optional()
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

// Template recipient schema for editor
export const templateRecipientSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['signer', 'cc', 'approver']).default('signer'),
  status: z.enum(['pending', 'sent', 'viewed', 'signed', 'declined']).default('pending')
});

export const insertNdaTemplateSchema = createInsertSchema(ndaTemplates).pick({
  name: true,
  fileContent: true,
}).extend({
  isDefault: z.boolean().optional(),
  signatureFields: z.array(signatureFieldSchema).optional(),
  recipients: z.array(templateRecipientSchema).optional(),
  pageImages: z.array(z.object({
    pageNumber: z.number(),
    imageDataUrl: z.string().optional(),
    imagePath: z.string().optional(),
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
  fieldValues: z.record(z.string()).optional(), // Field ID to value mapping
  signingSessionId: z.number().optional()
});

// E-Signature Signing Session Schema
export const insertNdaSigningSessionSchema = createInsertSchema(ndaSigningSessions).pick({
  templateId: true,
  title: true,
  createdBy: true
}).extend({
  cimDocumentId: z.number().optional(),
  message: z.string().optional(),
  expiresAt: z.date().optional(),
  settings: z.record(z.any()).optional()
});

// E-Signature Recipient Schema
export const insertNdaRecipientSchema = createInsertSchema(ndaRecipients).pick({
  signingSessionId: true,
  name: true,
  email: true
}).extend({
  role: z.enum(['signer', 'cc', 'approver']).default('signer')
});

// E-Signature Field Assignment Schema
export const insertNdaFieldAssignmentSchema = createInsertSchema(ndaFieldAssignments).pick({
  fieldId: true,
  recipientId: true,
  signingSessionId: true
}).extend({
  required: z.boolean().default(true),
  prefilled: z.boolean().default(false),
  prefilledValue: z.string().optional()
});

// E-Signature Audit Log Schema
export const insertNdaAuditLogSchema = createInsertSchema(ndaAuditLog).pick({
  signingSessionId: true,
  action: true
}).extend({
  recipientId: z.number().optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
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
  filename: true,
  filePath: true,
  fileSize: true
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

// Utility function to get full name from user object (handles both old and new formats)
export function getFullName(user: { firstName?: string | null; lastName?: string | null; name?: string | null }): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.lastName) {
    return user.lastName;
  }
  if (user.name) {
    return user.name;
  }
  return '';
}
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
export type NdaSigningSession = typeof ndaSigningSessions.$inferSelect;
export type InsertNdaSigningSession = z.infer<typeof insertNdaSigningSessionSchema>;
export type NdaRecipient = typeof ndaRecipients.$inferSelect;
export type InsertNdaRecipient = z.infer<typeof insertNdaRecipientSchema>;
export type NdaFieldAssignment = typeof ndaFieldAssignments.$inferSelect;
export type InsertNdaFieldAssignment = z.infer<typeof insertNdaFieldAssignmentSchema>;
export type NdaAuditLog = typeof ndaAuditLog.$inferSelect;
export type InsertNdaAuditLog = z.infer<typeof insertNdaAuditLogSchema>;
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

// Message Center Schemas
export const insertMessageThreadSchema = createInsertSchema(messageThreads).pick({
  userId: true,
  cimDocumentId: true,
  inquirerEmail: true,
  inquirerName: true,
  subject: true
}).extend({
  inquirerEmail: z.string().email("Please enter a valid email address"),
  inquirerName: z.string().min(1, "Name is required"),
  subject: z.string().min(1, "Subject is required")
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  threadId: true,
  senderType: true,
  senderEmail: true,
  content: true,
  richContent: true,
  messageType: true,
  sendgridMessageId: true
}).extend({
  senderType: z.enum(["inquirer", "owner"]),
  messageType: z.enum(["contact_form", "email_reply", "app_message"]),
  senderEmail: z.string().email("Please enter a valid email address"),
  content: z.string().min(1, "Message content is required"),
  richContent: z.any().optional()
});

export const insertEmailSyncLogSchema = createInsertSchema(emailSyncLog).pick({
  threadId: true,
  direction: true,
  status: true
}).extend({
  direction: z.enum(["inbound", "outbound"]),
  status: z.enum(["pending", "sent", "delivered", "bounced", "failed"])
});

export type MessageThread = typeof messageThreads.$inferSelect;
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type EmailSyncLog = typeof emailSyncLog.$inferSelect;
export type InsertEmailSyncLog = z.infer<typeof insertEmailSyncLogSchema>;

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

// Content & Style Templates - stores section directions and formatting profiles
export const contentStyleTemplates = pgTable("content_style_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  sectionDirections: jsonb("section_directions").notNull(), // Object with section-specific directions
  formattingProfile: text("formatting_profile").notNull(), // balanced, professional, memo, robust
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertContentStyleTemplateSchema = createInsertSchema(contentStyleTemplates).pick({
  name: true,
  sectionDirections: true,
  formattingProfile: true,
  isDefault: true
}).extend({
  name: z.string().min(1, "Template name is required"),
  sectionDirections: z.record(z.string().min(1)), // Object with string values
  formattingProfile: z.enum(["balanced", "professional", "memo", "robust"]),
  isDefault: z.boolean().default(false)
});

export type ContentStyleTemplate = typeof contentStyleTemplates.$inferSelect;
export type InsertContentStyleTemplate = z.infer<typeof insertContentStyleTemplateSchema>;

// Default CIM directions for backwards compatibility
export const DEFAULT_CIM_DIRECTIONS = DEFAULT_ANALYSIS_TEMPLATES.business_overview.customDirections;

// Onboarding Email Sequences - tracks what emails should be sent to users
export const onboardingEmailSequences = pgTable("onboarding_email_sequences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  templateId: text("template_id").notNull(), // SendGrid template ID
  delayInDays: integer("delay_in_days").default(0).notNull(), // Days after registration to send
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Email Queue - tracks which emails to send to which users
export const userEmailQueue = pgTable("user_email_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sequenceId: integer("sequence_id").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: text("status").default("pending").notNull(), // pending, sent, failed, skipped
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schemas for email system
export const insertOnboardingEmailSequenceSchema = createInsertSchema(onboardingEmailSequences).pick({
  name: true,
  templateId: true,
  delayInDays: true,
  isActive: true
}).extend({
  name: z.string().min(1, "Sequence name is required"),
  templateId: z.string().min(1, "Template ID is required"),
  delayInDays: z.number().min(0, "Delay must be 0 or greater"),
  isActive: z.boolean().default(true)
});

export const insertUserEmailQueueSchema = createInsertSchema(userEmailQueue).pick({
  userId: true,
  sequenceId: true,
  scheduledAt: true,
  status: true
}).extend({
  userId: z.number().min(1, "User ID is required"),
  sequenceId: z.number().min(1, "Sequence ID is required"),
  scheduledAt: z.date(),
  status: z.enum(["pending", "sent", "failed", "skipped"]).default("pending")
});

export type OnboardingEmailSequence = typeof onboardingEmailSequences.$inferSelect;
export type InsertOnboardingEmailSequence = z.infer<typeof insertOnboardingEmailSequenceSchema>;
export type UserEmailQueue = typeof userEmailQueue.$inferSelect;
export type InsertUserEmailQueue = z.infer<typeof insertUserEmailQueueSchema>;

// Message attachment types
export type MessageAttachment = typeof messageAttachments.$inferSelect;
export type InsertMessageAttachment = typeof messageAttachments.$inferInsert;