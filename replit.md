# CIM Share - Confidential Information Memorandum Platform

## Overview
CIM Share is a full-stack web application designed to create, manage, and securely share professional Confidential Information Memorandums (CIMs). It leverages AI to transform business meeting transcripts into structured documents and offers robust sharing features with built-in NDA protection. The platform aims to streamline document creation, enhance secure sharing, and provide analytics for businesses.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application employs a client-server architecture.

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **Styling**: Tailwind CSS with Shadcn UI
- **State Management**: React Query (server state), React Context (auth state)
- **Forms**: React Hook Form with Zod

### Backend
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL (via Neon's serverless offering)
- **ORM**: Drizzle ORM
- **Authentication**: Session-based using Passport.js
- **File Storage**: Replit Object Storage (Google Cloud Storage) with filesystem fallback
- **Session Store**: PostgreSQL-backed

### AI & Document Generation
- **AI Services**: Perplexity API (primary, using sonar-pro model for real-time website analysis), OpenAI GPT-4o (secondary, for enhanced analysis)
- **Capabilities**: Real-time website content analysis, business transcript processing, structured document generation, intelligent data merging.

### Authentication & Authorization
- **Method**: Session-based with secure cookies
- **Security**: Rate limiting, input validation, CSRF protection
- **Roles**: Standard users and admin accounts with RBAC

### Subscription Management
- **Payment Processor**: Stripe
- **Plans**: Free Trial (1 document, 2 regenerations), CIM Share Standard ($99/month, 20 documents, unlimited regenerations), Enterprise (unlimited).
- **Features**: Usage tracking, Stripe checkout, customer portal.

### Document Export & Sharing
- **Export Formats**: PDF, Word (DOCX), HTML, WordPress integration
- **Security**: Watermarking, access controls, expiration dates, token-based sharing, view tracking.
- **NDAs**: Template system with custom agreements, digital signatures, audit trails, IP-based location estimation.
- **Owner Features**: Owner toolbar for logged-in document owners with analytics and edit buttons, NDA bypass functionality with explanatory message, separate owner view tracking.

### Deployment
- **Platform**: Replit Static Deployment (for persistent filesystem storage)
- **Environment**: Node.js 20, PostgreSQL 16
- **Build Process**: Vite (frontend), ESBuild (backend)

### UI/UX Decisions
- Clean, modern design using Tailwind CSS and Shadcn UI components.
- Focus on intuitive workflows for document creation, editing, and sharing.
- Professional presentation for CIM documents, including customizable branding and template systems.

## External Dependencies
- **Perplexity API**: Real-time website analysis using sonar-pro model (updated Aug 2025).
- **OpenAI API**: Enhanced AI document analysis.
- **Stripe**: Payment gateway for subscriptions and billing.
- **SendGrid**: Email delivery for notifications and sharing.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Replit Hosting**: Development and deployment platform.
- **Google Cloud Storage**: Used via Replit Object Storage for file persistence.

## Recent Changes (August 2025)
### Enhanced E-Signature Platform Implementation (August 7, 2025)
- **Comprehensive Database Schema**: Added 4 new tables for signing sessions, recipients, field assignments, and audit logging
- **Enhanced Template Editor**: Drag-and-drop field placement with coordinate saving and recipient assignment
- **Multi-Field Support**: Signature, name, date, email, text, checkbox, and initials fields with validation
- **Parallel Signing Workflow**: Multiple recipients can sign simultaneously with real-time progress tracking
- **Advanced Audit System**: Complete IP tracking, user agent logging, location estimation, and action timestamps
- **ESIGN Act Compliance**: Digital certificate generation, comprehensive audit trails, and secure token-based access
- **Canvas Overlay Technology**: Transparent HTML5 canvas for precise field positioning with percentage-based coordinates
- **Email Integration**: Automated signing invitations and completion notifications with custom branding
- **React DnD Integration**: Professional drag-and-drop interface for field management and placement
### Website Crawler Feature Implementation
- **Issue Fixed**: Updated deprecated Perplexity model from `llama-3.1-sonar-small-128k-online` to `sonar-pro`
- **Website Analysis**: Fully functional real-time analysis of company websites during CIM generation
- **URL Handling**: Robust support for various URL formats (with/without protocol, with/without www)
- **User Control**: Optional website analysis toggle with progress tracking
- **Data Integration**: Website data intelligently merged with user transcripts, with transcript taking precedence
- **Progress Tracking**: Added "Analyzing website content" stage to generation progress

### Example CIM Document System Enhancement
- **Asset Creation**: Implemented comprehensive ExampleAssetsCreator class for generating professional SVG-based assets
- **Complete Assets**: Added cover image generation and upload alongside business images, logo, and financial documents
- **Object Storage**: All example assets properly uploaded to persistent storage during user registration
- **Content Quality**: Example CIM (Tony's Transmissions) includes 4 business images, logo, cover image, financial docs, and 7 analysis sections

### AI Content Generation Improvements (August 6, 2025)
- **Apostrophe Fix**: Fixed JSON processing to preserve proper apostrophes ('), smart quotes ("), and punctuation in generated content
- **Grammar Enhancement**: AI now generates natural language with correct contractions like "it's", "don't", "company's"
- **HTML Support**: Rich text editor supports paragraphs, bold/italic formatting, and lists
- **Table Capability**: AI can generate HTML tables (`<table>`, `<tr>`, `<td>`, `<th>`) for financial data and comparisons
- **Formatting Guidelines**: Clear instructions for AI to use proper punctuation and avoid escaping apostrophes

### Subscription Security Enhancement
- **Critical Fix**: Closed subscription bypass loophole where users could delete and recreate documents to exceed limits
- **Root Cause**: Document limit validation used database count instead of monthly counter, allowing deletion bypass
- **Solution**: Modified `checkUserLimit()` to use `monthlyDocumentsCreated` counter consistently
- **Security Impact**: Users can no longer circumvent subscription limits through document deletion
- **Billing Integrity**: Monthly counters track total documents created per month regardless of deletions

## Multi-Recipient E-Signature System Architecture (August 8, 2025)
**Note**: This documents the complete multi-recipient e-signature system before modification for NDA-specific use. Preserved for future full e-signature feature development.

### Database Schema
- **`ndaSigningSessions`**: Main signing session with template, title, message, creator, status, expiration
- **`ndaRecipients`**: Individual recipients with name, email, role (signer/cc/approver), access tokens, status tracking
- **`ndaFieldAssignments`**: Links specific fields to recipients with required/prefilled settings
- **`ndaAuditLog`**: Complete audit trail with IP tracking, user agent, location estimation, timestamps

### Component Architecture
- **`EnhancedNdaTemplateEditor`**: Main drag-and-drop template editor with multi-recipient management
- **`RecipientManager`**: Add/edit/delete recipients with email validation and role assignment
- **`FieldPalette`**: Draggable field types (signature, name, date, email, text, checkbox, initials)
- **`CanvasOverlay`**: HTML5 canvas for precise field positioning with percentage-based coordinates
- **`ImageDocumentViewer`**: Multi-page PDF display with zoom controls and field overlay support
- **`EnhancedSignatureField`**: Field components with recipient assignment and validation

### Key Features
- **Multi-Recipient Support**: Multiple signers, CCs, and approvers per document
- **Field Assignment**: Drag fields and assign to specific recipients by email
- **Parallel Signing**: Multiple recipients can sign simultaneously with real-time progress
- **Access Token Security**: Unique tokens per recipient with expiration and IP tracking
- **Email Workflow**: Automated invitations and completion notifications with custom branding
- **Coordinate System**: Percentage-based positioning for responsive field placement across PDF pages
- **PDF Processing**: Convert PDF templates to images, embed signed values back to PDF
- **Audit Compliance**: Complete ESIGN Act compliance with certificates and verification

### API Endpoints
- `POST /api/esignature/templates/upload`: Process PDF templates to page images
- `POST /api/esignature/signing-sessions`: Create signing session with recipients and field assignments
- `POST /api/esignature/signing-sessions/:id/send`: Send signing invitations to all recipients
- `GET /api/esignature/sign/:accessToken`: Access document for signing via unique token
- `POST /api/esignature/sign/:accessToken/fields/:fieldId`: Sign specific field with audit logging
- `GET /api/esignature/signing-sessions/:id/certificate`: Generate completion certificate

### Workflow
1. **Template Creation**: Upload PDF, place fields, assign fields to recipients
2. **Session Creation**: Define recipients (name/email/role), set expiration, customize message
3. **Document Distribution**: System sends personalized emails with unique access links
4. **Parallel Signing**: Recipients access via tokens, sign assigned fields, audit trail captured
5. **Completion**: All signatures collected, certificate generated, notifications sent

### Technical Implementation
- **React DnD**: Professional drag-and-drop interface for field management
- **pdf-lib**: PDF processing for embedding signed values and certificates
- **Object Storage**: Template images and completed documents stored persistently
- **Session Management**: Secure token-based access with expiration and validation
- **Real-time Updates**: Progress tracking across multiple simultaneous signers

### NDA Template Editor Simplification (August 8, 2025)
**Note**: Implemented simplified single-signer system specifically for NDA share link workflows while preserving the full multi-recipient system architecture above.

#### Changes Made
- **Single Designated Placeholder**: Replaced multi-recipient management with single "NDA Signer" placeholder (ID: 999999)
- **Simplified UI Components**: Created `NdaSignerDisplay` and `NdaFieldPalette` components without recipient selection complexity
- **Auto-Assignment**: All dragged signature fields automatically assign to the designated NDA signer placeholder
- **Removed Complexity**: Eliminated recipient management, email validation, and selection interfaces
- **Streamlined Workflow**: Template editor now focuses purely on field placement for unknown signers
- **Share Link Integration**: Designed for scenarios where signer identity is unknown until they access the NDA via share link

#### Technical Implementation
- **Components**: `NdaSignerDisplay`, `NdaFieldPalette` replace `RecipientManager`, `FieldPalette`
- **State Management**: Simplified recipient state to single placeholder object
- **Validation**: Removed email/name requirements, simplified save validation
- **Field Assignment**: Automatic assignment to placeholder recipient (ID: 999999)
- **UI Simplification**: Removed recipient modals, selection dropdowns, and management interfaces

### Get Started Checklist Implementation (August 8, 2025)
- **Replaced Onboarding Tour**: Removed existing guided tour and registration success toast messages
- **Bottom-Right Checklist**: Implemented Webflow-style get started checklist positioned in bottom-right corner
- **Light Theme Design**: Clean, modern light-themed design with progress bar and completion tracking
- **Four Key Items**: Complete profile, Choose NDA/PDF settings, View a CIM, Share a CIM
- **Smart Navigation**: Dynamically finds user's example Tony's Transmissions CIM for share link
- **Progress Tracking**: LocalStorage-based progress persistence with dismiss functionality
- **Navigation Integration**: Fixed investor database menu visibility for all authenticated users instead of premium-only
- **Correct Navigation Links**: Profile links to `/account?tab=profile`, Templates to `/account?tab=templates`, Share CIM dynamically resolves user's example document

### HTML-to-PDF Formatting Fix (August 8, 2025)
- **Root Cause**: TipTap rich text editor outputs HTML tags (`<p>`, `<strong>`, `<ul>`, etc.), but PDF generation was treating HTML as plain text
- **Solution**: Implemented comprehensive HTML-to-formatted-text converter in `server/document-export.ts`
- **HTML Parser**: Processes HTML tags and converts to PDFKit-compatible formatted text with styling metadata
- **Supported Formatting**: Paragraphs, bold (`<strong>`, `<b>`), italic (`<em>`, `<i>`), bullet lists (`<ul>`, `<li>`), numbered lists (`<ol>`), headings (`<h1-h6>`), line breaks (`<br>`)
- **Smart Content Detection**: Automatically detects HTML vs. markdown content and chooses appropriate renderer
- **Formatted Text Renderer**: New `renderFormattedText()` function applies proper fonts (Helvetica-Bold, Helvetica-Oblique) and sizing to PDF output
- **Backward Compatibility**: Preserves existing markdown processing for legacy content while adding HTML support
- **Enhanced Logging**: Added detailed console logging for debugging content type detection and formatting application