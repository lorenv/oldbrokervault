import DOMPurify from 'dompurify';

// Ensure DOMPurify is properly initialized for browser environment
const purify = typeof window !== 'undefined' ? DOMPurify(window) : DOMPurify;

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this whenever rendering user-generated or database-stored HTML content
 */
export function sanitizeHtml(dirty: string | undefined | null): string {
  if (!dirty) return '';

  return purify.sanitize(dirty, {
    // Allow safe HTML tags for rich text content
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'span', 'div', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'sup', 'sub', 'hr'
    ],
    // Allow safe attributes
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style',
      'width', 'height', 'colspan', 'rowspan'
    ],
    // Force links to open in new tab safely
    ADD_ATTR: ['target', 'rel'],
    // Sanitize URLs
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Sanitize HTML for display in a simple text context (strips all HTML)
 */
export function stripHtml(dirty: string | undefined | null): string {
  if (!dirty) return '';
  return purify.sanitize(dirty, { ALLOWED_TAGS: [] });
}

/**
 * Create a safe dangerouslySetInnerHTML object
 * Usage: <div {...safeHtml(content)} />
 */
export function safeHtml(dirty: string | undefined | null): { dangerouslySetInnerHTML: { __html: string } } {
  return { dangerouslySetInnerHTML: { __html: sanitizeHtml(dirty) } };
}
