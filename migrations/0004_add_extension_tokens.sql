-- Create extension_tokens table for Chrome extension authentication
CREATE TABLE IF NOT EXISTS extension_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  organization_id INTEGER,
  token TEXT NOT NULL UNIQUE,
  device_info TEXT,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  revoked_at TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS extension_tokens_user_id_idx ON extension_tokens(user_id);
CREATE INDEX IF NOT EXISTS extension_tokens_token_idx ON extension_tokens(token);
