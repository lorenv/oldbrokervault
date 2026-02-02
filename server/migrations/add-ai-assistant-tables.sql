-- AI Assistant tables for token tracking and chat history

-- Token usage tracking (for monthly caps)
CREATE TABLE IF NOT EXISTS ai_token_usage (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,

  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,

  model TEXT NOT NULL,

  period_start TEXT NOT NULL, -- Format: YYYY-MM

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chat message history
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,

  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,

  tokens_used INTEGER,

  feedback TEXT, -- 'positive', 'negative', or null

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_org_period ON ai_token_usage (organization_id, period_start);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_org_user ON ai_chat_messages (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created ON ai_chat_messages (created_at DESC);
