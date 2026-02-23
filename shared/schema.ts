import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
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
    limit: Infinity,
    regenerationLimit: Infinity,
    price: 599,
    billing: "annual"
  },
  starter_monthly: {
    name: "Starter Plan",
    limit: Infinity,
    regenerationLimit: Infinity,
    price: 59,
    billing: "monthly"
  },
  pro: {
    name: "Pro Plan",
    limit: Infinity,
    regenerationLimit: Infinity,
    price: 999,
    billing: "annual"
  },
  pro_monthly: {
    name: "Pro Plan",
    limit: Infinity,
    regenerationLimit: Infinity,
    price: 99,
    billing: "monthly"
  },
  // Legacy name kept for backward compatibility
  standard: {
    name: "Pro Plan",
    limit: Infinity,
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
  // Public Listings Page settings
  listingsEnabled: boolean("listings_enabled").default(false).notNull(),
  listingsSlug: text("listings_slug").unique(),
  listingsTitle: text("listings_title"),
  listingsTagline: text("listings_tagline"),
  listingsBannerUrl: text("listings_banner_url"),
  listingsLayout: text("listings_layout").default('grid'),
  // User timezone for task reminders and date displays (IANA timezone, e.g., "America/New_York")
  timezone: text("timezone").default("America/New_York"),
  // OAuth provider IDs for social login
  googleId: text("google_id").unique(),
  microsoftId: text("microsoft_id").unique(),
  // Auth provider tracking (local, google, microsoft)
  authProvider: text("auth_provider").default("local"),
  // Marketing attribution fields (captured at signup)
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  referrerUrl: text("referrer_url"),
  landingPage: text("landing_page"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Session table for connect-pg-simple (express-session storage)
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Email verification codes for signup flow
export const emailVerificationCodes = pgTable("email_verification_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verified: boolean("verified").default(false).notNull(),
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
  // Deal association - links CIM to a specific deal
  dealId: integer("deal_id"), // FK to deals table - optional for backward compat
  // Display settings for share page customization
  displaySettings: jsonb("display_settings").$type<{
    theme: 'corporate-blue' | 'forest-green' | 'charcoal' | 'burgundy' | 'brand';
    sectionStyle: 'cards' | 'flat' | 'minimal';
    contactPosition: 'sidebar' | 'bottom';
  }>(),
  // External URL CIM - redirects to an external CIM link while tracking views
  externalUrl: text("external_url"),
  // Background generation status fields
  generationStatus: text("generation_status").default("ready"), // 'generating', 'ready', 'failed'
  generationError: text("generation_error"),
  generationStartedAt: timestamp("generation_started_at"),
}, (table) => ({
  userDeletedAtIdx: index("cim_documents_user_deleted_at_idx").on(table.userId, table.deletedAt),
}));

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
}, (table) => ({
  documentStatusIdx: index("nda_signing_sessions_document_status_idx").on(table.cimDocumentId, table.status),
}));

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
  signingSessionId: integer("signing_session_id"), // nullable for whitelist auto-approve logs
  recipientId: integer("recipient_id"),
  action: text("action").notNull(), // session_created, document_sent, document_viewed, field_signed, document_completed, auto_approved
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
  statusCheckToken: text("status_check_token").unique(), // Token for buyers to check NDA approval status
}, (table) => ({
  documentApprovedIdx: index("nda_signatures_document_approved_idx").on(table.cimDocumentId, table.approved),
}));

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

// NDA Whitelist Rules - Auto-approve trusted buyers
export const ndaWhitelistRules = pgTable("nda_whitelist_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Broker who owns the rule
  organizationId: integer("organization_id"), // Org-level rules (nullable for personal)
  ruleType: text("rule_type").notNull(), // 'domain', 'email', 'organization'
  ruleValue: text("rule_value").notNull(), // e.g., 'blackstone.com', 'john@buyer.com', or company ID
  appliesToAllDeals: boolean("applies_to_all_deals").default(true).notNull(),
  cimDocumentId: integer("cim_document_id"), // Specific deal (nullable if global)
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Buyer Surveys - Qualification surveys for buyers
export const buyerSurveys = pgTable("buyer_surveys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Broker who created the survey
  organizationId: integer("organization_id"),
  cimDocumentId: integer("cim_document_id"), // Deal-specific (nullable for default)
  name: text("name").notNull(),
  questions: jsonb("questions").default([]).notNull(), // Array of question objects
  isDefault: boolean("is_default").default(false).notNull(),
  isRequired: boolean("is_required").default(false).notNull(), // Must complete to access CIM
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Buyer Survey Responses - Submitted qualification data
export const buyerSurveyResponses = pgTable("buyer_survey_responses", {
  id: serial("id").primaryKey(),
  surveyId: integer("survey_id").notNull(),
  contactId: integer("contact_id"), // FK to crmContacts (nullable for pre-contact submissions)
  cimDocumentId: integer("cim_document_id"),
  signerEmail: text("signer_email").notNull(), // For matching before CRM contact exists
  responses: jsonb("responses").default({}).notNull(), // Question-answer pairs
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

// Extension Tokens - Chrome extension authentication
export const extensionTokens = pgTable("extension_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  organizationId: integer("organization_id"), // Optional - for org-scoped tokens
  token: text("token").notNull().unique(), // Format: ext_<48 hex chars>
  deviceInfo: text("device_info"), // Browser/OS info from extension
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at").notNull(), // 30 days from creation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"), // Set when token is explicitly revoked
}, (table) => ({
  userIdIdx: index("extension_tokens_user_id_idx").on(table.userId),
  tokenIdx: index("extension_tokens_token_idx").on(table.token),
}));

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
}, (table) => ({
  documentViewedAtIdx: index("document_views_document_viewed_at_idx").on(table.cimDocumentId, table.viewedAt),
}));

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
  // Buyer management linkage
  dealId: integer("deal_id"), // FK to deals - thread linked to specific deal
  contactId: integer("contact_id"), // FK to crmContacts - thread linked to buyer
  threadType: text("thread_type").default("inquiry"), // inquiry, nda_followup, deal_qa, general, offer_discussion
  priority: text("priority").default("normal"), // normal, high, urgent
  assignedTo: integer("assigned_to"), // FK to organization_members
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
  isInternal: boolean("is_internal").default(false).notNull(), // Internal broker team note (not visible to buyer)
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
  company: text("company"),
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
  adminCode: z.string().optional(),
  // Marketing attribution fields
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  referrerUrl: z.string().optional(),
  landingPage: z.string().optional(),
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
  formattingProfile: z.string().optional(),
  // Deal association
  dealId: z.number().nullable().optional()
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
  formattingProfile: z.string().optional(),
  // Deal association
  dealId: z.number().nullable().optional()
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
  action: true
}).extend({
  signingSessionId: z.number().nullable().optional(),
  recipientId: z.number().optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
});

// NDA Whitelist Rules
export const insertNdaWhitelistRuleSchema = createInsertSchema(ndaWhitelistRules).pick({
  userId: true,
  ruleType: true,
  ruleValue: true
}).extend({
  organizationId: z.number().nullable().optional(),
  ruleType: z.enum(['domain', 'email', 'organization']),
  ruleValue: z.string().min(1, "Rule value is required"),
  appliesToAllDeals: z.boolean().optional(),
  cimDocumentId: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional()
});

// Buyer Survey schemas
export const buyerSurveyQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  type: z.enum(['select', 'text', 'number', 'file_upload', 'multi_select', 'textarea']),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  category: z.string().optional(), // financial_capability, experience, strategy, etc.
  section: z.string().optional(), // groups questions ("About You", "Deal Criteria")
  crmField: z.string().nullable().optional(), // maps to CRM contact field (e.g., "buyerType", "acquisitionCriteria.industries")
  placeholder: z.string().optional(), // input hint text
});

export const insertBuyerSurveySchema = createInsertSchema(buyerSurveys).pick({
  userId: true,
  name: true
}).extend({
  organizationId: z.number().nullable().optional(),
  cimDocumentId: z.number().nullable().optional(),
  name: z.string().min(1, "Survey name is required"),
  questions: z.array(buyerSurveyQuestionSchema).min(1),
  isDefault: z.boolean().optional(),
  isRequired: z.boolean().optional()
});

export const insertBuyerSurveyResponseSchema = createInsertSchema(buyerSurveyResponses).pick({
  surveyId: true,
  signerEmail: true
}).extend({
  contactId: z.number().nullable().optional(),
  cimDocumentId: z.number().nullable().optional(),
  signerEmail: z.string().email(),
  responses: z.record(z.any())
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

export const insertExtensionTokenSchema = createInsertSchema(extensionTokens).pick({
  userId: true,
  token: true,
  expiresAt: true
}).extend({
  organizationId: z.number().optional(),
  deviceInfo: z.string().optional()
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
export type ExtensionToken = typeof extensionTokens.$inferSelect;
export type InsertExtensionToken = z.infer<typeof insertExtensionTokenSchema>;
export type CustomSection = typeof customSections.$inferSelect;
export type FinancialFile = typeof financialFiles.$inferSelect;
export type InvestorContact = typeof investorContacts.$inferSelect;
export type DocumentBaseline = typeof documentBaselines.$inferSelect;
export type InsertDocumentBaseline = z.infer<typeof insertDocumentBaselineSchema>;

export const insertInvestorContactSchema = createInsertSchema(investorContacts).pick({
  email: true,
  name: true,
  company: true,
  location: true,
  notes: true,
  tags: true,
  status: true,
  lastContactDate: true,
  nextFollowUpDate: true
}).extend({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Name is required"),
  company: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
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
  sectionDirections: z.record(z.string()), // Object with string values (allow empty for flexibility)
  formattingProfile: z.enum(["balanced", "professional", "memo", "robust", "conversational"]),
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
  // PowerForm settings - allow self-service signing via shareable link
  powerFormEnabled: boolean("power_form_enabled").default(false).notNull(),
  powerFormSlug: text("power_form_slug").unique(), // URL slug for public access (e.g., "company-nda")
  powerFormSettings: jsonb("power_form_settings").default({}).notNull(), // { maxCompletions, expiresAt, multiSignerMode, redirectUrl, customMessage, allowLinkSharing }
  powerFormCompletions: integer("power_form_completions").default(0).notNull(),
  powerFormCreatedAt: timestamp("power_form_created_at"),
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
  powerFormTemplateId: integer("power_form_template_id"), // If created via PowerForm (tracks which PowerForm was used)
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
  lastReminderAt: timestamp("last_reminder_at"),
  // PowerForm tracking - how this recipient was added
  invitedVia: text("invited_via"), // 'email', 'powerform_link', 'link_share' - how they received the signing link
  invitedByRecipientId: integer("invited_by_recipient_id") // For sequential handoff, FK to the recipient who invited them
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

// PowerForm settings schema
export const powerFormSettingsSchema = z.object({
  maxCompletions: z.number().nullable().optional(), // null = unlimited
  expiresAt: z.string().nullable().optional(), // ISO date string, null = never
  multiSignerMode: z.enum(['upfront', 'sequential', 'choice']).default('choice'), // How to handle multiple signers
  redirectUrl: z.string().nullable().optional(), // Where to redirect after completion (URL validated separately if provided)
  customMessage: z.string().nullable().optional(), // Welcome message on PowerForm entry page
  allowLinkSharing: z.boolean().default(true), // Can signers copy link for next signer (in sequential mode)
}).passthrough(); // Allow extra fields to be passed through

export type PowerFormSettings = z.infer<typeof powerFormSettingsSchema>;

export const insertUserBrandingSchema = createInsertSchema(userBranding).pick({
  logoUrl: true,
  primaryColor: true,
  companyName: true,
  emailFromName: true
}).extend({
  logoUrl: z.string().nullable().optional(),
  // Allow empty string, null, or valid hex color - transform empty to undefined
  primaryColor: z.string().nullable().optional().transform(val => {
    if (!val || val === '') return undefined;
    // Validate hex format if provided
    if (!/^#[0-9A-Fa-f]{6}$/.test(val)) return undefined;
    return val;
  }),
  // Allow empty strings, transform to null for database storage
  companyName: z.string().nullable().optional().transform(val => val === '' ? null : val),
  emailFromName: z.string().nullable().optional().transform(val => val === '' ? null : val)
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

// Schema for enabling/configuring PowerForm on a template
export const updatePowerFormSchema = z.object({
  enabled: z.boolean(),
  slug: z.string().min(3, "Slug must be at least 3 characters").max(50, "Slug must be at most 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  settings: powerFormSettingsSchema.optional(),
});

export type UpdatePowerForm = z.infer<typeof updatePowerFormSchema>;

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
// INCOMING WEBHOOKS - Receive data from external services to create CRM entities
// ============================================================================

// Incoming Webhook Actions - what to do when data is received
export const INCOMING_WEBHOOK_ACTIONS = [
  'create_contact',
  'create_deal',
  'create_task',
  'add_note',
  'create_company',
] as const;

export type IncomingWebhookAction = typeof INCOMING_WEBHOOK_ACTIONS[number];

// Incoming Webhooks - endpoints that receive data from external services
export const incomingWebhooks = pgTable("incoming_webhooks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(), // URL token like iwh_abc123...
  actionType: text("action_type").notNull(), // INCOMING_WEBHOOK_ACTIONS
  fieldMappings: jsonb("field_mappings").default([]).notNull(), // Array of field mappings
  actionConfig: jsonb("action_config").default({}).notNull(), // Additional config for action
  secret: text("secret"), // Optional HMAC verification secret
  isActive: boolean("is_active").default(true).notNull(),
  // Stats
  totalReceived: integer("total_received").default(0).notNull(),
  successCount: integer("success_count").default(0).notNull(),
  errorCount: integer("error_count").default(0).notNull(),
  // Timestamps
  lastReceivedAt: timestamp("last_received_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastErrorAt: timestamp("last_error_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Incoming Webhook Logs - tracks all received payloads and processing results
export const incomingWebhookLogs = pgTable("incoming_webhook_logs", {
  id: serial("id").primaryKey(),
  webhookId: integer("webhook_id").notNull(),
  requestId: text("request_id").notNull(), // Unique ID for this request
  sourceIp: text("source_ip"),
  rawPayload: jsonb("raw_payload").notNull(), // The original payload received
  status: text("status").notNull().default("pending"), // pending, success, failed
  mappedData: jsonb("mapped_data"), // Data after field mapping applied
  createdEntityType: text("created_entity_type"), // contact, deal, task, note, company
  createdEntityId: integer("created_entity_id"),
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at")
});

// Zod schemas for incoming webhooks
export const insertIncomingWebhookSchema = createInsertSchema(incomingWebhooks).pick({
  name: true,
  actionType: true,
  fieldMappings: true,
  actionConfig: true,
  secret: true,
}).extend({
  name: z.string().min(1, "Webhook name is required").max(100),
  actionType: z.enum(INCOMING_WEBHOOK_ACTIONS as unknown as [string, ...string[]]),
  fieldMappings: z.array(z.object({
    destField: z.string(),
    type: z.enum(['field', 'constant', 'template']),
    sourceField: z.string().optional(),
    value: z.string().optional(),
    template: z.string().optional(),
  })).default([]),
  actionConfig: z.record(z.any()).default({}),
  secret: z.string().optional(),
});

export const updateIncomingWebhookSchema = insertIncomingWebhookSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Type exports for incoming webhooks
export type IncomingWebhook = typeof incomingWebhooks.$inferSelect;
export type InsertIncomingWebhook = z.infer<typeof insertIncomingWebhookSchema>;
export type UpdateIncomingWebhook = z.infer<typeof updateIncomingWebhookSchema>;
export type IncomingWebhookLog = typeof incomingWebhookLogs.$inferSelect;

// Field mapping type (shared with automation engine)
export interface IncomingWebhookFieldMapping {
  destField: string;
  type: 'field' | 'constant' | 'template';
  sourceField?: string;
  value?: string;
  template?: string;
}

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
  'gmail',
  'microsoft',
  'internal',
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
  // Internal Actions - Phase 1
  'internal_update_stage',
  'internal_create_task',
  'internal_assign_owner',
  'internal_add_tag',
  'internal_remove_tag',
  'internal_update_field',
  'internal_send_notification',
  'internal_add_note',
  'internal_send_email',
  'internal_create_contact',
  'internal_create_deal',
  'internal_move_deal_stage',
  'internal_log_activity',
  'internal_grant_dataroom_access',
  'internal_send_nda',
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

// ============================================================================
// TEASER SYSTEM - Public teaser pages for CIM documents
// ============================================================================

// Predefined industry tags for teasers
export const TEASER_INDUSTRY_TAGS = [
  'Aerospace & Defense',
  'Agriculture',
  'Automotive',
  'Business Services',
  'Construction',
  'Consumer Products',
  'E-commerce',
  'Education',
  'Energy & Utilities',
  'Financial Services',
  'Food & Beverage',
  'Healthcare',
  'Hospitality',
  'Insurance',
  'Logistics & Transportation',
  'Manufacturing',
  'Media & Entertainment',
  'Professional Services',
  'Real Estate',
  'Retail',
  'SaaS / Software',
  'Technology',
  'Telecommunications',
] as const;

// Predefined deal type tags for teasers
export const TEASER_DEAL_TYPE_TAGS = [
  'Acquisition',
  'Asset Sale',
  'Buyout',
  'Divestiture',
  'Growth Equity',
  'Management Buyout (MBO)',
  'Merger',
  'Minority Investment',
  'Recapitalization',
  'Strategic Sale',
] as const;

// Teasers - public-facing teaser pages for CIM documents
export const teasers = pgTable("teasers", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().unique(), // One teaser per CIM

  // Content (AI-generated, editable)
  headline: text("headline"),
  summary: text("summary"),
  industryTags: text("industry_tags").array().default([]),
  dealTypeTags: text("deal_type_tags").array().default([]),

  // Cover Image (separate from CIM)
  coverImageUrl: text("cover_image_url"),
  coverImageAttribution: text("cover_image_attribution"), // For Unsplash credits
  useCimCoverImage: boolean("use_cim_cover_image").default(true).notNull(),

  // Financials (can override CIM values)
  showFinancials: boolean("show_financials").default(false).notNull(),
  revenue: text("revenue"),
  earnings: text("earnings"),
  askingPrice: text("asking_price"),

  // Share Settings
  shareSlug: text("share_slug").unique(), // SEO-friendly URL slug
  sharePassword: text("share_password"),
  isPublished: boolean("is_published").default(false).notNull(),

  // PDF Options
  includeWatermark: boolean("include_watermark").default(true).notNull(),

  // Sync Tracking (for "outdated" status when CIM changes)
  lastSyncedAt: timestamp("last_synced_at"),
  cimUpdatedSinceSync: boolean("cim_updated_since_sync").default(false).notNull(),

  // Analytics
  viewCount: integer("view_count").default(0).notNull(),
  lastViewedAt: timestamp("last_viewed_at"),

  // Featured/pinning for listings page
  isFeatured: boolean("is_featured").default(false).notNull(),
  featuredOrder: integer("featured_order").default(0),

  // Listing status (Active, Under LOI, Closed)
  listingStatus: text("listing_status").default("active").notNull(),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Teaser Views - analytics tracking for teaser pages
export const teaserViews = pgTable("teaser_views", {
  id: serial("id").primaryKey(),
  teaserId: integer("teaser_id").notNull(),

  // Viewer info
  viewerIp: text("viewer_ip"),
  viewerUserAgent: text("viewer_user_agent"),
  referrer: text("referrer"),
  sessionId: text("session_id"),

  // Engagement tracking
  timeSpentSeconds: integer("time_spent_seconds").default(0).notNull(),
  clickedSignNda: boolean("clicked_sign_nda").default(false).notNull(),
  clickedContact: boolean("clicked_contact").default(false).notNull(),

  // Timestamp
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// User Teaser Tags - custom tags saved per user for reuse
export const userTeaserTags = pgTable("user_teaser_tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tagType: text("tag_type").notNull(), // 'industry' or 'deal_type'
  tagValue: text("tag_value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Zod schemas for teaser system
export const insertTeaserSchema = createInsertSchema(teasers).pick({
  documentId: true,
  headline: true,
  summary: true,
}).extend({
  documentId: z.number().min(1, "Document ID is required"),
  headline: z.string().optional(),
  summary: z.string().optional(),
  industryTags: z.array(z.string()).optional(),
  dealTypeTags: z.array(z.string()).optional(),
  coverImageUrl: z.string().nullable().optional(),
  coverImageAttribution: z.string().nullable().optional(),
  useCimCoverImage: z.boolean().default(true),
  showFinancials: z.boolean().default(false),
  revenue: z.string().nullable().optional(),
  earnings: z.string().nullable().optional(),
  askingPrice: z.string().nullable().optional(),
  shareSlug: z.string().optional(),
  sharePassword: z.string().nullable().optional(),
  isPublished: z.boolean().default(false),
  includeWatermark: z.boolean().default(true),
  listingStatus: z.enum(["active", "under_loi", "closed"]).default("active"),
});

export const updateTeaserSchema = insertTeaserSchema.partial().omit({ documentId: true });

export const insertTeaserViewSchema = createInsertSchema(teaserViews).pick({
  teaserId: true,
}).extend({
  teaserId: z.number().min(1, "Teaser ID is required"),
  viewerIp: z.string().optional(),
  viewerUserAgent: z.string().optional(),
  referrer: z.string().optional(),
  sessionId: z.string().optional(),
});

export const insertUserTeaserTagSchema = createInsertSchema(userTeaserTags).pick({
  tagType: true,
  tagValue: true,
}).extend({
  tagType: z.enum(['industry', 'deal_type']),
  tagValue: z.string().min(1, "Tag value is required"),
});

// Type exports for teaser system
export type Teaser = typeof teasers.$inferSelect;
export type InsertTeaser = z.infer<typeof insertTeaserSchema>;
export type UpdateTeaser = z.infer<typeof updateTeaserSchema>;
export type TeaserView = typeof teaserViews.$inferSelect;
export type InsertTeaserView = z.infer<typeof insertTeaserViewSchema>;
export type UserTeaserTag = typeof userTeaserTags.$inferSelect;
export type InsertUserTeaserTag = z.infer<typeof insertUserTeaserTagSchema>;

// ============================================================================
// CRM SYSTEM - Deals, Companies, Contacts, Teams
// ============================================================================

// Organization member roles
export const ORGANIZATION_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type OrganizationRole = typeof ORGANIZATION_ROLES[number];

// Organization member statuses
export const ORGANIZATION_MEMBER_STATUSES = ['pending', 'active', 'deactivated'] as const;
export type OrganizationMemberStatus = typeof ORGANIZATION_MEMBER_STATUSES[number];

// Deal contact roles
export const DEAL_CONTACT_ROLES = ['primary', 'influencer', 'decision_maker', 'other'] as const;
export type DealContactRole = typeof DEAL_CONTACT_ROLES[number];

// CRM activity types
export const CRM_ACTIVITY_TYPES = [
  'call', 'email', 'meeting', 'task', 'note',
  'stage_change', 'deal_created', 'deal_won', 'deal_lost',
  'contact_created', 'company_created', 'file_uploaded',
  'task_created', 'task_completed'
] as const;
export type CrmActivityType = typeof CRM_ACTIVITY_TYPES[number];

// CRM object types for polymorphic relations
export const CRM_OBJECT_TYPES = ['deal', 'contact', 'company'] as const;
export type CrmObjectType = typeof CRM_OBJECT_TYPES[number];

// Organizations - Team/Workspace container
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  ownerId: integer("owner_id").notNull(), // FK to users

  // Settings
  settings: jsonb("settings").default({}).notNull(), // timezone, default currency, etc.

  // Subscription/billing (for future team-based pricing)
  subscriptionTier: text("subscription_tier").default("free"),
  seatCount: integer("seat_count").default(1).notNull(),

  // Branding
  logoUrl: text("logo_url"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Organization Members - Team membership with roles
export const organizationMembers = pgTable("organization_members", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  userId: integer("user_id"), // Nullable for pending invitations to non-existing users

  // Role and permissions
  role: text("role").notNull().default("member"), // owner, admin, member, viewer

  // Invitation tracking
  invitedBy: integer("invited_by"),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at"),
  inviteeEmail: text("invitee_email"), // Email for pending invitations (when user doesn't exist yet)
  inviteToken: text("invite_token").unique(), // Token for signup link

  // Status
  status: text("status").notNull().default("active"), // pending, active, deactivated

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  orgStatusIdx: index("organization_members_org_status_idx").on(table.organizationId, table.status),
}));

// CRM Visibility Settings Types
export const CRM_VISIBILITY_OPTIONS = ['owner_only', 'team', 'organization'] as const;
export type CrmVisibility = typeof CRM_VISIBILITY_OPTIONS[number];

export interface CrmVisibilitySettings {
  deals: CrmVisibility;
  contacts: CrmVisibility;
  companies: CrmVisibility;
}

// Teams - Custom visibility teams within an organization
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").notNull(), // FK to organization_members
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Team Members - Users can belong to multiple teams
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  organizationMemberId: integer("organization_member_id").notNull(),
  addedBy: integer("added_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Deal Collaborators - Specific access to individual deals
export const dealCollaborators = pgTable("deal_collaborators", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  organizationMemberId: integer("organization_member_id").notNull(),
  permission: text("permission").notNull().default("view"), // 'view' or 'edit'
  invitedBy: integer("invited_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Role Permissions - Customizable permissions for organization roles
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  permissionKey: text("permission_key").notNull(), // e.g., "crm.deals.delete"
  role: text("role").notNull(), // "admin" or "member" only (owner/viewer permissions are locked)
  granted: boolean("granted").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  updatedAt: true,
});

// Companies - First-class company object
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // Basic info
  name: text("name").notNull(),
  domain: text("domain"), // e.g., "acme.com"
  website: text("website"),
  logoUrl: text("logo_url"), // Company logo/image
  logoSource: text("logo_source"), // 'auto' | 'manual' - tracks how logo was set
  logoFetchAttempts: integer("logo_fetch_attempts").default(0).notNull(), // Number of auto-fetch attempts
  logoLastFetchAt: timestamp("logo_last_fetch_at"), // When logo fetch was last attempted

  // Industry and size
  industry: text("industry"),
  size: text("size"), // 1-10, 11-50, 51-200, 201-500, 501-1000, 1001+
  annualRevenue: text("annual_revenue"),

  // Location
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),

  // Contact info
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),

  // Ownership
  ownerId: integer("owner_id"), // FK to organization_members

  // Custom properties (JSON for flexibility)
  customProperties: jsonb("custom_properties").default({}).notNull(),

  // Description/notes
  description: text("description"),

  // Company type for M&A categorization
  companyType: text("company_type"), // pe_firm, strategic_acquirer, search_fund, family_office, individual, other

  // Enrichment data
  enrichmentStatus: text("enrichment_status"), // pending, enriched, failed, manual
  enrichedAt: timestamp("enriched_at"),
  enrichmentData: jsonb("enrichment_data"), // Raw enrichment results from website/API
  employeeCount: text("employee_count"),
  foundedYear: integer("founded_year"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// CRM Contacts - Enhanced contact management (evolved from investorContacts concept)
export const crmContacts = pgTable("crm_contacts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // Basic info
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),

  // Professional info
  title: text("title"),
  department: text("department"),

  // Company association
  companyId: integer("company_id"), // FK to companies

  // Ownership
  ownerId: integer("owner_id"), // FK to organization_members

  // Status tracking
  lifecycleStage: text("lifecycle_stage").default("lead"), // lead, qualified, opportunity, customer, other
  leadStatus: text("lead_status").default("new"), // new, contacted, qualified, unqualified

  // Contact type for categorization
  contactType: text("contact_type").default("other"), // buyer, seller, advisor, other

  // Custom properties
  customProperties: jsonb("custom_properties").default({}).notNull(),

  // Source tracking
  source: text("source"), // website, referral, cold_outreach, etc.

  // Activity tracking
  lastActivityDate: timestamp("last_activity_date"),

  // Social profiles
  linkedinUrl: text("linkedin_url"),

  // Avatar/Profile picture
  avatarUrl: text("avatar_url"),  // Our stored copy of the avatar
  avatarSource: text("avatar_source"),  // 'gravatar', 'google', 'manual', null

  // Notes
  notes: text("notes"),

  // Tags for categorization
  tags: text("tags").array().default([]).notNull(),

  // Buyer-specific fields (populated when contactType = 'buyer')
  buyerType: text("buyer_type"), // strategic, financial, individual, search_fund, family_office, other
  acquisitionCriteria: jsonb("acquisition_criteria"), // Revenue range, EBITDA range, industries, geographies
  financialCapability: text("financial_capability"), // unverified, self_reported, proof_of_funds, pre_approved
  proofOfFundsFile: text("proof_of_funds_file"), // File path to uploaded proof
  proofOfFundsVerifiedAt: timestamp("proof_of_funds_verified_at"),
  estimatedBudget: text("estimated_budget"), // Acquisition budget range
  priorAcquisitions: integer("prior_acquisitions"),
  qualificationScore: integer("qualification_score"), // Computed score (1-100)
  qualificationDetails: jsonb("qualification_details"), // Breakdown of scoring components
  lastScoredAt: timestamp("last_scored_at"),
  isActiveBuyer: boolean("is_active_buyer"),

  // Seller-specific fields (populated when contactType = 'seller')
  sellerStage: text("seller_stage"), // lead, meeting, proposal, engaged
  sellerMotivation: text("seller_motivation"), // retirement, burnout, partner_dispute, health, relocation, new_venture, other
  sellerTimeline: text("seller_timeline"), // immediate, 3_months, 6_months, 12_months, flexible
  sellerEngagementStatus: text("seller_engagement_status"), // prospect, contacted, meeting_scheduled, proposal_sent, engaged, on_hold, lost
  sellerEngagementSignedAt: timestamp("seller_engagement_signed_at"),
  sellerAskingPrice: text("seller_asking_price"),
  sellerListingStatus: text("seller_listing_status"), // not_listed, preparing, active, under_loi, closed
  sellerSource: text("seller_source"), // referral, direct_marketing, inbound, cold_outreach, other
  sellerReferredBy: text("seller_referred_by"),
  sellerNotes: text("seller_notes"),

  // Seller preliminary business financials (captured during lead phase before Deal exists)
  sellerRevenueRange: text("seller_revenue_range"), // e.g. "under_500k", "500k_1m", "1m_5m", "5m_10m", "10m_25m", "25m_plus"
  sellerProfitRange: text("seller_profit_range"), // e.g. "under_100k", "100k_250k", "250k_500k", "500k_1m", "1m_5m"
  sellerIndustry: text("seller_industry"),
  sellerBusinessDescription: text("seller_business_description"),

  // Seller file uploads (financials, tax returns, etc. shared during lead phase)
  sellerFiles: jsonb("seller_files"), // Array of { name, path, uploadedAt, type }

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Pipelines - Deal pipeline configuration
export const pipelines = pgTable("pipelines", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),

  // Deal rotting - days before a deal is considered stale
  dealRotting: integer("deal_rotting").default(30),

  // Currency for deals in this pipeline
  currency: text("currency").default("USD"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Pipeline Stages - Stage configuration within pipelines
export const pipelineStages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipeline_id").notNull(),

  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull(),

  // Probability of closing (0-100%)
  probability: integer("probability").default(0),

  // Visual
  color: text("color").default("#6B7280"), // Hex color

  // Terminal stage flags
  isWon: boolean("is_won").default(false).notNull(),
  isLost: boolean("is_lost").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Deals - Core deal/opportunity object
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // Basic info
  name: text("name").notNull(),
  amount: text("amount"), // Stored as text for flexibility with large numbers
  currency: text("currency").default("USD"),

  // Pipeline and stage
  pipelineId: integer("pipeline_id").notNull(),
  stageId: integer("stage_id").notNull(),

  // Dates
  closeDate: timestamp("close_date"), // Expected close date
  closedAt: timestamp("closed_at"), // Actual close date

  // Probability (can override stage probability)
  probability: integer("probability"),

  // Ownership
  ownerId: integer("owner_id"), // FK to organization_members

  // Company association
  companyId: integer("company_id"), // FK to companies

  // Custom properties
  customProperties: jsonb("custom_properties").default({}).notNull(),

  // Source and tracking
  source: text("source"),
  lostReason: text("lost_reason"),

  // Description
  description: text("description"),

  // Priority
  priority: text("priority").default("normal"), // low, normal, high

  // Soft delete
  deletedAt: timestamp("deleted_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Deal Contacts - Many-to-many relationship between deals and contacts
export const dealContacts = pgTable("deal_contacts", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  contactId: integer("contact_id").notNull(),

  // Role of the contact in this deal
  role: text("role").default("other"), // primary, influencer, decision_maker, other

  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Deal Documents - Link deals to CIM documents
export const dealDocuments = pgTable("deal_documents", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  cimDocumentId: integer("cim_document_id").notNull(),

  linkedAt: timestamp("linked_at").defaultNow().notNull()
});

// CRM Notes - Polymorphic notes for deals, contacts, companies
export const crmNotes = pgTable("crm_notes", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  authorId: integer("author_id").notNull(), // FK to users

  // Polymorphic relation
  objectType: text("object_type").notNull(), // deal, contact, company
  objectId: integer("object_id").notNull(),

  // Content (rich text stored as JSON for TipTap)
  content: text("content").notNull(),
  richContent: jsonb("rich_content"), // TipTap JSON

  // Pinning
  isPinned: boolean("is_pinned").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// CRM Activities - Timeline events for deals, contacts, companies
export const crmActivities = pgTable("crm_activities", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // Activity type
  activityType: text("activity_type").notNull(), // call, email, meeting, task, note, stage_change, etc.

  // Polymorphic relation
  objectType: text("object_type").notNull(), // deal, contact, company
  objectId: integer("object_id").notNull(),

  // Who performed the activity
  performedBy: integer("performed_by"), // FK to users

  // Activity metadata (flexible JSON for different activity types)
  metadata: jsonb("metadata").default({}).notNull(),
  // Examples:
  // For call: { duration: 300, direction: 'outbound', notes: '...' }
  // For email: { subject: '...', direction: 'sent' }
  // For stage_change: { fromStage: 'Discovery', toStage: 'Proposal' }

  // Optional title/description
  title: text("title"),
  description: text("description"),

  timestamp: timestamp("timestamp").defaultNow().notNull()
});

// CRM Attachments - Polymorphic file attachments
export const crmAttachments = pgTable("crm_attachments", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // Polymorphic relation
  objectType: text("object_type").notNull(), // deal, contact, company, note
  objectId: integer("object_id").notNull(),

  // File info
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),

  // Upload tracking
  uploadedBy: integer("uploaded_by").notNull(), // FK to users
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull()
});

// Email Templates - Reusable email templates for CRM
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // Template info
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML content

  // Categorization
  category: text("category"), // e.g., 'follow-up', 'introduction', 'proposal', etc.

  // Tracking
  createdBy: integer("created_by").notNull(), // FK to users
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Usage tracking
  usageCount: integer("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  lastUsedAt: true,
});

// Task Constants
export const TASK_REMINDER_OPTIONS = [
  'none',           // No reminder
  'at_time',        // At task due time
  '15_minutes',     // 15 minutes before
  '30_minutes',     // 30 minutes before
  '1_hour',         // 1 hour before
  '1_day',          // 1 day before
  '1_week',         // 1 week before
] as const;
export type TaskReminderOption = typeof TASK_REMINDER_OPTIONS[number];

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

// CRM Tasks - Tasks linked to deals, contacts, or companies
export const crmTasks = pgTable("crm_tasks", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // Task details
  title: text("title").notNull(),
  description: text("description"),

  // Due date/time
  dueDate: timestamp("due_date"),
  dueTime: text("due_time"), // Store as "HH:MM" string for flexibility

  // Reminder
  reminder: text("reminder").default("none"), // TASK_REMINDER_OPTIONS
  reminderSentAt: timestamp("reminder_sent_at"),
  overdueNotifiedAt: timestamp("overdue_notified_at"),

  // Assignment
  assignedTo: integer("assigned_to"), // FK to users
  createdBy: integer("created_by").notNull(), // FK to users

  // Status and priority
  status: text("status").default("pending").notNull(), // TASK_STATUSES
  priority: text("priority").default("normal").notNull(), // TASK_PRIORITIES

  // Polymorphic relation (can attach to deal, contact, or company)
  objectType: text("object_type"), // 'deal', 'contact', 'company', or null for standalone
  objectId: integer("object_id"),

  // Completion tracking
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Buyer Pipeline Stages - Customizable per organization
export const buyerPipelineStages = pgTable("buyer_pipeline_stages", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull(),
  color: text("color").default("#6B7280"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Deal Buyers - Track buyers through pipeline per deal
export const dealBuyers = pgTable("deal_buyers", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(), // FK to deals
  contactId: integer("contact_id"), // FK to crmContacts - optional
  companyId: integer("company_id"), // FK to companies - optional
  stageId: integer("stage_id").notNull(), // FK to buyerPipelineStages
  notes: text("notes"),
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUp: timestamp("next_follow_up"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Detail Page Layout Configuration - Customizable per organization
export const detailPageLayouts = pgTable("detail_page_layouts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // What object type this layout is for
  objectType: text("object_type").notNull(), // 'deal', 'contact', 'company'

  // Layout configuration stored as JSON
  // Contains sections array with: { id, title, order, visible, collapsed, fields: [{ id, visible, order }] }
  layout: jsonb("layout").notNull().default([]),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Constants for buyer pipeline
export const BUYER_CONTACT_TYPES = ['buyer', 'seller', 'advisor', 'other'] as const;

// Custom Field Types
export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'url', 'email', 'phone', 'currency'] as const;
export const CUSTOM_FIELD_OBJECT_TYPES = ['deal', 'contact', 'company'] as const;

// Custom Field Definitions - Define what custom fields exist for each object type
export const customFieldDefinitions = pgTable("custom_field_definitions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // What object this field applies to
  objectType: text("object_type").notNull(), // 'deal', 'contact', 'company'

  // Field configuration
  name: text("name").notNull(), // Internal key
  label: text("label").notNull(), // Display label
  fieldType: text("field_type").notNull(), // 'text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'url', 'email', 'phone', 'currency'
  description: text("description"),
  placeholder: text("placeholder"),

  // Options for select/multiselect fields (stored as JSON array)
  options: jsonb("options").default([]),

  // Field behavior
  isRequired: boolean("is_required").default(false).notNull(),
  isVisible: boolean("is_visible").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),

  // Field grouping (for UI organization)
  groupName: text("group_name").default("Custom Fields"),

  // Validation
  minValue: integer("min_value"), // For number/currency
  maxValue: integer("max_value"), // For number/currency
  maxLength: integer("max_length"), // For text

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Deal Views - Saved filter/column configurations for deals table
export const dealViews = pgTable("deal_views", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  userId: integer("user_id"), // null = org-level shared view

  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  isShared: boolean("is_shared").default(false).notNull(), // visible to team

  // Filter configuration
  filters: jsonb("filters").default({}).notNull(),
  // Example: { stages: [1,2], amountMin: 10000, amountMax: 100000, owners: [1], companies: [1,2], priority: ['high'], closeDateFrom: '2024-01-01', closeDateTo: '2024-12-31', status: 'open' }

  // Column configuration
  columns: jsonb("columns").default([]).notNull(),
  // Example: [{ id: 'name', visible: true, width: 200, order: 0 }, { id: 'amount', visible: true, width: 120, order: 1 }]

  // Sorting configuration
  sorting: jsonb("sorting").default({}).notNull(),
  // Example: { field: 'amount', direction: 'desc' }

  // View mode preference
  viewMode: text("view_mode").default("list"), // 'list' | 'kanban'

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// CRM Imports - Track import history and status
export const CRM_IMPORT_ENTITY_TYPES = ['contact', 'company', 'deal'] as const;
export const CRM_IMPORT_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;

export const crmImports = pgTable("crm_imports", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // What type of entity was imported
  entityType: text("entity_type").notNull(), // 'contact', 'company', 'deal'

  // File info
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), // bytes

  // Import stats
  totalRows: integer("total_rows").default(0).notNull(),
  importedCount: integer("imported_count").default(0).notNull(),
  skippedCount: integer("skipped_count").default(0).notNull(),
  duplicateCount: integer("duplicate_count").default(0).notNull(),
  errorCount: integer("error_count").default(0).notNull(),

  // Status tracking
  status: text("status").default("pending").notNull(), // 'pending', 'processing', 'completed', 'failed'

  // Column mapping used for this import (for reference/debugging)
  columnMapping: jsonb("column_mapping").default({}).notNull(),
  // Structure: { csvColumn: schemaField, ... }

  // Error details for failed rows
  errors: jsonb("errors").default([]).notNull(),
  // Structure: [{ row: number, field: string, message: string }, ...]

  // Who initiated the import
  createdBy: integer("created_by").notNull(), // FK to users

  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Dashboard AI Briefings - Cached daily AI summaries for each user
export const dashboardBriefings = pgTable("dashboard_briefings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  userId: integer("user_id").notNull(),

  // The AI-generated briefing content
  briefing: jsonb("briefing").notNull(),
  // Structure: {
  //   summary: string,
  //   priorityDeals: [{ id, name, reason, suggestedAction }],
  //   riskAlerts: [{ dealId, dealName, message }],
  //   tasksOverview: { dueToday: number, overdue: number, message: string },
  //   pendingSignatures: { count: number, message: string },
  //   pendingApprovals: { count: number, message: string },
  //   quickStats: { pipelineValue: number, dealsWonThisMonth: number }
  // }

  // Raw data used to generate the briefing (for debugging/refresh)
  sourceData: jsonb("source_data"),

  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  // Briefings are valid for the day they were generated
  validForDate: text("valid_for_date").notNull(), // Format: YYYY-MM-DD

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notifications for in-app alerts
export const NOTIFICATION_TYPES = ['mention', 'task_assigned', 'deal_update', 'comment', 'reminder'] as const;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  userId: integer("user_id").notNull(), // The user who receives the notification

  type: text("type").notNull(), // 'mention', 'task_assigned', 'deal_update', etc.
  title: text("title").notNull(),
  message: text("message").notNull(),

  // Link to the related entity
  entityType: text("entity_type"), // 'deal', 'contact', 'company', 'task', 'note'
  entityId: integer("entity_id"),

  // Who triggered the notification
  actorId: integer("actor_id"), // The user who caused the notification

  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),

  // For email notifications
  emailSent: boolean("email_sent").default(false).notNull(),
  emailSentAt: timestamp("email_sent_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User notification preferences - controls which notifications users receive
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),

  // Email Notification Toggles (per category)
  emailMentions: boolean("email_mentions").default(true).notNull(),           // @mentions in notes
  emailTaskAssigned: boolean("email_task_assigned").default(true).notNull(),  // Task assigned to you
  emailTaskReminder: boolean("email_task_reminder").default(true).notNull(),  // Task due date reminders
  emailDealUpdates: boolean("email_deal_updates").default(false).notNull(),   // Deal stage changes (you own)
  emailTeamInvites: boolean("email_team_invites").default(true).notNull(),    // Team invitation
  emailEsignRequests: boolean("email_esign_requests").default(true).notNull(), // Signature requested
  emailEsignCompleted: boolean("email_esign_completed").default(true).notNull(), // Document signed
  emailWeeklyDigest: boolean("email_weekly_digest").default(false).notNull(), // Weekly summary email

  // In-App Notification Toggles
  inappMentions: boolean("inapp_mentions").default(true).notNull(),
  inappTaskAssigned: boolean("inapp_task_assigned").default(true).notNull(),
  inappTaskReminder: boolean("inapp_task_reminder").default(true).notNull(),
  inappDealUpdates: boolean("inapp_deal_updates").default(true).notNull(),
  inappEsignRequests: boolean("inapp_esign_requests").default(true).notNull(),
  inappEsignCompleted: boolean("inapp_esign_completed").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Mentions tracking - stores @mentions in notes and comments
export const mentions = pgTable("mentions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),

  // Who was mentioned
  mentionedUserId: integer("mentioned_user_id").notNull(),

  // Who made the mention
  mentionedByUserId: integer("mentioned_by_user_id").notNull(),

  // Where the mention occurred
  entityType: text("entity_type").notNull(), // 'deal', 'contact', 'company', 'task'
  entityId: integer("entity_id").notNull(),

  // The note/comment containing the mention
  noteId: integer("note_id"), // References crmNotes.id

  // The mention text as it appears (e.g., "@John Smith")
  mentionText: text("mention_text").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Scheduled task execution logs - prevents duplicate executions in autoscaled environments
export const scheduledTaskLogs = pgTable("scheduled_task_logs", {
  id: serial("id").primaryKey(),

  // Task identifier (e.g., "daily_signup_summary", "monitoring_alert_database")
  taskName: text("task_name").notNull(),

  // Date key for daily tasks (YYYY-MM-DD format) - enables "once per day" checks
  executionDate: text("execution_date").notNull(),

  // Optional metadata about the execution
  metadata: jsonb("metadata"),

  // Timestamp of execution
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

// Support Tickets - User submitted bug reports and feedback
export const SUPPORT_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export const SUPPORT_TICKET_TYPES = ['bug', 'feature_request', 'question', 'feedback', 'other'] as const;

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id"),
  userId: integer("user_id").notNull(), // User who submitted the ticket

  // Ticket content
  type: text("type").notNull().default("bug"), // bug, feature_request, question, feedback, other
  subject: text("subject").notNull(),
  description: text("description").notNull(),

  // Attachments (URLs to uploaded files)
  attachments: jsonb("attachments").default([]).notNull(), // Array of { url, filename, mimeType, size }

  // Status
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed

  // Context information
  browserInfo: text("browser_info"), // User agent string
  pageUrl: text("page_url"), // URL where ticket was submitted

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).pick({
  type: true,
  subject: true,
  description: true
}).extend({
  type: z.enum(SUPPORT_TICKET_TYPES).default("bug"),
  subject: z.string().min(1, "Subject is required").max(200),
  description: z.string().min(1, "Description is required").max(5000),
  attachments: z.array(z.object({
    url: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number()
  })).optional().default([]),
  browserInfo: z.string().optional(),
  pageUrl: z.string().optional()
});

// AI Assistant - Token usage tracking and chat history
export const aiTokenUsage = pgTable("ai_token_usage", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  userId: integer("user_id").notNull(),

  // Token counts
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),

  // Model info
  model: text("model").notNull(),

  // Period tracking (for monthly caps)
  periodStart: text("period_start").notNull(), // Format: YYYY-MM (e.g., "2024-01")

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiChatMessages = pgTable("ai_chat_messages", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  userId: integer("user_id").notNull(),

  // Message content
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),

  // Token usage for this message
  tokensUsed: integer("tokens_used"),

  // Feedback
  feedback: text("feedback"), // 'positive', 'negative', or null

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schema for deal views
export const insertDealViewSchema = createInsertSchema(dealViews).pick({
  organizationId: true,
  name: true
}).extend({
  organizationId: z.number().min(1),
  userId: z.number().nullable().optional(),
  name: z.string().min(1, "View name is required").max(100),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
  filters: z.record(z.any()).optional(),
  columns: z.array(z.object({
    id: z.string(),
    visible: z.boolean(),
    width: z.number().optional(),
    order: z.number()
  })).optional(),
  sorting: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc'])
  }).optional(),
  viewMode: z.enum(['list', 'kanban']).optional()
});

// Insert schema for CRM imports
export const insertCrmImportSchema = createInsertSchema(crmImports).pick({
  organizationId: true,
  entityType: true,
  fileName: true,
  createdBy: true
}).extend({
  organizationId: z.number().min(1),
  entityType: z.enum(CRM_IMPORT_ENTITY_TYPES as unknown as [string, ...string[]]),
  fileName: z.string().min(1),
  fileSize: z.number().optional(),
  totalRows: z.number().optional(),
  columnMapping: z.record(z.any()).optional(),
  createdBy: z.number().min(1)
});

// Zod schemas for CRM system

export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  slug: true,
  ownerId: true
}).extend({
  name: z.string().min(1, "Organization name is required").max(100),
  slug: z.string().min(1, "Slug is required").max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  ownerId: z.number().min(1),
  settings: z.record(z.any()).optional(),
  logoUrl: z.string().nullable().optional()
});

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).pick({
  organizationId: true,
  userId: true,
  role: true
}).extend({
  organizationId: z.number().min(1),
  userId: z.number().min(1),
  role: z.enum(ORGANIZATION_ROLES as unknown as [string, ...string[]]).default('member'),
  status: z.enum(ORGANIZATION_MEMBER_STATUSES as unknown as [string, ...string[]]).default('active')
});

// Insert schemas for Teams
export const insertTeamSchema = createInsertSchema(teams).pick({
  organizationId: true,
  name: true,
  createdBy: true
}).extend({
  organizationId: z.number().min(1),
  name: z.string().min(1, "Team name is required").max(100),
  description: z.string().max(500).nullable().optional(),
  createdBy: z.number().min(1)
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).pick({
  teamId: true,
  organizationMemberId: true,
  addedBy: true
}).extend({
  teamId: z.number().min(1),
  organizationMemberId: z.number().min(1),
  addedBy: z.number().min(1)
});

export const DEAL_COLLABORATOR_PERMISSIONS = ['view', 'edit'] as const;

export const insertDealCollaboratorSchema = createInsertSchema(dealCollaborators).pick({
  dealId: true,
  organizationMemberId: true,
  invitedBy: true
}).extend({
  dealId: z.number().min(1),
  organizationMemberId: z.number().min(1),
  permission: z.enum(DEAL_COLLABORATOR_PERMISSIONS).default('view'),
  invitedBy: z.number().min(1)
});

// Helper to normalize URLs - automatically adds https:// if no protocol is present
const normalizeUrlValue = (val: unknown): string | null => {
  if (val === '' || val === undefined || val === null) return null;
  if (typeof val !== 'string') return null;

  let url = val.trim();
  if (!url) return null;

  // Add https:// if no protocol is present
  if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url;
  }

  return url;
};

const optionalUrl = z.preprocess(
  normalizeUrlValue,
  z.string().url().nullable().optional()
);

export const insertCompanySchema = createInsertSchema(companies).pick({
  organizationId: true,
  name: true
}).extend({
  organizationId: z.number().min(1),
  name: z.string().min(1, "Company name is required").max(200),
  domain: z.string().nullable().optional(),
  website: optionalUrl,
  industry: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  annualRevenue: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  linkedinUrl: optionalUrl,
  ownerId: z.number().nullable().optional(),
  customProperties: z.record(z.any()).optional(),
  description: z.string().nullable().optional(),
  // Company type and enrichment
  companyType: z.enum(['pe_firm', 'strategic_acquirer', 'search_fund', 'family_office', 'individual', 'other']).nullable().optional(),
  enrichmentStatus: z.enum(['pending', 'enriched', 'failed', 'manual']).nullable().optional(),
  enrichmentData: z.record(z.any()).nullable().optional(),
  employeeCount: z.string().nullable().optional(),
  foundedYear: z.number().nullable().optional()
});

export const insertCrmContactSchema = createInsertSchema(crmContacts).pick({
  organizationId: true,
  email: true
}).extend({
  organizationId: z.number().min(1),
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  companyId: z.number().nullable().optional(),
  ownerId: z.number().nullable().optional(),
  lifecycleStage: z.string().nullable().optional(),
  leadStatus: z.string().nullable().optional(),
  contactType: z.enum(BUYER_CONTACT_TYPES as unknown as [string, ...string[]]).optional(),
  customProperties: z.record(z.any()).optional(),
  source: z.string().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  // Buyer-specific fields
  buyerType: z.enum(['strategic', 'financial', 'individual', 'search_fund', 'family_office', 'other']).nullable().optional(),
  acquisitionCriteria: z.record(z.any()).nullable().optional(),
  financialCapability: z.enum(['unverified', 'self_reported', 'proof_of_funds', 'pre_approved']).nullable().optional(),
  proofOfFundsFile: z.string().nullable().optional(),
  estimatedBudget: z.string().nullable().optional(),
  priorAcquisitions: z.number().nullable().optional(),
  qualificationScore: z.number().min(0).max(100).nullable().optional(),
  qualificationDetails: z.record(z.any()).nullable().optional(),
  isActiveBuyer: z.boolean().nullable().optional()
});

export const insertPipelineSchema = createInsertSchema(pipelines).pick({
  organizationId: true,
  name: true
}).extend({
  organizationId: z.number().min(1),
  name: z.string().min(1, "Pipeline name is required").max(100),
  isDefault: z.boolean().optional(),
  dealRotting: z.number().min(1).max(365).optional(),
  currency: z.string().length(3).optional()
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).pick({
  pipelineId: true,
  name: true,
  displayOrder: true
}).extend({
  pipelineId: z.number().min(1),
  name: z.string().min(1, "Stage name is required").max(100),
  displayOrder: z.number().min(0),
  probability: z.number().min(0).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional()
});

export const insertDealSchema = createInsertSchema(deals).pick({
  organizationId: true,
  name: true,
  pipelineId: true,
  stageId: true
}).extend({
  organizationId: z.number().min(1),
  name: z.string().min(1, "Deal name is required").max(200),
  amount: z.string().nullable().optional(),
  currency: z.string().length(3).optional(),
  pipelineId: z.number().min(1),
  stageId: z.number().min(1),
  closeDate: z.union([z.date(), z.string().transform(s => s ? new Date(s) : null)]).nullable().optional(),
  probability: z.number().min(0).max(100).nullable().optional(),
  ownerId: z.number().nullable().optional(),
  companyId: z.number().nullable().optional(),
  customProperties: z.record(z.any()).optional(),
  source: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional()
});

export const insertDealContactSchema = createInsertSchema(dealContacts).pick({
  dealId: true,
  contactId: true
}).extend({
  dealId: z.number().min(1),
  contactId: z.number().min(1),
  role: z.enum(DEAL_CONTACT_ROLES as unknown as [string, ...string[]]).optional()
});

export const insertDealDocumentSchema = createInsertSchema(dealDocuments).pick({
  dealId: true,
  cimDocumentId: true
}).extend({
  dealId: z.number().min(1),
  cimDocumentId: z.number().min(1)
});

export const insertCrmNoteSchema = createInsertSchema(crmNotes).pick({
  organizationId: true,
  authorId: true,
  objectType: true,
  objectId: true,
  content: true
}).extend({
  organizationId: z.number().min(1),
  authorId: z.number().min(1),
  objectType: z.enum(CRM_OBJECT_TYPES as unknown as [string, ...string[]]),
  objectId: z.number().min(1),
  content: z.string().min(1, "Note content is required"),
  richContent: z.any().optional(),
  isPinned: z.boolean().optional()
});

export const insertCrmActivitySchema = createInsertSchema(crmActivities).pick({
  organizationId: true,
  activityType: true,
  objectType: true,
  objectId: true
}).extend({
  organizationId: z.number().min(1),
  activityType: z.enum(CRM_ACTIVITY_TYPES as unknown as [string, ...string[]]),
  objectType: z.enum(CRM_OBJECT_TYPES as unknown as [string, ...string[]]),
  objectId: z.number().min(1),
  performedBy: z.number().nullable().optional(),
  metadata: z.record(z.any()).optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  timestamp: z.date().optional()
});

export const insertCrmAttachmentSchema = createInsertSchema(crmAttachments).pick({
  organizationId: true,
  objectType: true,
  objectId: true,
  fileName: true,
  filePath: true,
  fileSize: true,
  mimeType: true,
  uploadedBy: true
}).extend({
  organizationId: z.number().min(1),
  objectType: z.enum([...CRM_OBJECT_TYPES, 'note'] as unknown as [string, ...string[]]),
  objectId: z.number().min(1),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().min(0),
  mimeType: z.string().min(1),
  uploadedBy: z.number().min(1)
});

// Task Schemas
export const insertCrmTaskSchema = createInsertSchema(crmTasks).pick({
  organizationId: true,
  title: true,
  createdBy: true
}).extend({
  organizationId: z.number().min(1),
  title: z.string().min(1, "Task title is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.union([z.date(), z.string().transform(s => s ? new Date(s) : null)]).nullable().optional(),
  dueTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable().optional(),
  reminder: z.enum(TASK_REMINDER_OPTIONS as unknown as [string, ...string[]]).default("none"),
  assignedTo: z.number().nullable().optional(),
  createdBy: z.number().min(1),
  status: z.enum(TASK_STATUSES as unknown as [string, ...string[]]).default("pending"),
  priority: z.enum(TASK_PRIORITIES as unknown as [string, ...string[]]).default("normal"),
  objectType: z.enum([...CRM_OBJECT_TYPES, ''] as unknown as [string, ...string[]]).nullable().optional(),
  objectId: z.number().nullable().optional(),
});

export const updateCrmTaskSchema = z.object({
  title: z.string().min(1, "Task title is required").max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.union([z.date(), z.string().transform(s => s ? new Date(s) : null)]).nullable().optional(),
  dueTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable().optional(),
  reminder: z.enum(TASK_REMINDER_OPTIONS as unknown as [string, ...string[]]).optional(),
  assignedTo: z.number().nullable().optional(),
  status: z.enum(TASK_STATUSES as unknown as [string, ...string[]]).optional(),
  priority: z.enum(TASK_PRIORITIES as unknown as [string, ...string[]]).optional(),
  objectType: z.enum([...CRM_OBJECT_TYPES, ''] as unknown as [string, ...string[]]).nullable().optional(),
  objectId: z.number().nullable().optional(),
});

// Buyer Pipeline Schemas
export const insertBuyerPipelineStageSchema = createInsertSchema(buyerPipelineStages).pick({
  organizationId: true,
  name: true,
  displayOrder: true
}).extend({
  organizationId: z.number().min(1),
  name: z.string().min(1, "Stage name is required").max(100),
  displayOrder: z.number().min(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional()
});

export const insertDealBuyerSchema = createInsertSchema(dealBuyers).pick({
  dealId: true,
  stageId: true
}).extend({
  dealId: z.number().min(1),
  contactId: z.number().nullable().optional(),
  companyId: z.number().nullable().optional(),
  stageId: z.number().min(1),
  notes: z.string().nullable().optional(),
  lastContactDate: z.union([z.date(), z.string().transform(s => s ? new Date(s) : null)]).nullable().optional(),
  nextFollowUp: z.union([z.date(), z.string().transform(s => s ? new Date(s) : null)]).nullable().optional()
});

export const insertCustomFieldDefinitionSchema = createInsertSchema(customFieldDefinitions).pick({
  objectType: true,
  name: true,
  label: true,
  fieldType: true
}).extend({
  organizationId: z.number().min(1),
  objectType: z.enum(CUSTOM_FIELD_OBJECT_TYPES),
  name: z.string().min(1, "Field name is required").max(50).regex(/^[a-z][a-zA-Z0-9_]*$/, "Field name must start with lowercase letter and contain only letters, numbers, and underscores"),
  label: z.string().min(1, "Label is required").max(100),
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  description: z.string().max(500).nullable().optional(),
  placeholder: z.string().max(100).nullable().optional(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    color: z.string().optional()
  })).optional().default([]),
  isRequired: z.boolean().optional().default(false),
  isVisible: z.boolean().optional().default(true),
  displayOrder: z.number().min(0).optional().default(0),
  groupName: z.string().max(50).optional().default("Custom Fields"),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  maxLength: z.number().min(1).max(10000).nullable().optional()
});

// Type exports for CRM system
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

export type DealCollaborator = typeof dealCollaborators.$inferSelect;
export type InsertDealCollaborator = z.infer<typeof insertDealCollaboratorSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;

export type Pipeline = typeof pipelines.$inferSelect;
export type InsertPipeline = z.infer<typeof insertPipelineSchema>;

export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;

export type DealContact = typeof dealContacts.$inferSelect;
export type InsertDealContact = z.infer<typeof insertDealContactSchema>;

export type DealDocument = typeof dealDocuments.$inferSelect;
export type InsertDealDocument = z.infer<typeof insertDealDocumentSchema>;

export type CrmNote = typeof crmNotes.$inferSelect;
export type InsertCrmNote = z.infer<typeof insertCrmNoteSchema>;

export type CrmActivity = typeof crmActivities.$inferSelect;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;

export type CrmAttachment = typeof crmAttachments.$inferSelect;
export type InsertCrmAttachment = z.infer<typeof insertCrmAttachmentSchema>;

export type CrmTask = typeof crmTasks.$inferSelect;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;
export type UpdateCrmTask = z.infer<typeof updateCrmTaskSchema>;

export type BuyerPipelineStage = typeof buyerPipelineStages.$inferSelect;
export type InsertBuyerPipelineStage = z.infer<typeof insertBuyerPipelineStageSchema>;

export type DealBuyer = typeof dealBuyers.$inferSelect;
export type InsertDealBuyer = z.infer<typeof insertDealBuyerSchema>;

export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;
export type InsertCustomFieldDefinition = z.infer<typeof insertCustomFieldDefinitionSchema>;

export type CrmImport = typeof crmImports.$inferSelect;
export type InsertCrmImport = z.infer<typeof insertCrmImportSchema>;

export type DashboardBriefing = typeof dashboardBriefings.$inferSelect;

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = typeof userNotificationPreferences.$inferInsert;

export type Session = typeof session.$inferSelect;
export type EmailVerificationCode = typeof emailVerificationCodes.$inferSelect;

// Buyer Management types
export type NdaWhitelistRule = typeof ndaWhitelistRules.$inferSelect;
export type InsertNdaWhitelistRule = z.infer<typeof insertNdaWhitelistRuleSchema>;

export type BuyerSurvey = typeof buyerSurveys.$inferSelect;
export type InsertBuyerSurvey = z.infer<typeof insertBuyerSurveySchema>;

export type BuyerSurveyResponse = typeof buyerSurveyResponses.$inferSelect;
export type InsertBuyerSurveyResponse = z.infer<typeof insertBuyerSurveyResponseSchema>;