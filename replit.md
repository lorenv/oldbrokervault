# CIM Share - Confidential Information Memorandum Platform

## Overview
CIM Share is a full-stack web application designed to create, manage, and securely share professional Confidential Information Memorandums (CIMs). The platform leverages AI to transform business meeting transcripts into structured documents and offers robust sharing features with built-in NDA protection. Its primary purpose is to streamline document creation, enhance secure sharing capabilities, and provide valuable analytics for businesses.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application utilizes a client-server architecture.

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **Styling**: Tailwind CSS with Shadcn UI
- **State Management**: React Query (server state), React Context (auth state)
- **Forms**: React Hook Form with Zod

### Backend
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: Session-based using Passport.js
- **File Storage**: Replit Object Storage (Google Cloud Storage) with filesystem fallback
- **Session Store**: PostgreSQL-backed

### AI & Document Generation
AI services are used for real-time website content analysis, business transcript processing, structured document generation, and intelligent data merging. AI-generated content is formatted based on configurable profiles (e.g., professional, memo, balanced) and supports HTML elements like paragraphs, bold, italic, lists, and tables.

### Authentication & Authorization
Session-based authentication with secure cookies is implemented, featuring rate limiting, input validation, and CSRF protection. The system supports standard user and admin accounts with Role-Based Access Control (RBAC).

### Subscription Management
Subscription plans (Free Trial, Standard, Enterprise) are managed via Stripe, including usage tracking, checkout, and a customer portal.

### Document Export & Sharing
Documents can be exported in PDF, Word (DOCX), and HTML formats, with WordPress integration. Security features include watermarking, access controls, expiration dates, token-based sharing, and view tracking. A robust NDA system incorporates template creation, digital signatures, audit trails, and IP-based location estimation. Document owners have an owner toolbar for analytics and editing.

### E-Signature Platform
The system includes a comprehensive e-signature platform with database schema for signing sessions, recipients, field assignments, and audit logging. It supports multi-field types (signature, name, date, email, text, checkbox, initials), parallel signing workflows, and ESIGN Act compliance. A simplified single-signer system is specifically designed for NDA share link workflows.

**Recent Update (Aug 2025)**: Enhanced completion notification system to properly embed signature fields into the final PDF. Removed fallback certificate mechanisms that created plain text certificates without proper grey header styling. The system now generates professional completion certificates with DocuSign-style grey headers and detailed signature information, ensuring all signed documents contain the actual signature data in the correct coordinates.

**Critical Fix (Aug 13, 2025)**: Resolved coordinate mapping issue where signature fields appeared "jumbled at the top left" instead of their correct positions. The root cause was that signature fields are stored as percentage coordinates (0-100%) in the database, but the PDF processor was incorrectly treating them as pixel coordinates. Updated the coordinate transformation logic in `PdfSignatureProcessor` to properly convert percentage coordinates to PDF page coordinates, ensuring completed signature fields now appear in their exact original template positions.

**Message Center Enhancement (Aug 13, 2025)**: Fixed content overflow issues and added CIM document filtering functionality. Resolved SendGrid email content error that prevented contact form notifications from being sent. Enhanced the Message Center with:
- Content overflow fixes using proper text truncation and break-word styles
- CIM document filtering dropdown with message counts
- Improved responsive design for better mobile experience
- Backend support for filtering messages by CIM document ID
- Fixed empty text content issue in SendGrid email service

**Authentication Fix (Aug 14, 2025)**: Resolved production login issues caused by incompatible session cookie settings. Updated session configuration to use `SameSite=Lax` in production environment for optimal browser compatibility on Replit's platform. Fixed frontend error handling to properly parse JSON error responses from the API, eliminating "Unexpected token" errors during login failures. The fix ensures session cookies work correctly across all browsers in production while maintaining security.

**Critical Routing Fix (Aug 15, 2025)**: Resolved persistent "Unexpected token" authentication errors where browsers received HTML instead of JSON from API endpoints. Root cause was improper route registration order - the frontend catchall route (`app.use("*")`) was intercepting API requests before they reached the API handlers. Fixed by ensuring API routes are registered before Vite/static middleware setup, preventing the catchall from interfering with `/api/*` endpoints. Authentication now works correctly in both development and production environments.

**AWS Cognito Migration (Aug 28, 2025)**: Successfully migrated from session-based authentication to AWS Cognito integration while preserving all existing UI/UX. Key achievements:
- Implemented comprehensive Cognito authentication service with JWT token verification
- Created new authentication routes that maintain custom registration forms and password reset flows
- Updated database schema to link local users with Cognito user IDs via `cognito_user_id` field
- Developed user migration script for transferring existing users (requires AWS credentials)
- Fixed Cognito username generation issue where email-like patterns were rejected by implementing random username generation (`u[timestamp][random]`)
- Preserved all existing frontend UI while integrating with Cognito backend services
- System now ready for future social logins and 2FA integration using shared AWS Cognito user pool

**Critical Authentication Fixes (Aug 29, 2025)**: Resolved major authentication system issues:
- Fixed registration bug where new users weren't getting `cognitoUserId` saved to local database, causing all new users to appear as "legacy users"
- Resolved verification email redirect loop by updating backend redirects to use frontend routes (`/#/verify-email`) instead of backend endpoints
- Fixed verification token generation flaw where timestamps caused tokens to never match during verification, making all verification links fail
- Enhanced error handling to properly distinguish between unverified users, legacy users, and authentication failures
- Authentication system now fully functional with proper Cognito integration for new user registration, email verification, and login flows

### Website Crawler
A fully functional real-time website content analysis feature integrates with AI to merge website data with user transcripts, prioritizing transcript data.

### UI/UX Decisions
The design emphasizes a clean, modern aesthetic using Tailwind CSS and Shadcn UI, focusing on intuitive workflows for document creation, editing, and sharing. Professional presentation for CIM documents is a priority, with customizable branding and template systems. A "Get Started" checklist guides new users through key actions.

### Deployment
The application is deployed on Replit Static Deployment, utilizing Node.js 20 and PostgreSQL 16. Build processes leverage Vite for the frontend and ESBuild for the backend.

## External Dependencies
- **Perplexity API**: Primary AI for real-time website analysis (using `sonar-pro` model).
- **OpenAI API**: Secondary AI for enhanced document analysis.
- **Stripe**: Payment gateway for subscriptions.
- **SendGrid**: Email delivery for notifications and sharing.
- **Neon Database**: Serverless PostgreSQL hosting.
- **Replit Hosting**: Development and deployment platform.
- **Google Cloud Storage**: Used via Replit Object Storage for file persistence.
- **pdf-lib**: For PDF processing, including embedding signed values and certificates.