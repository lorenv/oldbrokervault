-- Add support_tickets table for user feedback and bug reports

CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER,
  user_id INTEGER NOT NULL,

  type TEXT NOT NULL DEFAULT 'bug',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,

  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,

  status TEXT NOT NULL DEFAULT 'open',

  browser_info TEXT,
  page_url TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets (user_id);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status);
