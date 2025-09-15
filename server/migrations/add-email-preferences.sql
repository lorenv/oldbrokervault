-- Add email preferences and unsubscribe token columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_preferences jsonb DEFAULT '{"onboarding": true, "marketing": true, "transactional": true}'::jsonb,
ADD COLUMN IF NOT EXISTS unsubscribe_token text,
ADD COLUMN IF NOT EXISTS unsubscribe_token_expiry timestamp;

-- Create index on unsubscribe_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_unsubscribe_token ON users(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.email_preferences IS 'User email subscription preferences for different email types';
COMMENT ON COLUMN users.unsubscribe_token IS 'Token for unsubscribe link validation';
COMMENT ON COLUMN users.unsubscribe_token_expiry IS 'Expiry timestamp for unsubscribe token';