# AI Models and Document Generation Architecture

This document describes the AI models used in the CIM (Confidential Information Memorandum) generation process and how documents are crafted from user inputs.

## Overview

The application uses a multi-model approach to generate professional business documents, combining user-provided information (transcripts/notes) with website data when available.

---

## AI Models Used

### 1. OpenAI GPT-4o (Primary Document Generation)
- **Model ID:** `gpt-4o`
- **Purpose:** Main CIM document generation
- **Why this model:** High-quality generation with rich, elaborate content. Produces professional business writing that transforms facts into compelling narrative.
- **Temperature:** `0.05` (very low for factual accuracy)
- **Max Tokens:** 8000 (allows for comprehensive, detailed documents)
- **Configuration Location:** `server/perplexity.ts:428`

### 2. OpenAI GPT-4o-mini-search-preview (Website Analysis)
- **Model ID:** `gpt-4o-mini-search-preview`
- **Purpose:** Crawling and extracting business information from company websites
- **Why this model:** Includes web search capabilities to analyze live website content
- **Search Context:** `high` (comprehensive website analysis)
- **Configuration Location:** `server/perplexity.ts:181`

### 3. Perplexity Sonar-Pro (Legacy CIM Analysis)
- **Model ID:** `sonar-pro`
- **Purpose:** Legacy transcript analysis with real-time search capabilities
- **Temperature:** `0.05`
- **Configuration Location:** `server/perplexity.ts:660`, `server/website-analyzer.ts:634`

---

## Document Generation Flow

### Step 1: Parallel Operations Initialization
When a user submits a document generation request, the system starts **three operations in parallel** to optimize performance:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Submits Request                      │
│           (transcript/notes + optional website URL)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │   Website    │ │     Logo     │ │    Image     │
   │   Crawling   │ │  Extraction  │ │  Extraction  │
   │  (OpenAI)    │ │   (HTML)     │ │   (HTML)     │
   └──────────────┘ └──────────────┘ └──────────────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                           ▼
               ┌──────────────────────┐
               │   CIM Generation     │
               │     (OpenAI)         │
               └──────────────────────┘
```

### Step 2: Data Source Integration
The AI is instructed to blend two data sources:

1. **PRIMARY: User's Transcript/Notes**
   - First-hand details from the business owner
   - Takes precedence in case of conflicts
   - Must always be included prominently

2. **SUPPLEMENTARY: Website Analysis Data**
   - Company history, services, team information
   - Adds context and enriches the document
   - Never replaces user-provided information

### Step 3: Document Structure Generation
The AI generates a flexible JSON structure containing:
- Document title and company name
- Ordered sections with rich HTML content
- Metadata (purpose, tone, audience, word count)

---

## Anti-Hallucination Safeguards

The system employs strict anti-hallucination rules:

1. Only use facts explicitly stated in the provided data sources
2. Never invent numbers, dates, names, locations, or specific details
3. Never make up case studies, examples, or scenarios
4. Do not add industry statistics unless explicitly provided
5. Use qualified language when data is limited ("based on available information")
6. Every statistic must be traceable to the source

---

## Formatting Profiles

Documents can be generated with different formatting profiles:

| Profile | Description |
|---------|-------------|
| `concise` | Brief, to-the-point content |
| `professional` | Standard business language |
| `detailed` | Comprehensive with extensive details |
| `formal` | Traditional, authoritative tone |
| `casual` | Conversational but professional |

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `server/perplexity.ts` | Main AI integration, document generation |
| `server/website-analyzer.ts` | Website crawling, logo extraction |
| `server/routes.ts` | API endpoints, parallel execution orchestration |
| `shared/formatting-config.ts` | Formatting profiles and instructions |

---

## Performance Optimizations

### Parallel Execution (Latest Update)
- Website crawling, logo extraction, and image extraction now run **in parallel** from the start
- Previously, website crawling happened sequentially inside CIM generation
- Logo extraction happened after CIM was generated
- New flow: All operations start immediately, CIM generation uses pre-fetched website data

### Timing Benefits
```
Before: Website Crawl (5s) → CIM Generation (10s) → Logo Extract (2s) = 17s total
After:  Website Crawl ─────┐
        Logo Extract  ─────┼→ CIM Generation (10s) → Final = ~12s total
        Image Extract ─────┘
```

---

## API Endpoints for Document Generation

### POST `/api/cim/generate`
Main endpoint for creating new CIM documents or regenerating existing ones.

**Request Body:**
```json
{
  "transcript": "User's notes or transcript...",
  "directions": "Custom style directions...",
  "purpose": "business_overview | equity_raise",
  "tone": "concise | professional | detailed",
  "audience": "investors | colleagues | friends",
  "websiteUrl": "https://example.com",
  "financials": { "enabled": true, "revenue": "..." },
  "sectionDirections": [{ "id": "...", "content": "..." }]
}
```

### POST `/api/cim/upload`
Endpoint for file-based document creation (handles file uploads).

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API access for GPT-4o-mini models |
| `PERPLEXITY_API_KEY` | Perplexity API access for legacy features |

---

## Monitoring System

A comprehensive monitoring system is in place to detect issues with AI model availability and CIM generation:

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/monitoring/health/cim` | Check CIM generation specifically |
| `GET /api/monitoring/health/openai` | Check OpenAI API health |
| `GET /api/monitoring/health/comprehensive` | Full system health check |
| `GET /api/monitoring/health/quick` | Quick check of critical services |

### Running Manual Health Checks

```bash
# Run comprehensive health check
npx tsx scripts/run-health-check.ts

# Run quick check only
npx tsx scripts/run-health-check.ts --quick

# Output as JSON
npx tsx scripts/run-health-check.ts --json

# Send email alerts
ALERT_EMAIL=admin@example.com npx tsx scripts/run-health-check.ts --alert-email
```

### Background Monitoring

Start the scheduler via API:
```bash
curl -X POST http://localhost:5000/api/monitoring/scheduler/start \
  -H "x-monitoring-token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alertEmail": "admin@example.com"}'
```

---

## Future Considerations

1. **Model Upgrades:** As newer models become available, consider upgrading from `gpt-4o-mini` to more advanced versions for improved quality.
2. **Caching:** Website analysis results could be cached to avoid redundant API calls for the same URL.
3. **Streaming:** Implement streaming responses for real-time document generation feedback.
