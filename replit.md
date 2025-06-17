# CIM Share - Confidential Information Memorandum Platform

## Overview

CIM Share is a full-stack web application that enables businesses to create, manage, and share professional Confidential Information Memorandums (CIMs) using AI-powered analysis. The platform transforms business meeting transcripts into structured, professional documents while providing secure sharing capabilities with built-in NDA protection.

## System Architecture

The application follows a modern client-server architecture with clear separation of concerns:

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter (lightweight alternative to React Router)
- **Styling**: Tailwind CSS with Shadcn UI component library
- **State Management**: React Query for server state, React Context for auth state
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL via Neon's serverless offering
- **ORM**: Drizzle ORM with migration support
- **Authentication**: Session-based using Passport.js with Local Strategy
- **File Storage**: Local file system with base64 encoding for persistence
- **Session Store**: PostgreSQL-backed session storage

### Deployment Strategy
- **Platform**: Replit with CloudRun deployment target
- **Environment**: Node.js 20 with PostgreSQL 16
- **Build Process**: Vite for frontend, ESBuild for backend bundling
- **Static Assets**: Served via Express with proper caching headers

## Key Components

### AI-Powered Document Generation
- **Primary AI Service**: Perplexity API (llama-3.1-sonar-small-128k-online) for document analysis
- **Secondary Service**: OpenAI GPT-4o for enhanced analysis capabilities
- **Features**: Website content analysis, business transcript processing, structured document generation

### Authentication & Authorization
- **Method**: Session-based authentication with secure cookies
- **Security**: Rate limiting, input validation, CSRF protection via Helmet
- **User Roles**: Standard users and admin accounts with role-based access control

### Subscription Management
- **Payment Processor**: Stripe integration for subscription billing
- **Plans**: Free (1 document), Standard (10 documents), Premium (100 documents), Admin (unlimited)
- **Features**: Usage tracking, automatic billing, customer portal access

### Document Export System
- **Formats**: PDF, Word (DOCX), HTML, WordPress integration
- **Features**: Professional formatting, brand customization, template system
- **Security**: Watermarking, access controls, expiration dates

### NDA & Security System
- **Built-in NDAs**: Template system with custom agreements
- **Digital Signatures**: PDF signature capabilities with audit trails
- **Access Controls**: Token-based sharing, expiration dates, view tracking
- **Privacy**: IP-based location estimation with VPN detection

## Data Flow

### Document Creation Process
1. User uploads business transcript or provides website URL
2. AI services analyze content and extract business information
3. Structured CIM document is generated with customizable sections
4. User can edit, customize, and add branding elements
5. Document is saved with version history and analytics tracking

### Sharing Workflow
1. User enables sharing and selects NDA requirements
2. System generates secure sharing tokens and URLs
3. Recipients access documents through protected links
4. NDA signing workflow (if required) with digital signatures
5. Access tracking and analytics for document views

### Export Process
1. User selects export format and customization options
2. System generates formatted document with branding
3. Export includes all selected images, logos, and content
4. Delivery via download or direct integration (WordPress)

## External Dependencies

### AI Services
- **Perplexity API**: Primary AI analysis service for content generation
- **OpenAI API**: Secondary AI service for enhanced document analysis
- **Website Analysis**: Automated content extraction and logo detection

### Payment & Communication
- **Stripe**: Payment processing, subscription management, customer portal
- **SendGrid**: Email delivery for NDA notifications and sharing
- **Google APIs**: Optional Google Docs integration and OAuth

### Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit Hosting**: Development and deployment platform
- **CloudRun**: Production deployment target

## Deployment Strategy

### Development Environment
- **Platform**: Replit with hot reloading and development tools
- **Database**: Shared PostgreSQL instance with connection pooling
- **File Storage**: Local filesystem with automatic cleanup

### Production Environment
- **Build Process**: Optimized Vite build with ESBuild backend bundling
- **Deployment**: CloudRun with automatic scaling and health checks
- **Database**: Production PostgreSQL with connection pooling and monitoring
- **Security**: Enhanced rate limiting, security headers, and audit logging

### Environment Configuration
- **Variables**: Secure environment variable management for API keys
- **Secrets**: Encrypted storage for database credentials and signing keys
- **Monitoring**: Health check endpoints and error tracking

## Changelog

- June 17, 2025: Updated homepage live examples to Tony's Transmissions (https://cimshare.com/share/cim-q94wn4) and Arbor Partners (https://cimshare.com/share/cim-wwkz3j) with new preview images
- June 17, 2025: Fixed financials section in CIM generator to start expanded by default instead of collapsed
- June 17, 2025: Enhanced cover image display in edit interface with reactive state updates to show images after document generation
- June 17, 2025: Removed duplicate upload buttons from CIM edit interface - cleaned up left-side "Upload Your Logo" and "Upload Your First Image" buttons while preserving right-side upload functionality
- June 17, 2025: Fixed database connection pool warnings by increasing max listeners to 150 and improving session store initialization to prevent multiple instances
- June 17, 2025: Fixed PDF export layout from share links - website logo now displays on first page (handles base64 data), business images maintain aspect ratios, company logo centered on first page, and added page break before generated content for proper cover page structure
- June 17, 2025: Fixed business images and logos not appearing in PDF exports from share links - replaced PDFKit fit/align parameters with explicit width/height parameters to ensure proper rendering across all PDF viewers
- June 17, 2025: Removed parallax effects, particles, and animations from footer component for cleaner appearance
- June 14, 2025: Fixed business images and logos not displaying in PDF exports from share links - updated image path resolution to check multiple directories including public/business-images, public/logos, and public/images
- June 14, 2025: Fixed deployment health check issues - added proper /health and /api/health endpoints that respond with 200 status before middleware registration
- June 14, 2025: Enhanced server startup with graceful port retry logic to handle EADDRINUSE errors
- June 14, 2025: Improved error handling to prevent startup failures from crashing the application
- June 13, 2025: Fixed share link image serving - base64 images now display correctly on external domains
- June 13, 2025: Enhanced CIM generation error logging for better debugging
- June 13, 2025: Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.