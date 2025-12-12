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
  starter_monthly: {
    name: "Starter Plan",
    limit: 3,
    regenerationLimit: Infinity,
    price: 59,
    billing: "monthly"
  },
  pro: {
    name: "Pro Plan",
    limit: 10,
    regenerationLimit: Infinity,
    price: 999,
    billing: "annual"
  },
  pro_monthly: {
    name: "Pro Plan",
    limit: 10,
    regenerationLimit: Infinity,
    price: 99,
    billing: "monthly"
  },
  // Legacy name kept for backward compatibility
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
  monthlySdeAnalyses: integer("monthly_sde_analyses").default(0).notNull(),
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
  // Custom subdomain for branded share links (e.g., "acme" for acme.yourdomain.com)
  customSubdomain: text("custom_subdomain"),
  // Brand colors extracted from logo (array of hex colors, e.g., ["#1a365d", "#e53e3e"])
  brandColors: jsonb("brand_colors"),
  // User-selected primary color for PDF branding (defaults to first extracted color if not set)
  pdfPrimaryColor: text("pdf_primary_color"),
  // User-selected secondary color for PDF branding (defaults to second extracted color if not set)
  pdfSecondaryColor: text("pdf_secondary_color"),
  // Branded PDF template selection: "none", "watermark", "footer", "accent", "full"
  brandedPdfTemplate: text("branded_pdf_template").default("none"),
  // Email preferences
  emailPreferences: jsonb("email_preferences").default({ onboarding: true, marketing: true, transactional: true }),
  unsubscribeToken: text("unsubscribe_token"),
  unsubscribeTokenExpiry: timestamp("unsubscribe_token_expiry"),
  // Default display settings for new documents
  defaultDisplaySettings: jsonb("default_display_settings").$type<{
    theme: 'corporate-blue' | 'forest-green' | 'charcoal' | 'burgundy' | 'brand' | 'custom';
    sectionStyle: 'cards' | 'minimal';
    contactPosition: 'sidebar' | 'bottom';
    customColor?: string;
    customColorSecondary?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  copyMeOnEmails: boolean("copy_me_on_emails").default(false).notNull(),
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
  isExample: boolean("is_example").default(false).notNull(),
  // Soft delete - marks document as deleted but keeps in database for limit tracking
  deletedAt: timestamp("deleted_at"),
  // Display settings for share page customization
  displaySettings: jsonb("display_settings").$type<{
    theme: 'corporate-blue' | 'forest-green' | 'charcoal' | 'burgundy' | 'brand';
    sectionStyle: 'cards' | 'flat' | 'minimal';
    contactPosition: 'sidebar' | 'bottom';
  }>()
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
  type: text("type").notNull(), // 'text', 'image', or 'html'
  title: text("title"), // Section title
  content: text("content"), // Rich text content for text sections, or HTML code for html sections
  customCss: text("custom_css"), // Optional CSS for html sections
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
  rejected: boolean("rejected").default(false).notNull(),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: integer("rejected_by"), // User ID who rejected
  fieldValues: jsonb("field_values").default({}).notNull(), // Field ID to value mapping
  signingSessionId: integer("signing_session_id"), // Link to new signing session
  stage: text("stage"), // Kanban stage for organizing signers
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
  sessionId: text("session_id"), // Unique session identifier for tracking time spent
  timeSpentSeconds: integer("time_spent_seconds").default(0), // Total time spent viewing
  lastHeartbeat: timestamp("last_heartbeat"), // Last heartbeat timestamp for session tracking
});

// Download tracking for analytics
export const documentDownloads = pgTable("document_downloads", {
  id: serial("id").primaryKey(),
  cimDocumentId: integer("cim_document_id").notNull(),
  viewerEmail: text("viewer_email"), // Email of downloader (if known via NDA)
  viewerIdentifier: text("viewer_identifier"), // Session ID for anonymous
  downloadType: text("download_type").notNull(), // 'pdf', 'docx', 'excel', etc.
  ipAddress: text("ip_address"),
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
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
  email: text("email").notNull(),
  userId: integer("user_id"),
  permission: text("permission").notNull().$type<"Edit" | "Assist">(),
  invitedBy: integer("invited_by").notNull(),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  status: text("status").notNull().default("pending").$type<"pending" | "active" | "removed">(),
  inviteToken: text("invite_token").notNull().unique(),
});

export const documentLocks = pgTable("document_locks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().unique(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  takenOverFrom: integer("taken_over_from"),
});

export const documentActivityLog = pgTable("document_activity_log", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  userId: integer("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  permission: z.enum(["Edit", "Assist"]),
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
export type DocumentLock = typeof documentLocks.$inferSelect;
export type DocumentActivityLog = typeof documentActivityLog.$inferSelect;
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

// SDE Analyzer - Financial analysis tracking
export const sdeAnalyses = pgTable("sde_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),

  // Original uploaded file
  originalFilename: text("original_filename").notNull(),
  originalFilePath: text("original_file_path").notNull(),
  originalFileSize: integer("original_file_size").notNull(),
  originalMimeType: text("original_mime_type").notNull(),

  // Result file (generated SDE Sheet)
  resultFilename: text("result_filename"),
  resultFilePath: text("result_file_path"),
  resultFileSize: integer("result_file_size"),

  // Processing status
  status: text("status").notNull().default("pending").$type<"pending" | "processing" | "completed" | "failed">(),
  errorMessage: text("error_message"),
  analysisWarnings: text("analysis_warnings").array(), // Warnings from AI analysis (e.g., partial columns detected)

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processingStartedAt: timestamp("processing_started_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"), // 30 days from completion

  // Claude API metadata
  claudeFileId: text("claude_file_id"),
  claudeResultFileId: text("claude_result_file_id"),
  claudeRequestId: text("claude_request_id"),
  processingTimeSeconds: integer("processing_time_seconds"),

  // Storage tracking
  useFilesystemStorage: boolean("use_filesystem_storage").default(false),

  // Tracking
  downloadCount: integer("download_count").default(0).notNull(),
  lastDownloadedAt: timestamp("last_downloaded_at")
});

export const insertSdeAnalysisSchema = createInsertSchema(sdeAnalyses).pick({
  userId: true,
  originalFilename: true,
  originalFilePath: true,
  originalFileSize: true,
  originalMimeType: true
}).extend({
  userId: z.number().min(1, "User ID is required"),
  originalFilename: z.string().min(1, "Filename is required"),
  originalFilePath: z.string().min(1, "File path is required"),
  originalFileSize: z.number().min(1, "File size is required"),
  originalMimeType: z.string().min(1, "MIME type is required")
});

export type SdeAnalysis = typeof sdeAnalyses.$inferSelect;
export type InsertSdeAnalysis = z.infer<typeof insertSdeAnalysisSchema>;

// ============================================================================
// E-SIGNATURE SYSTEM - General purpose DocuSign-like e-signature feature
// ============================================================================

// User branding settings for e-signature emails and signing pages
export const userBranding = pgTable("user_branding", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#0072CE").notNull(),
  companyName: text("company_name"),
  emailFromName: text("email_from_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// E-signature templates with placeholder recipients
export const esignTemplates = pgTable("esign_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  documentUrl: text("document_url").notNull(), // Original PDF in object storage
  pageImages: jsonb("page_images").default([]).notNull(), // Array of page image URLs
  totalPages: integer("total_pages").default(1).notNull(),
  placeholderRecipients: jsonb("placeholder_recipients").default([]).notNull(), // Array of { id, label, role, color, order }
  fields: jsonb("fields").default([]).notNull(), // Array of field definitions with assignedTo = placeholder ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// E-signature envelopes - containers for signing transactions
export const esignEnvelopes = pgTable("esign_envelopes", {
  id: serial("id").primaryKey(),
  envelopeId: text("envelope_id").notNull().unique(), // Public UUID for URLs (e.g., "env_a1b2c3d4e5f6")
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message"), // Custom message to recipients
  status: text("status").notNull().default("draft"), // draft, sent, completed, voided, declined
  signingOrder: text("signing_order").notNull().default("parallel"), // parallel, sequential
  documentUrl: text("document_url").notNull(), // Original PDF
  pageImages: jsonb("page_images").default([]).notNull(), // Page image URLs
  totalPages: integer("total_pages").default(1).notNull(),
  templateId: integer("template_id"), // If created from template
  // Document integrity fields for E-SIGN Act / UETA compliance
  documentHash: text("document_hash"), // SHA-256 hash of original document for tamper detection
  signedDocumentHash: text("signed_document_hash"), // SHA-256 hash of final signed document
  signedDocumentUrl: text("signed_document_url"), // Final signed PDF
  certificateUrl: text("certificate_url"), // Certificate of completion
  completedAt: timestamp("completed_at"),
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),
  declinedAt: timestamp("declined_at"),
  declinedBy: text("declined_by"), // Email of person who declined
  declineReason: text("decline_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// E-signature envelope recipients
export const esignRecipients = pgTable("esign_recipients", {
  id: serial("id").primaryKey(),
  envelopeId: integer("envelope_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("signer"), // signer, cc
  placeholderLabel: text("placeholder_label"), // Original template role label (e.g., "Client")
  color: text("color").notNull(), // Hex color for visual distinction
  signingOrder: integer("signing_order").notNull().default(1), // Order for sequential signing
  status: text("status").notNull().default("pending"), // pending, sent, viewed, signed, declined
  accessToken: text("access_token").notNull().unique(), // Unique signing URL token
  // E-SIGN Act / UETA compliance fields
  consentedAt: timestamp("consented_at"), // When user acknowledged e-signature consent
  consentIpAddress: text("consent_ip_address"), // IP address at time of consent
  declineReason: text("decline_reason"),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  declinedAt: timestamp("declined_at"),
  ipAddress: text("ip_address"),
  location: text("location"),
  userAgent: text("user_agent"),
  reminderCount: integer("reminder_count").default(0).notNull(),
  lastReminderAt: timestamp("last_reminder_at")
});

// E-signature envelope fields
export const esignFields = pgTable("esign_fields", {
  id: serial("id").primaryKey(),
  envelopeId: integer("envelope_id").notNull(),
  recipientId: integer("recipient_id").notNull(),
  type: text("type").notNull(), // signature, name, email, date, text, initials
  x: text("x").notNull(), // Percentage as decimal string
  y: text("y").notNull(), // Percentage as decimal string
  width: text("width").notNull(), // Percentage as decimal string
  height: text("height").notNull(), // Percentage as decimal string
  page: integer("page").notNull().default(1),
  required: boolean("required").notNull().default(true),
  value: text("value"), // Filled value (base64 for signatures)
  completedAt: timestamp("completed_at")
});

// E-signature audit log
export const esignAuditLog = pgTable("esign_audit_log", {
  id: serial("id").primaryKey(),
  envelopeId: integer("envelope_id").notNull(),
  recipientId: integer("recipient_id"),
  action: text("action").notNull(), // envelope_created, envelope_sent, recipient_sent, recipient_viewed, field_completed, recipient_signed, recipient_declined, envelope_completed, envelope_voided, envelope_declined, reminder_sent, document_downloaded
  details: jsonb("details").default({}).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  location: text("location"),
  timestamp: timestamp("timestamp").defaultNow().notNull()
});

// Recipient color palette for consistent visual distinction
export const ESIGN_RECIPIENT_COLORS = [
  '#0072CE',  // Blue (Signer 1)
  '#FF6B00',  // Orange (Signer 2)
  '#00A651',  // Green (Signer 3)
  '#9B59B6',  // Purple (Signer 4)
  '#E91E63',  // Pink (Signer 5)
  '#00BCD4',  // Cyan (Signer 6)
  '#795548',  // Brown (Signer 7)
  '#607D8B',  // Gray (Signer 8)
] as const;

export const ESIGN_CC_COLOR = '#9CA3AF'; // Muted gray for CC recipients

// Zod schemas for e-signature system
export const esignPlaceholderRecipientSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Role label is required"),
  role: z.enum(['signer', 'cc']),
  color: z.string(),
  order: z.number(),
  name: z.string().optional(), // Optional - fill in when using template if not set
  email: z.union([z.string().email(), z.literal('')]).optional(), // Optional - fill in when using template if not set
});

export const esignTemplateFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['signature', 'name', 'email', 'date', 'text', 'initials']),
  x: z.number(), // Percentage 0-100
  y: z.number(), // Percentage 0-100
  width: z.number(), // Percentage
  height: z.number(), // Percentage
  page: z.number(),
  assignedTo: z.string(), // Placeholder recipient ID
  required: z.boolean().default(true)
});

export const insertUserBrandingSchema = createInsertSchema(userBranding).pick({
  logoUrl: true,
  primaryColor: true,
  companyName: true,
  emailFromName: true
}).extend({
  logoUrl: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
  companyName: z.string().optional(),
  emailFromName: z.string().optional()
});

export const insertEsignTemplateSchema = createInsertSchema(esignTemplates).pick({
  name: true,
  documentUrl: true
}).extend({
  name: z.string().min(1, "Template name is required"),
  description: z.string().nullable().optional(),
  documentUrl: z.string().min(1, "Document URL is required"),
  pageImages: z.array(z.string()).optional(),
  totalPages: z.number().optional(),
  placeholderRecipients: z.array(esignPlaceholderRecipientSchema).optional(),
  fields: z.array(esignTemplateFieldSchema).optional()
});

export const insertEsignEnvelopeSchema = createInsertSchema(esignEnvelopes).pick({
  title: true,
  message: true,
  documentUrl: true
}).extend({
  title: z.string().min(1, "Document title is required"),
  message: z.string().optional(),
  documentUrl: z.string().min(1, "Document URL is required"),
  signingOrder: z.enum(['parallel', 'sequential']).default('parallel'),
  pageImages: z.array(z.string()).optional(),
  totalPages: z.number().optional(),
  templateId: z.number().optional()
});

export const insertEsignRecipientSchema = createInsertSchema(esignRecipients).pick({
  envelopeId: true,
  name: true,
  email: true
}).extend({
  envelopeId: z.number(),
  name: z.string().min(1, "Recipient name is required"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(['signer', 'cc']).default('signer'),
  placeholderLabel: z.string().optional(),
  color: z.string(),
  signingOrder: z.number().default(1)
});

export const insertEsignFieldSchema = createInsertSchema(esignFields).pick({
  envelopeId: true,
  recipientId: true,
  type: true
}).extend({
  envelopeId: z.number(),
  recipientId: z.number(),
  type: z.enum(['signature', 'name', 'email', 'date', 'text', 'initials']),
  x: z.string(),
  y: z.string(),
  width: z.string(),
  height: z.string(),
  page: z.number().default(1),
  required: z.boolean().default(true)
});

export const insertEsignAuditLogSchema = createInsertSchema(esignAuditLog).pick({
  envelopeId: true,
  action: true
}).extend({
  envelopeId: z.number(),
  recipientId: z.number().optional(),
  action: z.string(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  location: z.string().optional()
});

// Type exports for e-signature system
export type UserBranding = typeof userBranding.$inferSelect;
export type InsertUserBranding = z.infer<typeof insertUserBrandingSchema>;
export type EsignTemplate = typeof esignTemplates.$inferSelect;
export type InsertEsignTemplate = z.infer<typeof insertEsignTemplateSchema>;
export type EsignEnvelope = typeof esignEnvelopes.$inferSelect;
export type InsertEsignEnvelope = z.infer<typeof insertEsignEnvelopeSchema>;
export type EsignRecipient = typeof esignRecipients.$inferSelect;
export type InsertEsignRecipient = z.infer<typeof insertEsignRecipientSchema>;
export type EsignField = typeof esignFields.$inferSelect;
export type InsertEsignField = z.infer<typeof insertEsignFieldSchema>;
export type EsignAuditLog = typeof esignAuditLog.$inferSelect;
export type InsertEsignAuditLog = z.infer<typeof insertEsignAuditLogSchema>;
export type EsignPlaceholderRecipient = z.infer<typeof esignPlaceholderRecipientSchema>;
export type EsignTemplateField = z.infer<typeof esignTemplateFieldSchema>;

// E-signature recent recipients - auto-saved from sent envelopes for autocomplete
export const esignRecentRecipients = pgTable("esign_recent_recipients", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  useCount: integer("use_count").default(1).notNull(), // Number of times this recipient has been used
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertEsignRecentRecipientSchema = createInsertSchema(esignRecentRecipients).pick({
  userId: true,
  email: true,
  name: true
}).extend({
  userId: z.number().min(1),
  email: z.string().email(),
  name: z.string().min(1)
});

export type EsignRecentRecipient = typeof esignRecentRecipients.$inferSelect;
export type InsertEsignRecentRecipient = z.infer<typeof insertEsignRecentRecipientSchema>;

// ============================================================================
// WEBHOOKS SYSTEM - User-configurable webhooks for external integrations
// ============================================================================

// Available webhook event types
export const WEBHOOK_EVENT_TYPES = [
  // CIM Events
  'cim.created',
  'cim.updated',
  'cim.published',
  'cim.viewed',
  'cim.downloaded',
  // NDA Events
  'nda.signed',
  'nda.declined',
  // E-Signature Events
  'esign.envelope_completed',
  // Contact Events
  'contact.created',
  'contact.updated',
  // Message Events
  'message.received',
  'message.sent',
] as const;

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number];

// Webhook configurations - stores user's webhook endpoints
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(), // User-friendly name (e.g., "HubSpot Sync")
  url: text("url").notNull(), // Endpoint URL
  secret: text("secret").notNull(), // HMAC signing secret for payload verification
  events: text("events").array().notNull(), // Array of subscribed event types
  isActive: boolean("is_active").default(true).notNull(),
  // Health tracking
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastFailureAt: timestamp("last_failure_at"),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Webhook delivery logs - tracks all delivery attempts
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  webhookId: integer("webhook_id").notNull(),
  eventType: text("event_type").notNull(),
  eventId: text("event_id").notNull(), // Unique ID for this event (for idempotency)
  payload: jsonb("payload").notNull(), // The full payload sent
  // Delivery status
  status: text("status").notNull().default("pending"), // pending, success, failed, retrying
  statusCode: integer("status_code"), // HTTP response code
  responseBody: text("response_body"), // Response from webhook endpoint (truncated)
  errorMessage: text("error_message"),
  // Retry tracking
  attemptCount: integer("attempt_count").default(0).notNull(),
  nextRetryAt: timestamp("next_retry_at"),
  // Timing
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
  durationMs: integer("duration_ms") // How long the request took
});

// Zod schemas for webhooks
export const insertWebhookSchema = createInsertSchema(webhooks).pick({
  name: true,
  url: true,
  events: true
}).extend({
  name: z.string().min(1, "Webhook name is required").max(100),
  url: z.string().url("Please enter a valid URL").refine(
    (url) => url.startsWith('https://'),
    "Webhook URL must use HTTPS"
  ),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES as unknown as [string, ...string[]])).min(1, "Select at least one event"),
  isActive: z.boolean().optional()
});

export const updateWebhookSchema = insertWebhookSchema.partial().extend({
  isActive: z.boolean().optional()
});

export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).pick({
  webhookId: true,
  eventType: true,
  eventId: true,
  payload: true
}).extend({
  webhookId: z.number(),
  eventType: z.string(),
  eventId: z.string(),
  payload: z.record(z.any())
});

// Type exports for webhooks
export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type UpdateWebhook = z.infer<typeof updateWebhookSchema>;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;

// ============================================================================
// INTEGRATIONS SYSTEM - Connections to external apps and automation workflows
// ============================================================================

// Integration provider types
export const INTEGRATION_PROVIDERS = [
  'hubspot',
  'slack',
  'zapier',
  'make',
  'webhook',
] as const;

export type IntegrationProvider = typeof INTEGRATION_PROVIDERS[number];

// Connection status types
export const CONNECTION_STATUSES = [
  'active',
  'expired',
  'error',
  'disconnected',
] as const;

export type ConnectionStatus = typeof CONNECTION_STATUSES[number];

// Automation behavior types
export const AUTOMATION_BEHAVIORS = [
  'create',
  'update',
  'upsert',
] as const;

export type AutomationBehavior = typeof AUTOMATION_BEHAVIORS[number];

// Run status types
export const RUN_STATUSES = [
  'pending',
  'running',
  'success',
  'failed',
  'skipped',
] as const;

export type RunStatus = typeof RUN_STATUSES[number];

// Destination types for automations
export const DESTINATION_TYPES = [
  // HubSpot destinations
  'hubspot_contact',
  'hubspot_deal',
  'hubspot_company',
  'hubspot_note',
  // Slack destinations
  'slack_message',
  // Generic destinations
  'zapier_webhook',
  'make_webhook',
  'custom_webhook',
] as const;

export type DestinationType = typeof DESTINATION_TYPES[number];

// Integration Connections - stores OAuth credentials and connection status
export const integrationConnections = pgTable("integration_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),

  // Provider identification
  provider: text("provider").notNull(), // 'hubspot', 'slack', 'zapier', 'make', 'webhook'
  providerAccountId: text("provider_account_id"), // External account identifier (e.g., HubSpot portal ID)
  providerAccountName: text("provider_account_name"), // Display name (e.g., "Acme Corp HubSpot")

  // OAuth credentials (encrypted)
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes").array(), // Granted OAuth scopes

  // For webhook-based integrations (Zapier, Make, custom)
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"), // HMAC signing secret

  // Status tracking
  status: text("status").notNull().default("active"), // 'active', 'expired', 'error', 'disconnected'
  lastUsedAt: timestamp("last_used_at"),
  lastError: text("last_error"),
  errorCount: integer("error_count").default(0).notNull(),

  // Metadata
  settings: jsonb("settings").default({}).notNull(), // Provider-specific settings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Integration Automations - stores automation configurations
export const integrationAutomations = pgTable("integration_automations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  connectionId: integer("connection_id"), // NULL for direct webhooks

  // Basic info
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),

  // Trigger configuration
  triggerEvent: text("trigger_event").notNull(), // Event type (e.g., 'nda.signed')
  triggerCondition: jsonb("trigger_condition"), // Optional filter condition

  // Destination configuration
  destinationType: text("destination_type").notNull(), // 'hubspot_contact', 'slack_message', 'webhook', etc.
  destinationConfig: jsonb("destination_config").notNull(), // Type-specific config

  // Behavior configuration (for CRM destinations)
  behavior: text("behavior").default("upsert"), // 'create', 'update', 'upsert'
  matchField: text("match_field"), // Field to match on for update/upsert (e.g., 'email')

  // Field mappings
  fieldMappings: jsonb("field_mappings").default([]).notNull(),
  // Format: [{ sourceField: "data.signer_email", destField: "email", type: "field" },
  //          { value: "NDA Signed", destField: "nda_status", type: "constant" }]

  // File attachment config (when applicable)
  includeFile: boolean("include_file").default(false).notNull(),
  fileSource: text("file_source"), // 'signed_document', 'cim_pdf', etc.
  fileDestination: text("file_destination"), // 'contact_attachment', 'deal_attachment', etc.

  // Statistics
  totalRuns: integer("total_runs").default(0).notNull(),
  successfulRuns: integer("successful_runs").default(0).notNull(),
  failedRuns: integer("failed_runs").default(0).notNull(),
  lastRunAt: timestamp("last_run_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastFailureAt: timestamp("last_failure_at"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Integration Automation Runs - stores execution history
export const integrationAutomationRuns = pgTable("integration_automation_runs", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").notNull(),
  connectionId: integer("connection_id"),

  // Event that triggered this run
  eventType: text("event_type").notNull(),
  eventId: text("event_id").notNull(), // Unique event identifier for idempotency
  eventPayload: jsonb("event_payload").notNull(),

  // Execution details
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'success', 'failed', 'skipped'
  skippedReason: text("skipped_reason"), // If skipped due to condition not met

  // Request/Response details
  requestPayload: jsonb("request_payload"), // What was sent to destination (after field mapping)
  responseStatus: integer("response_status"), // HTTP status code
  responseBody: text("response_body"), // Truncated response
  errorMessage: text("error_message"),

  // External references
  externalId: text("external_id"), // ID from destination (e.g., HubSpot contact ID)
  externalUrl: text("external_url"), // Link to record in destination system

  // File handling
  fileUploaded: boolean("file_uploaded").default(false).notNull(),
  fileName: text("file_name"),
  fileSize: integer("file_size"),

  // Retry tracking
  attemptCount: integer("attempt_count").default(0).notNull(),
  nextRetryAt: timestamp("next_retry_at"),

  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for integrations

// Field mapping schema
export const fieldMappingSchema = z.object({
  type: z.enum(['field', 'constant', 'template']),
  sourceField: z.string().optional(), // For type: 'field'
  value: z.string().optional(), // For type: 'constant'
  template: z.string().optional(), // For type: 'template'
  destField: z.string(),
  destFieldLabel: z.string().optional(),
  required: z.boolean().default(false),
});

// Trigger condition schema
export const triggerConditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'is_empty',
    'is_not_empty',
  ]),
  value: z.string().optional(),
});

// Connection schemas
export const insertIntegrationConnectionSchema = createInsertSchema(integrationConnections).pick({
  provider: true,
  providerAccountId: true,
  providerAccountName: true,
  webhookUrl: true,
  status: true,
}).extend({
  provider: z.enum(INTEGRATION_PROVIDERS as unknown as [string, ...string[]]),
  providerAccountId: z.string().optional(),
  providerAccountName: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
  status: z.enum(CONNECTION_STATUSES as unknown as [string, ...string[]]).default('active'),
  settings: z.record(z.any()).optional(),
});

export const updateIntegrationConnectionSchema = insertIntegrationConnectionSchema.partial().extend({
  status: z.enum(CONNECTION_STATUSES as unknown as [string, ...string[]]).optional(),
});

// Automation schemas
export const insertIntegrationAutomationSchema = createInsertSchema(integrationAutomations).pick({
  name: true,
  triggerEvent: true,
  destinationType: true,
  destinationConfig: true,
}).extend({
  name: z.string().min(1, "Automation name is required").max(100),
  description: z.string().optional(),
  connectionId: z.number().optional(),
  triggerEvent: z.enum(WEBHOOK_EVENT_TYPES as unknown as [string, ...string[]]),
  triggerCondition: triggerConditionSchema.optional(),
  destinationType: z.enum(DESTINATION_TYPES as unknown as [string, ...string[]]),
  destinationConfig: z.record(z.any()),
  behavior: z.enum(AUTOMATION_BEHAVIORS as unknown as [string, ...string[]]).default('upsert'),
  matchField: z.string().optional(),
  fieldMappings: z.array(fieldMappingSchema).default([]),
  includeFile: z.boolean().default(false),
  fileSource: z.string().optional(),
  fileDestination: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateIntegrationAutomationSchema = insertIntegrationAutomationSchema.partial();

// Run schemas
export const insertIntegrationAutomationRunSchema = createInsertSchema(integrationAutomationRuns).pick({
  automationId: true,
  eventType: true,
  eventId: true,
  eventPayload: true,
}).extend({
  automationId: z.number(),
  connectionId: z.number().optional(),
  eventType: z.string(),
  eventId: z.string(),
  eventPayload: z.record(z.any()),
  status: z.enum(RUN_STATUSES as unknown as [string, ...string[]]).default('pending'),
});

// Type exports for integrations
export type IntegrationConnection = typeof integrationConnections.$inferSelect;
export type InsertIntegrationConnection = z.infer<typeof insertIntegrationConnectionSchema>;
export type UpdateIntegrationConnection = z.infer<typeof updateIntegrationConnectionSchema>;

export type IntegrationAutomation = typeof integrationAutomations.$inferSelect;
export type InsertIntegrationAutomation = z.infer<typeof insertIntegrationAutomationSchema>;
export type UpdateIntegrationAutomation = z.infer<typeof updateIntegrationAutomationSchema>;

export type IntegrationAutomationRun = typeof integrationAutomationRuns.$inferSelect;
export type InsertIntegrationAutomationRun = z.infer<typeof insertIntegrationAutomationRunSchema>;

export type FieldMapping = z.infer<typeof fieldMappingSchema>;
export type TriggerCondition = z.infer<typeof triggerConditionSchema>;