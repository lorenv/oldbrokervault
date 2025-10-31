# SDE Analyzer - Anthropic API Implementation Documentation

## Overview

The SDE (Seller's Discretionary Earnings) Analyzer is a feature that allows users to upload Excel financial documents and receive AI-generated SDE sheets with comprehensive financial analysis. The feature uses Anthropic's Claude API with custom skills and code execution capabilities.

---

## Architecture

### Components

1. **Frontend**: `client/src/pages/sde-analyzer-page.tsx`
   - File upload interface with drag-and-drop
   - Analysis history viewer
   - Usage tracking display

2. **Backend Routes**: `server/routes/sde-analyzer-routes.ts`
   - `/api/sde-analyzer/upload` - Upload Excel files
   - `/api/sde-analyzer/list` - Get user's analysis history
   - `/api/sde-analyzer/download/:id` - Download result files
   - `/api/sde-analyzer/status/:id` - Check analysis status
   - `/api/sde-analyzer/usage` - Get user's usage stats
   - `DELETE /api/sde-analyzer/:id` - Delete an analysis

3. **Service Layer**: `server/sde-analyzer.ts`
   - Anthropic API integration
   - File upload/download to Claude Files API
   - Skills invocation and processing
   - Result file management

4. **Database**: `shared/schema.ts` - `sdeAnalyses` table
   - Tracks analysis status, file paths, metadata

5. **Storage**: Object storage for original and result files
   - Original files: `sde-originals/user-{userId}/{timestamp}-{filename}`
   - Result files: `sde-results/user-{userId}/{timestamp}-{filename}`

---

## Anthropic API Integration

### SDK Version

- **Package**: `@anthropic-ai/sdk`
- **Version**: `0.68.0` (minimum)
- **Required**: The Files API and Skills API are in beta, requires SDK 0.68.0+

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...              # Required for SDE Analyzer
ANTHROPIC_SKILL_ID=skill_01AbCd...        # Required: Your custom skill ID
ANTHROPIC_SKILL_VERSION=latest            # Optional: defaults to 'latest'
```

**Important**: `ANTHROPIC_SKILL_ID` must be the actual skill ID (starts with `skill_`), NOT the skill name.

#### How to Find Your Skill ID

Run the helper script to list all your skills and their IDs:

```bash
npx tsx server/list-skills.ts
```

This will output all your skills with their IDs. Look for your SDE analyzer skill and copy its ID (e.g., `skill_01AbCdEfGhIjKlMnOpQrStUv`).

Alternatively, you can use the Anthropic API directly:

```typescript
const skills = await client.beta.skills.list({
  source: 'custom',
  betas: ['skills-2025-10-02']
});
console.log(skills.data);
```

### API Initialization

The Anthropic SDK is lazily initialized to prevent app crashes on startup if the API key is missing:

```typescript
let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === '') {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for SDE Analyzer');
    }

    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    logger.info('Anthropic SDK initialized successfully');
  }

  return anthropic;
}
```

---

## File Upload Process

### 1. Upload Excel to Object Storage

User uploads Excel file → Multer processes → Store in object storage → Create DB record

**File Limits**:
- Max size: 8MB
- Allowed types: `.xls`, `.xlsx`
- MIME types: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### 2. Upload to Claude Files API

```typescript
async uploadToClaudeFiles(fileBuffer: Buffer, filename: string): Promise<string> {
  const client = getAnthropicClient();

  // Create File object from buffer
  const file = new File([fileBuffer], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  // Upload to Files API (beta)
  const uploadResponse = await client.beta.files.upload({
    file: file,
    purpose: 'batch'
  });

  return uploadResponse.id; // Returns file_id like "file_01AbCd..."
}
```

**Key Points**:
- Uses `client.beta.files.upload()` (not `client.files.upload()`)
- Returns a `file_id` that can be referenced in API calls
- Files API beta header: `files-api-2025-04-14`

---

## Skills Integration

### Custom Skill Configuration

```typescript
// Must use actual skill ID (skill_xxx...) from environment variable
const SKILL_ID = process.env.ANTHROPIC_SKILL_ID || '';
const SKILL_VERSION = process.env.ANTHROPIC_SKILL_VERSION || 'latest';
```

**Critical**: The `SKILL_ID` must be the actual skill ID (e.g., `skill_01AbCdEfGhIjKlMnOpQrStUv`), not the skill name like `analyzing-sde-financials`.

**Where to find it**: Use `npx tsx server/list-skills.ts` to list all your skills and get their IDs.

### API Call Structure

```typescript
const message = await client.beta.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8192,

  // Required beta headers
  betas: [
    'code-execution-2025-08-25',  // Enables code execution
    'skills-2025-10-02',           // Enables Skills API
    'files-api-2025-04-14'         // Enables Files API
  ],

  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'file',
            file_id: fileId  // Reference uploaded file
          }
        },
        {
          type: 'text',
          text: 'Analyze this Excel document and generate an SDE Sheet...'
        }
      ]
    }
  ],

  // Code execution tool (required for skills)
  tools: [
    {
      type: 'code_execution_20250825',
      name: 'code_execution'
    }
  ],

  // Custom skill configuration
  container: {
    skills: [
      {
        type: 'custom',  // 'custom' for user skills, 'anthropic' for pre-built
        skill_id: SKILL_ID,
        version: SKILL_VERSION
      }
    ]
  }
});
```

**Critical Points**:
- MUST use `client.beta.messages.create()` (not `client.messages.create()`)
- `container` is a TOP-LEVEL parameter (sibling to `messages`, `tools`)
- `tools` array must include code execution tool
- File is attached via `document` content block with `file_id`
- Can include up to 8 skills per request

---

## Response Handling

### Extracting Result File

```typescript
let resultFileId: string | null = null;

// Look for file outputs in the response
if (message.content && Array.isArray(message.content)) {
  for (const block of message.content) {
    // Check for tool use blocks with file outputs
    if ('type' in block && block.type === 'tool_use' && 'output' in block) {
      const output = block.output as any;
      if (output?.file_id) {
        resultFileId = output.file_id;
        logger.info(`Found result file ID: ${resultFileId}`);
        break;
      }
    }
  }
}
```

### Downloading Result Files

```typescript
async downloadResultFile(fileId: string): Promise<{ buffer: Buffer; filename: string }> {
  const client = getAnthropicClient();

  // Get file metadata
  const fileMetadata = await client.beta.files.retrieve(fileId);

  // Download file content
  const fileContent = await client.beta.files.content(fileId);

  // Convert to Buffer
  const arrayBuffer = await fileContent.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    filename: fileMetadata.filename || `SDE_Sheet_${Date.now()}.xlsx`
  };
}
```

**Key Points**:
- Use `client.beta.files.retrieve()` for metadata
- Use `client.beta.files.content()` for file content
- Convert response to Buffer for storage

---

## Database Schema

```typescript
// sdeAnalyses table
{
  id: number;
  userId: number;
  originalFilename: string;
  originalFilePath: string;      // Object storage path
  originalFileSize: number;
  originalMimeType: string;
  claudeFileId: string | null;   // File ID from Claude Files API
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  resultFilename: string | null;
  resultFilePath: string | null;  // Object storage path
  resultFileSize: number | null;
  claudeResultFileId: string | null;
  claudeRequestId: string | null;
  processingStartedAt: timestamp | null;
  completedAt: timestamp | null;
  expiresAt: timestamp | null;    // 30 days from completion
  processingTimeSeconds: number | null;
  downloadCount: number;
  lastDownloadedAt: timestamp | null;
  createdAt: timestamp;
}
```

---

## Usage Limits

Configured by subscription tier in `sdeAnalyzerService.getSdeAnalysisLimit()`:

```typescript
free: 0           // Feature locked
starter: 5        // 5 analyses per month
pro: 15           // 15 analyses per month
enterprise: ∞     // Unlimited
```

Monthly counts stored in `users.monthlySdeAnalyses` field.

---

## Processing Flow

1. **User uploads Excel file**
   - Frontend validates file type and size
   - POST `/api/sde-analyzer/upload`

2. **Backend processes upload**
   - Check user subscription and limits
   - Store file in object storage
   - Create DB record with `status: 'pending'`
   - Increment user's monthly count
   - Return success response

3. **Background processing** (triggered separately)
   - Read file from object storage
   - Upload to Claude Files API → get `file_id`
   - Update DB: `status: 'processing'`, store `claudeFileId`
   - Invoke Claude with skill → get response
   - Extract result `file_id` from response
   - Download result from Claude Files API
   - Store result in object storage
   - Update DB: `status: 'completed'`, store paths and metadata
   - Set expiration date (30 days)

4. **User downloads result**
   - GET `/api/sde-analyzer/download/:id`
   - Verify file not expired
   - Stream file from object storage
   - Increment download count

---

## Error Handling

### User-Facing Error Messages

All errors now use generic "AI service" terminology instead of mentioning Claude specifically:

```typescript
throw new Error(
  `Failed to upload file to AI service. If this issue persists, please contact support@cimshare.com. Error: ${error.message}`
);
```

### Common Errors

1. **`Cannot read properties of undefined (reading 'create')`**
   - Cause: Using `client.files` instead of `client.beta.files`
   - Fix: Always use beta endpoints for Files API

2. **`tools.0: Input tag 'X' found using 'type' does not match expected tags`**
   - Cause: Using regular endpoint instead of beta endpoint
   - Fix: Use `client.beta.messages.create()` for skills

3. **`ANTHROPIC_API_KEY environment variable is required`**
   - Cause: API key not set in environment
   - Fix: Add to Repl Secrets or .env file

4. **File upload fails**
   - Check file size (max 8MB)
   - Verify file type (.xls or .xlsx)
   - Ensure API key is valid

---

## Testing & Debugging

### Enable Debug Logging

The service logs all major operations:

```typescript
logger.info(`Uploading file to AI service: ${filename}`);
logger.info(`File uploaded successfully. File ID: ${fileId}`);
logger.info(`Invoking SDE skill for analysis ID: ${analysisId}`);
logger.error('Error uploading file to AI service:', error);
```

### Manual Testing

1. Check SDK is initialized:
   ```javascript
   import Anthropic from '@anthropic-ai/sdk';
   const client = new Anthropic({ apiKey: 'test' });
   console.log('Has beta.files:', !!client.beta?.files);
   ```

2. Test file upload to Claude:
   ```typescript
   const file = new File([buffer], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
   const result = await client.beta.files.upload({ file, purpose: 'batch' });
   console.log('File ID:', result.id);
   ```

---

## Current Status

### ✅ Implemented
- File upload to object storage
- Upload to Claude Files API (beta)
- Skills configuration with container parameter
- File attachment via document content blocks
- Beta endpoint usage (`client.beta.messages.create()`)
- Error handling with generic messages
- Result file download from Claude
- 30-day file retention with expiration tracking

### 🚧 In Progress
- Testing complete end-to-end flow
- Verifying skill execution and result extraction
- Background job processing (currently manual trigger)

### 📋 TODO
- Implement automated background processing (job queue)
- Email notifications when analysis completes
- Add retry logic for failed analyses
- Implement file cleanup for expired files
- Add monitoring and analytics

---

## API Reference

### Anthropic Beta APIs Used

1. **Files Upload**: `client.beta.files.upload({ file, purpose })`
2. **Files Retrieve**: `client.beta.files.retrieve(fileId)`
3. **Files Content**: `client.beta.files.content(fileId)`
4. **Messages Create**: `client.beta.messages.create({ model, betas, container, ... })`

### Required Beta Headers

```typescript
betas: [
  'code-execution-2025-08-25',  // Code execution tool
  'skills-2025-10-02',           // Skills API
  'files-api-2025-04-14'         // Files API
]
```

---

## Troubleshooting Guide

### Server won't start
- Check if `ANTHROPIC_API_KEY` is set (won't crash anymore, but feature won't work)
- Verify SDK version is 0.68.0 or higher: `npm ls @anthropic-ai/sdk`

### Upload fails immediately
- Check file size and type restrictions
- Verify user has remaining analyses in their quota
- Check user subscription status (not 'free')

### Files API errors
- Ensure using `client.beta.files.*` not `client.files.*`
- Verify Files API beta header is included

### Skills/Container errors
- Must use `client.beta.messages.create()` not `client.messages.create()`
- Verify `container` is top-level parameter, not nested in `tools`
- **"Skill not found" error**: You're using the skill name instead of skill ID
  - ❌ Wrong: `skill_id: 'analyzing-sde-financials'`
  - ✅ Correct: `skill_id: 'skill_01AbCdEfGhIjKlMnOpQrStUv'`
  - Run `npx tsx server/list-skills.ts` to get the correct ID
- Ensure code execution tool is in tools array
- Verify skill exists in your Anthropic workspace (check at https://claude.ai/skills)

### File not found after processing
- Check if file expired (30 days)
- Verify file exists in object storage
- Check `resultFilePath` in database

---

## Resources

- [Anthropic Skills Documentation](https://docs.claude.com/en/api/skills-guide)
- [Files API Documentation](https://docs.claude.com/en/docs/build-with-claude/files)
- [Code Execution Tool](https://docs.claude.com/en/docs/agents-and-tools/tool-use/code-execution-tool)
- [TypeScript SDK Reference](https://docs.claude.com/en/docs/claude-code/sdk/sdk-typescript)
- [Skills Repository](https://github.com/anthropics/skills)

---

## Version History

### 2025-10-31
- Initial implementation
- Configured Anthropic SDK v0.68.0
- Set up Files API integration (beta)
- Implemented Skills API with custom skill
- Added document content blocks for file attachment
- Migrated to beta endpoints for all features
- Updated error messages to be generic (AI service)
- Added support email contact for persistent errors
- Fixed skill ID configuration (must use actual ID, not name)
- Added helper script to list skills (`server/list-skills.ts`)
- Made skill ID configurable via environment variables

---

## Notes

- **File retention**: Results are kept for 30 days, then marked as expired
- **Download tracking**: Each download increments `downloadCount`
- **Usage tracking**: Monthly limits reset based on billing cycle
- **Skill execution**: Happens in sandboxed container with code execution
- **File size limit**: 8MB (Claude Files API limit)
- **Cost**: Code execution costs $0.05/hour after 50 free hours/day per org
