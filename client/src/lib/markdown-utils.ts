/**
 * Utility functions for markdown processing with backslash escaping support
 */

/**
 * Processes markdown text to handle backslash escaping
 * Allows users to escape markdown characters with backslashes
 */
export function processMarkdownWithEscaping(text: string): string {
  if (!text) return text;
  
  // Replace escaped markdown characters with temporary placeholders
  const escapedReplacements: Record<string, string> = {
    '\\*': '___ESCAPED_ASTERISK___',
    '\\_': '___ESCAPED_UNDERSCORE___',
    '\\#': '___ESCAPED_HASH___',
    '\\[': '___ESCAPED_BRACKET_OPEN___',
    '\\]': '___ESCAPED_BRACKET_CLOSE___',
    '\\(': '___ESCAPED_PAREN_OPEN___',
    '\\)': '___ESCAPED_PAREN_CLOSE___',
    '\\`': '___ESCAPED_BACKTICK___',
    '\\~': '___ESCAPED_TILDE___',
    '\\|': '___ESCAPED_PIPE___',
    '\\-': '___ESCAPED_DASH___',
    '\\+': '___ESCAPED_PLUS___',
    '\\.': '___ESCAPED_DOT___',
    '\\!': '___ESCAPED_EXCLAMATION___',
    '\\\\': '___ESCAPED_BACKSLASH___'
  };
  
  let processedText = text;
  
  // Replace escaped characters with placeholders
  Object.entries(escapedReplacements).forEach(([escaped, placeholder]) => {
    processedText = processedText.replace(new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder);
  });
  
  return processedText;
}

/**
 * Restores escaped characters after markdown processing
 */
export function restoreEscapedCharacters(text: string): string {
  if (!text) return text;
  
  const restorations: Record<string, string> = {
    '___ESCAPED_ASTERISK___': '*',
    '___ESCAPED_UNDERSCORE___': '_',
    '___ESCAPED_HASH___': '#',
    '___ESCAPED_BRACKET_OPEN___': '[',
    '___ESCAPED_BRACKET_CLOSE___': ']',
    '___ESCAPED_PAREN_OPEN___': '(',
    '___ESCAPED_PAREN_CLOSE___': ')',
    '___ESCAPED_BACKTICK___': '`',
    '___ESCAPED_TILDE___': '~',
    '___ESCAPED_PIPE___': '|',
    '___ESCAPED_DASH___': '-',
    '___ESCAPED_PLUS___': '+',
    '___ESCAPED_DOT___': '.',
    '___ESCAPED_EXCLAMATION___': '!',
    '___ESCAPED_BACKSLASH___': '\\'
  };
  
  let restoredText = text;
  
  Object.entries(restorations).forEach(([placeholder, original]) => {
    restoredText = restoredText.replace(new RegExp(placeholder, 'g'), original);
  });
  
  return restoredText;
}