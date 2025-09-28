-- Migration to add copyMeOnEmails column to cim_documents table
ALTER TABLE cim_documents
ADD COLUMN IF NOT EXISTS copy_me_on_emails BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN cim_documents.copy_me_on_emails IS 'When enabled, the document owner will be CCd on all emails sent to NDA signers';