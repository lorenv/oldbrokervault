-- Create role_permissions table for customizable role-based access control
-- This table stores permission overrides for admin and member roles
-- Owner and viewer permissions are locked and not stored here

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    permission_key TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    granted BOOLEAN NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_org_role
ON role_permissions (organization_id, role);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_unique
ON role_permissions (organization_id, permission_key, role);
