-- Create Integration Connections table
CREATE TABLE IF NOT EXISTS integration_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,

  -- Provider identification
  provider TEXT NOT NULL,
  provider_account_id TEXT,
  provider_account_name TEXT,

  -- OAuth credentials (encrypted)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP,
  scopes TEXT[],

  -- For webhook-based integrations
  webhook_url TEXT,
  webhook_secret TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active',
  last_used_at TIMESTAMP,
  last_error TEXT,
  error_count INTEGER DEFAULT 0 NOT NULL,

  -- Metadata
  settings JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create Integration Automations table
CREATE TABLE IF NOT EXISTS integration_automations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  connection_id INTEGER,

  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Trigger configuration
  trigger_event TEXT NOT NULL,
  trigger_condition JSONB,

  -- Destination configuration
  destination_type TEXT NOT NULL,
  destination_config JSONB NOT NULL,

  -- Behavior configuration
  behavior TEXT DEFAULT 'upsert',
  match_field TEXT,

  -- Field mappings
  field_mappings JSONB DEFAULT '[]' NOT NULL,

  -- File attachment config
  include_file BOOLEAN DEFAULT false NOT NULL,
  file_source TEXT,
  file_destination TEXT,

  -- Statistics
  total_runs INTEGER DEFAULT 0 NOT NULL,
  successful_runs INTEGER DEFAULT 0 NOT NULL,
  failed_runs INTEGER DEFAULT 0 NOT NULL,
  last_run_at TIMESTAMP,
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create Integration Automation Runs table
CREATE TABLE IF NOT EXISTS integration_automation_runs (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER NOT NULL,
  connection_id INTEGER,

  -- Event that triggered this run
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_payload JSONB NOT NULL,

  -- Execution details
  status TEXT NOT NULL DEFAULT 'pending',
  skipped_reason TEXT,

  -- Request/Response details
  request_payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,

  -- External references
  external_id TEXT,
  external_url TEXT,

  -- File handling
  file_uploaded BOOLEAN DEFAULT false NOT NULL,
  file_name TEXT,
  file_size INTEGER,

  -- Retry tracking
  attempt_count INTEGER DEFAULT 0 NOT NULL,
  next_retry_at TIMESTAMP,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_integration_connections_user_id ON integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON integration_connections(provider);
CREATE INDEX IF NOT EXISTS idx_integration_automations_user_id ON integration_automations(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_automations_connection_id ON integration_automations(connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_automations_trigger_event ON integration_automations(trigger_event);
CREATE INDEX IF NOT EXISTS idx_integration_automation_runs_automation_id ON integration_automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_integration_automation_runs_status ON integration_automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_integration_automation_runs_created_at ON integration_automation_runs(created_at);
