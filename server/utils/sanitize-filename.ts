/**
 * Sanitize a filename to prevent path traversal attacks and remove dangerous characters.
 *
 * This utility should be used whenever handling user-uploaded filenames before:
 * - Storing them in the filesystem
 * - Using them in storage paths
 * - Including them in database records that may be used in file paths
 *
 * @param filename - The original filename from the upload (e.g., file.originalname)
 * @returns A sanitized filename safe for use in file paths
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file';
  }

  // Remove path components (handles both forward and backslashes)
  let sanitized = filename.replace(/^.*[\\\/]/, '');

  // Remove null bytes (can be used to bypass security checks)
  sanitized = sanitized.replace(/\0/g, '');

  // Remove or replace dangerous characters that could cause issues on various filesystems
  // < > : " / \ | ? * are not allowed on Windows
  // Also remove other potentially problematic characters
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');

  // Remove leading/trailing dots and spaces (prevent hidden files, trailing dots on Windows)
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');

  // Replace multiple consecutive underscores/spaces with single underscore
  sanitized = sanitized.replace(/[_\s]+/g, '_');

  // Limit length (max 255 chars is standard for most filesystems)
  // Preserve extension if present
  if (sanitized.length > 255) {
    const lastDotIndex = sanitized.lastIndexOf('.');
    if (lastDotIndex > 0 && lastDotIndex > sanitized.length - 20) {
      // Has a reasonable extension
      const ext = sanitized.slice(lastDotIndex);
      const baseName = sanitized.slice(0, 255 - ext.length);
      sanitized = baseName + ext;
    } else {
      sanitized = sanitized.slice(0, 255);
    }
  }

  // Fallback if empty after sanitization
  if (!sanitized || sanitized === '_') {
    return 'unnamed_file';
  }

  return sanitized;
}

/**
 * Extract the file extension from a filename safely.
 * Sanitizes the extension to prevent injection attacks.
 *
 * @param filename - The original filename
 * @returns A sanitized file extension (including the dot) or empty string
 */
export function sanitizeExtension(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Get the extension using path-like logic
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex < 0 || lastDotIndex === filename.length - 1) {
    return '';
  }

  let ext = filename.slice(lastDotIndex).toLowerCase();

  // Remove any dangerous characters from extension
  ext = ext.replace(/[^a-z0-9.]/gi, '');

  // Ensure it starts with a dot and is reasonable length
  if (!ext.startsWith('.') || ext.length > 20) {
    return '';
  }

  return ext;
}

/**
 * Escape HTML special characters to prevent XSS/HTML injection attacks.
 * Use this when embedding user input into HTML templates (emails, rendered pages, etc.)
 *
 * @param text - The untrusted user input
 * @returns HTML-escaped string safe for embedding in HTML
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
