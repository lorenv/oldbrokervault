-- SDE Analyzer table for tracking financial analysis jobs
CREATE TABLE IF NOT EXISTS sde_analyses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Original uploaded file
  original_filename TEXT NOT NULL,
  original_file_path TEXT NOT NULL,
  original_file_size INTEGER NOT NULL,
  original_mime_type TEXT NOT NULL,

  -- Result file (generated SDE Sheet)
  result_filename TEXT,
  result_file_path TEXT,
  result_file_size INTEGER,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  processing_started_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP, -- 30 days from completion

  -- Claude API metadata
  claude_file_id TEXT, -- File ID from Claude Files API
  claude_result_file_id TEXT, -- Result file ID from Claude
  claude_request_id TEXT,
  processing_time_seconds INTEGER,

  -- Tracking
  download_count INTEGER DEFAULT 0 NOT NULL,
  last_downloaded_at TIMESTAMP
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sde_analyses_user_id ON sde_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_sde_analyses_status ON sde_analyses(status);
CREATE INDEX IF NOT EXISTS idx_sde_analyses_created_at ON sde_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sde_analyses_expires_at ON sde_analyses(expires_at) WHERE expires_at IS NOT NULL;

-- Add monthly usage tracking for rate limiting
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_sde_analyses INTEGER DEFAULT 0 NOT NULL;
