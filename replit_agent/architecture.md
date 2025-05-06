# Architecture Overview

## Overview

This repository contains a full-stack web application built with React and Express, designed for generating Confidential Information Memorandums (CIMs) for businesses. The application follows a modern stack architecture with TypeScript throughout and uses PostgreSQL (via Neon's serverless offering) for data persistence.

The application features user authentication, subscription management via Stripe, document generation using AI services (OpenAI and Perplexity), and various export options including PDF, Word, HTML, and Google Docs integration.

## System Architecture

The system follows a client-server architecture with a clear separation between frontend and backend:

```
├── client/         # React frontend application
├── server/         # Express backend server
└── shared/         # Shared code between client and server
```

### Frontend Architecture

The frontend is built with React, Vite for bundling, and uses TypeScript for type safety. The UI is styled with Tailwind CSS and uses the Shadcn UI component library as a foundation for reusable components.

Key frontend patterns:
- React Query for data fetching and state management
- React Hook Form for form handling
- Wouter for routing (lightweight alternative to React Router)
- Context API for auth state management

### Backend Architecture

The backend is built with Express, TypeScript, and uses Drizzle ORM for database interactions with PostgreSQL. The API follows RESTful principles and includes authentication middleware using Passport.js.

Key backend services:
- Auth service (session-based authentication)
- Storage service (database operations)
- Document generation (using AI services)
- Export service (supporting multiple formats)
- Payment service (Stripe integration)

### Data Storage

The application uses PostgreSQL via Neon's serverless offering for data persistence. The database schema is defined using Drizzle ORM with support for migrations.

Key schemas:
- Users (authentication, subscription management)
- CIM Documents (storing generated documents)

## Key Components

### Authentication System

The application implements a session-based authentication system using:
- Passport.js for authentication middleware
- Express-session for session management
- Password hashing with scrypt for security
- PostgreSQL session store for persistence

### Subscription Management

The application integrates with Stripe for subscription management:
- Tiered subscription plans (Free, Standard, Premium, Admin)
- Usage limits based on subscription tier
- Webhook handling for subscription events
- Customer portal for subscription management

### CIM Generator

The core functionality of the application is generating CIM documents:
- AI-powered analysis using OpenAI and Perplexity APIs
- Form-based interface for input collection
- Structured output for business information

### Document Export

The application supports multiple export formats:
- HTML with styled formatting
- PDF generation using PDFKit
- Word document export using docx library
- Google Docs integration via Google Drive API
- WordPress export capability

## Data Flow

1. **User Authentication**
   - Users register/login through the auth endpoints
   - Sessions are maintained with cookies
   - Protected routes check authentication status

2. **Document Generation**
   - User submits business information
   - Backend validates subscription status and limits
   - AI services analyze and structure the information
   - Structured data is stored in the database
   - Results returned to frontend for display

3. **Document Export**
   - User selects an export format
   - Backend retrieves document data
   - Export service generates the requested format
   - File is served to the client or uploaded to external service
   - Usage metrics are updated in the database

4. **Subscription Management**
   - User selects a subscription plan
   - Stripe Checkout session is created
   - User completes payment on Stripe-hosted page
   - Webhook receives successful payment event
   - User subscription status is updated in database

## External Dependencies

### Core Dependencies
- **PostgreSQL**: Main database (via Neon serverless)
- **Drizzle ORM**: Database schema definition and queries
- **React**: Frontend UI library
- **Express**: Backend API framework
- **TypeScript**: Type safety across codebase

### External APIs
- **OpenAI API**: For AI-powered document generation
- **Perplexity API**: Alternative AI service for document generation
- **Stripe API**: Payment processing and subscription management
- **Google APIs**: Google Drive and Docs integration
- **WordPress API**: For exporting to WordPress sites

### UI Components
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn UI**: Component library built on Radix UI
- **Lucide Icons**: Icon library

## Deployment Strategy

The application is configured for deployment on Replit's platform:

- **Development**: Uses Replit's development environment with hot reloading
- **Production**: Built with Vite (frontend) and esbuild (backend)
- **Database**: Connects to Neon PostgreSQL via environment variables
- **Environment**: Configuration through environment variables

The deployment process involves:
1. Building the frontend with Vite
2. Bundling the backend with esbuild
3. Starting the production server to serve both API and static files

The application is designed to run within a single process where the Express server also serves the static frontend files.

## Security Considerations

- **Authentication**: Password hashing with scrypt and random salts
- **Sessions**: Secure sessions with PostgreSQL storage
- **API Access**: Protected routes requiring authentication
- **Payment Information**: Handled exclusively through Stripe Checkout (no payment info stored)
- **Rate Limiting**: Usage limits enforced based on subscription tier