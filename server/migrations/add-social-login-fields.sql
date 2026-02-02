-- Add OAuth provider fields for social login (Google, Microsoft)

-- Google OAuth ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- Microsoft OAuth ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_id TEXT UNIQUE;

-- Auth provider tracking (local, google, microsoft)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'local';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_microsoft_id ON users (microsoft_id) WHERE microsoft_id IS NOT NULL;
