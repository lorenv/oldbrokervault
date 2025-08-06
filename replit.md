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
### Website Crawler Feature Implementation
- **Issue Fixed**: Updated deprecated Perplexity model from `llama-3.1-sonar-small-128k-online` to `sonar-pro`
- **Website Analysis**: Fully functional real-time analysis of company websites during CIM generation
- **URL Handling**: Robust support for various URL formats (with/without protocol, with/without www)
- **User Control**: Optional website analysis toggle with progress tracking
- **Data Integration**: Website data intelligently merged with user transcripts, with transcript taking precedence
- **Progress Tracking**: Added "Analyzing website content" stage to generation progress

### Subscription Security Enhancement
- **Critical Fix**: Closed subscription bypass loophole where users could delete and recreate documents to exceed limits
- **Root Cause**: Document limit validation used database count instead of monthly counter, allowing deletion bypass
- **Solution**: Modified `checkUserLimit()` to use `monthlyDocumentsCreated` counter consistently
- **Security Impact**: Users can no longer circumvent subscription limits through document deletion
- **Billing Integrity**: Monthly counters track total documents created per month regardless of deletions