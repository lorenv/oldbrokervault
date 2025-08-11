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