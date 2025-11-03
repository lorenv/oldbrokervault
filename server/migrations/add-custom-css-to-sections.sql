-- Add custom_css column to custom_sections table for HTML sections
ALTER TABLE custom_sections
ADD COLUMN IF NOT EXISTS custom_css text;

-- Add comment for documentation
COMMENT ON COLUMN custom_sections.custom_css IS 'Optional CSS styling for HTML sections';
