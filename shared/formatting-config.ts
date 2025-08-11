/**
 * Centralized formatting configuration for AI-generated content
 * This allows us to dynamically control formatting styles and HTML output
 * based on user preferences and document types.
 */

export type FormattingProfile = 'professional' | 'memo' | 'robust' | 'balanced' | 'conversational';

export interface FormattingConfig {
  // Basic HTML elements support
  bold: boolean;
  italic: boolean;
  underline: boolean;
  
  // List support
  bulletLists: boolean;
  orderedLists: boolean;
  
  // Table support
  tables: boolean;
  
  // Paragraph structure
  paragraphs: boolean;
  
  // Additional formatting
  headings: boolean;
  blockquotes: boolean;
  
  // HTML output configuration
  htmlTags: {
    bold: string;
    italic: string;
    underline: string;
    paragraph: string;
    bulletListContainer: string;
    bulletListItem: string;
    orderedListContainer: string;
    orderedListItem: string;
    table: string;
    tableRow: string;
    tableCell: string;
    tableHeader: string;
    heading1: string;
    heading2: string;
    heading3: string;
    blockquote: string;
  };
  
  // Style-specific instructions for AI
  aiInstructions: {
    structure: string;
    emphasis: string;
    lists: string;
    tables: string;
    tone: string;
  };
}

// Predefined formatting profiles
export const FORMATTING_PROFILES: Record<FormattingProfile, FormattingConfig> = {
  professional: {
    bold: true,
    italic: true,
    underline: false,
    bulletLists: false, // Professional documents use paragraph format
    orderedLists: false,
    tables: true,
    paragraphs: true,
    headings: false,
    blockquotes: false,
    htmlTags: {
      bold: '<strong>',
      italic: '<em>',
      underline: '<u>',
      paragraph: '<p>',
      bulletListContainer: '<ul>',
      bulletListItem: '<li>',
      orderedListContainer: '<ol>',
      orderedListItem: '<li>',
      table: '<table>',
      tableRow: '<tr>',
      tableCell: '<td>',
      tableHeader: '<th>',
      heading1: '<h1>',
      heading2: '<h2>',
      heading3: '<h3>',
      blockquote: '<blockquote>'
    },
    aiInstructions: {
      structure: 'Write in well-structured paragraphs (4-6 sentences each, wrap in <p> tags). Maintain pure paragraph format with smooth transitions between topics.',
      emphasis: 'Use bold text (<strong>) ONLY for company names and key financial figures. Use italic text (<em>) ONLY for market terms and competitive positioning.',
      lists: 'NO bullet points or lists - maintain pure paragraph format with connected narrative flow.',
      tables: 'Use tables (<table>, <tr>, <td>, <th>) only for financial data or direct comparisons. Keep table content minimal and professional.',
      tone: 'Use formal business language with complete sentences and professional vocabulary. Write as if creating a formal business document for investors.'
    }
  },
  
  memo: {
    bold: true,
    italic: true,
    underline: false,
    bulletLists: true,
    orderedLists: true,
    tables: true,
    paragraphs: true,
    headings: false,
    blockquotes: false,
    htmlTags: {
      bold: '<strong>',
      italic: '<em>',
      underline: '<u>',
      paragraph: '<p>',
      bulletListContainer: '<ul>',
      bulletListItem: '<li>',
      orderedListContainer: '<ol>',
      orderedListItem: '<li>',
      table: '<table>',
      tableRow: '<tr>',
      tableCell: '<td>',
      tableHeader: '<th>',
      heading1: '<h1>',
      heading2: '<h2>',
      heading3: '<h3>',
      blockquote: '<blockquote>'
    },
    aiInstructions: {
      structure: 'Use bullet points extensively for key information (format as HTML <ul><li> lists). Keep sentences short and direct (under 20 words when possible). Minimize paragraph length (2-3 sentences max, wrap in <p> tags).',
      emphasis: 'Use bold text (<strong>) for emphasis and key terms. Use italic text (<em>) for company names and technical terms.',
      lists: 'Use numbered lists (<ol><li>) for sequential information and bullet lists (<ul><li>) for feature sets or key points.',
      tables: 'Use simple tables for data presentation. Keep tables concise and scannable.',
      tone: 'Prioritize clarity and brevity over detailed explanations. Create concise, scannable sections. Total word count should be under 800 words.'
    }
  },
  
  robust: {
    bold: true,
    italic: true,
    underline: false,
    bulletLists: true,
    orderedLists: true,
    tables: true,
    paragraphs: true,
    headings: false,
    blockquotes: true,
    htmlTags: {
      bold: '<strong>',
      italic: '<em>',
      underline: '<u>',
      paragraph: '<p>',
      bulletListContainer: '<ul>',
      bulletListItem: '<li>',
      orderedListContainer: '<ol>',
      orderedListItem: '<li>',
      table: '<table>',
      tableRow: '<tr>',
      tableCell: '<td>',
      tableHeader: '<th>',
      heading1: '<h1>',
      heading2: '<h2>',
      heading3: '<h3>',
      blockquote: '<blockquote>'
    },
    aiInstructions: {
      structure: 'Write comprehensive, detailed paragraphs (4-6 sentences each, wrap in <p> tags). Include thorough explanations and context. Provide detailed analysis and insights.',
      emphasis: 'Use bold text (<strong>) for key metrics, company names, and important facts. Use italic text (<em>) for technical terms, market conditions, and emphasis.',
      lists: 'Include bullet points (<ul><li>) for detailed feature lists or benefit summaries. Use ordered lists (<ol><li>) for processes or sequential information.',
      tables: 'Use comprehensive tables for detailed data presentation. Include multiple columns for thorough analysis.',
      tone: 'Use sophisticated vocabulary and complete sentences. Include background information and market context. Target word count should be 1200-1800 words.'
    }
  },
  
  balanced: {
    bold: true,
    italic: true,
    underline: false,
    bulletLists: true,
    orderedLists: true,
    tables: true,
    paragraphs: true,
    headings: false,
    blockquotes: false,
    htmlTags: {
      bold: '<strong>',
      italic: '<em>',
      underline: '<u>',
      paragraph: '<p>',
      bulletListContainer: '<ul>',
      bulletListItem: '<li>',
      orderedListContainer: '<ol>',
      orderedListItem: '<li>',
      table: '<table>',
      tableRow: '<tr>',
      tableCell: '<td>',
      tableHeader: '<th>',
      heading1: '<h1>',
      heading2: '<h2>',
      heading3: '<h3>',
      blockquote: '<blockquote>'
    },
    aiInstructions: {
      structure: 'Use moderate paragraph length (3-4 sentences, wrap in <p> tags). Balance bullet points with full paragraphs. Include key details without overwhelming information.',
      emphasis: 'Use bold text (<strong>) for company names, key metrics, and important highlights. Use italic text (<em>) for market terms, competitive advantages, and emphasis.',
      lists: 'Balance bullet points (<ul><li>) with paragraph content. Use lists for feature sets and key points, paragraphs for explanations.',
      tables: 'Use tables for structured data presentation. Keep tables focused and relevant.',
      tone: 'Use clear, professional language. Target word count should be 800-1200 words. Combine lists and narrative sections effectively.'
    }
  },
  
  conversational: {
    bold: true,
    italic: true,
    underline: false,
    bulletLists: true,
    orderedLists: true,
    tables: false, // Less formal, avoid tables
    paragraphs: true,
    headings: false,
    blockquotes: false,
    htmlTags: {
      bold: '<strong>',
      italic: '<em>',
      underline: '<u>',
      paragraph: '<p>',
      bulletListContainer: '<ul>',
      bulletListItem: '<li>',
      orderedListContainer: '<ol>',
      orderedListItem: '<li>',
      table: '<table>',
      tableRow: '<tr>',
      tableCell: '<td>',
      tableHeader: '<th>',
      heading1: '<h1>',
      heading2: '<h2>',
      heading3: '<h3>',
      blockquote: '<blockquote>'
    },
    aiInstructions: {
      structure: 'Use natural paragraph breaks (2-4 sentences, wrap in <p> tags). Write in a conversational flow that feels accessible and engaging.',
      emphasis: 'Use bold text (<strong>) for emphasis and key points. Use italic text (<em>) for companies, products, and concepts that need highlighting.',
      lists: 'Use bullet points (<ul><li>) frequently for easy reading and key takeaways. Lists should feel natural, not forced.',
      tables: 'Avoid complex tables. Present data in simple list format or within paragraphs.',
      tone: 'Use friendly, accessible language. Explain business concepts clearly and minimize jargon. Write as if explaining to a knowledgeable friend.'
    }
  }
};

/**
 * Gets the formatting configuration for a specific profile
 */
export function getFormattingConfig(profile: FormattingProfile): FormattingConfig {
  return FORMATTING_PROFILES[profile] || FORMATTING_PROFILES.professional;
}

/**
 * Generates AI prompt instructions based on formatting profile
 */
export function generateAiFormattingInstructions(profile: FormattingProfile): string {
  const config = getFormattingConfig(profile);
  
  const enabledElements: string[] = [];
  if (config.bold) enabledElements.push('bold text (<strong>)');
  if (config.italic) enabledElements.push('italic text (<em>)');
  if (config.bulletLists) enabledElements.push('bullet lists (<ul><li>)');
  if (config.orderedLists) enabledElements.push('numbered lists (<ol><li>)');
  if (config.tables) enabledElements.push('tables (<table>, <tr>, <td>, <th>)');
  if (config.paragraphs) enabledElements.push('paragraphs (<p>)');
  if (config.headings) enabledElements.push('headings (<h1>, <h2>, <h3>)');
  if (config.blockquotes) enabledElements.push('blockquotes (<blockquote>)');
  
  return `
HTML FORMATTING RULES FOR ${profile.toUpperCase()} STYLE:
- Available formatting elements: ${enabledElements.join(', ')}
- Structure: ${config.aiInstructions.structure}
- Emphasis: ${config.aiInstructions.emphasis}
- Lists: ${config.aiInstructions.lists}
${config.tables ? `- Tables: ${config.aiInstructions.tables}` : ''}
- Writing Style: ${config.aiInstructions.tone}

CRITICAL FORMATTING REQUIREMENTS:
- Use only HTML tags, NEVER markdown formatting (**bold** or *italic*)
- All paragraphs must be wrapped in <p> tags
- Use proper opening and closing tags for all elements
- Keep formatting consistent throughout all sections
- Use natural language with proper apostrophes (') and quotes (")
- Ensure all HTML is well-formed and valid
${!config.bulletLists ? '- DO NOT use bullet lists or numbered lists' : ''}
${!config.tables ? '- DO NOT use tables for data presentation' : ''}
`;
}

/**
 * Validates if HTML content matches the formatting profile requirements
 */
export function validateFormattingCompliance(html: string, profile: FormattingProfile): {
  isValid: boolean;
  violations: string[];
  suggestions: string[];
} {
  const config = getFormattingConfig(profile);
  const violations: string[] = [];
  const suggestions: string[] = [];
  
  // Check for markdown formatting (should be HTML only)
  if (html.includes('**') || html.includes('__')) {
    violations.push('Contains markdown bold formatting instead of HTML <strong> tags');
    suggestions.push('Replace **text** with <strong>text</strong>');
  }
  
  if (html.includes('*') && !html.includes('<em>')) {
    violations.push('Contains markdown italic formatting instead of HTML <em> tags');
    suggestions.push('Replace *text* with <em>text</em>');
  }
  
  // Check for disabled elements
  if (!config.bulletLists && html.includes('<ul>')) {
    violations.push(`Bullet lists are not allowed in ${profile} formatting`);
    suggestions.push('Convert lists to paragraph format');
  }
  
  if (!config.orderedLists && html.includes('<ol>')) {
    violations.push(`Numbered lists are not allowed in ${profile} formatting`);
    suggestions.push('Convert numbered lists to paragraph format');
  }
  
  if (!config.tables && html.includes('<table>')) {
    violations.push(`Tables are not allowed in ${profile} formatting`);
    suggestions.push('Present data within paragraphs or simple lists');
  }
  
  // Check for required paragraph wrapping
  if (config.paragraphs && html.includes('\n\n') && !html.includes('<p>')) {
    violations.push('Content should be wrapped in paragraph tags');
    suggestions.push('Wrap text content in <p> tags');
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    suggestions
  };
}

/**
 * Converts HTML content to match a specific formatting profile
 */
export function convertToFormattingProfile(html: string, targetProfile: FormattingProfile): string {
  const config = getFormattingConfig(targetProfile);
  let converted = html;
  
  // Convert markdown to HTML
  converted = converted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  converted = converted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Remove unsupported elements based on profile
  if (!config.bulletLists) {
    // Convert bullet lists to paragraphs
    converted = converted.replace(/<ul>\s*<li>(.*?)<\/li>\s*<\/ul>/g, '<p>$1</p>');
    converted = converted.replace(/<li>(.*?)<\/li>/g, '<p>• $1</p>');
  }
  
  if (!config.orderedLists) {
    // Convert ordered lists to paragraphs
    let counter = 1;
    converted = converted.replace(/<ol>\s*<li>(.*?)<\/li>\s*<\/ol>/g, (match, content) => {
      return `<p>${counter++}. ${content}</p>`;
    });
  }
  
  if (!config.tables) {
    // Convert simple tables to paragraphs (basic conversion)
    converted = converted.replace(/<table>.*?<\/table>/g, (match) => {
      // This is a basic conversion - could be enhanced
      return match.replace(/<t[hd]>(.*?)<\/t[hd]>/g, '$1, ')
                  .replace(/<\/?t[r]>/g, '')
                  .replace(/<\/?table>/g, '<p>')
                  .replace(/,$/, '</p>');
    });
  }
  
  // Ensure paragraph wrapping
  if (config.paragraphs) {
    // Wrap orphaned text in paragraphs
    converted = converted.replace(/^([^<\n].+)$/gm, '<p>$1</p>');
  }
  
  return converted;
}