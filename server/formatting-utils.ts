/**
 * Server-side utilities for integrating the formatting system
 * with existing CIM generation and document processing
 */

import { generateAiFormattingInstructions, validateFormattingCompliance, convertToFormattingProfile, type FormattingProfile } from "@shared/formatting-config";

// Custom style configuration type (mirrors frontend)
export interface CustomStyleConfig {
  name: string;
  wordCountTarget: number;
  useBullets: boolean;
  useNumberedLists: boolean;
  useTables: boolean;
  toneDescription: string;
}

/**
 * Generates AI formatting instructions from custom style config
 */
export function generateCustomStyleInstructions(config: CustomStyleConfig): string {
  const formatElements: string[] = ['bold text (<strong>)', 'italic text (<em>)', 'paragraphs (<p>)'];

  if (config.useBullets) formatElements.push('bullet lists (<ul><li>)');
  if (config.useNumberedLists) formatElements.push('numbered lists (<ol><li>)');
  if (config.useTables) formatElements.push('tables (<table>, <tr>, <td>, <th>)');

  const wordCountGuidance = config.wordCountTarget <= 600
    ? 'Keep content brief and concise.'
    : config.wordCountTarget <= 900
    ? 'Write concisely with key details.'
    : config.wordCountTarget <= 1200
    ? 'Provide standard level of detail.'
    : config.wordCountTarget <= 1500
    ? 'Include detailed explanations and context.'
    : 'Provide comprehensive, in-depth analysis with thorough explanations.';

  return `
HTML FORMATTING RULES FOR CUSTOM STYLE:
- Available formatting elements: ${formatElements.join(', ')}
- Target word count: ~${config.wordCountTarget} words. ${wordCountGuidance}
${!config.useBullets ? '- DO NOT use bullet lists (<ul>)' : '- Use bullet points for key information when appropriate'}
${!config.useNumberedLists ? '- DO NOT use numbered lists (<ol>)' : '- Use numbered lists for sequential or ordered information'}
${!config.useTables ? '- DO NOT use tables for data presentation' : '- Use tables when presenting structured data or comparisons'}

WRITING VOICE & TONE:
${config.toneDescription}

Apply the above voice and tone instructions consistently throughout all content.

CRITICAL FORMATTING REQUIREMENTS:
- Use only HTML tags, NEVER markdown formatting (**bold** or *italic*)
- All paragraphs must be wrapped in <p> tags
- Use proper opening and closing tags for all elements
- Keep formatting consistent throughout all sections
- Use natural language with proper apostrophes (') and quotes (")
- Ensure all HTML is well-formed and valid
`;
}

/**
 * Maps legacy tone parameters to new formatting profiles
 */
export function mapLegacyToneToProfile(tone?: string): FormattingProfile {
  switch (tone?.toLowerCase()) {
    case 'memo':
      return 'memo';
    case 'robust':
      return 'robust';
    case 'balanced':
      return 'balanced';
    case 'conversational':
      return 'conversational';
    case 'professional':
    default:
      return 'professional';
  }
}

/**
 * Enhances existing AI prompts with formatting instructions
 */
export function enhancePromptWithFormatting(
  basePrompt: string,
  formattingProfile: FormattingProfile = 'professional'
): string {
  const formatInstructions = generateAiFormattingInstructions(formattingProfile);
  
  return `${basePrompt}

${formatInstructions}

REMINDER: Follow the formatting rules above strictly. Use only the specified HTML tags and maintain consistency throughout your response.`;
}

/**
 * Validates and optionally converts AI-generated content to match formatting profile
 */
export function processAiGeneratedContent(
  content: string,
  targetProfile: FormattingProfile,
  autoConvert: boolean = false
): {
  content: string;
  isValid: boolean;
  violations: string[];
  suggestions: string[];
} {
  const validation = validateFormattingCompliance(content, targetProfile);
  
  if (!validation.isValid && autoConvert) {
    const convertedContent = convertToFormattingProfile(content, targetProfile);
    const revalidation = validateFormattingCompliance(convertedContent, targetProfile);
    
    return {
      content: convertedContent,
      isValid: revalidation.isValid,
      violations: revalidation.violations,
      suggestions: revalidation.suggestions
    };
  }
  
  return {
    content,
    ...validation
  };
}

/**
 * Extracts formatting profile from request parameters
 */
export function getFormattingProfileFromRequest(req: any): FormattingProfile {
  // Check various possible parameter locations
  const tone = req.body?.tone || req.query?.tone || req.body?.formattingProfile || req.query?.formattingProfile;
  return mapLegacyToneToProfile(tone);
}

/**
 * Creates formatted system prompt for CIM generation
 */
export function createCimSystemPrompt(
  purpose: string = 'business_overview',
  audience: string = 'investors',
  customDirections: string = '',
  formattingProfile: FormattingProfile = 'professional',
  customStyleConfig?: CustomStyleConfig | null
): string {
  // Use custom style instructions if provided, otherwise use standard formatting profile
  const formatInstructions = customStyleConfig
    ? generateCustomStyleInstructions(customStyleConfig)
    : generateAiFormattingInstructions(formattingProfile);

  const styleLabel = customStyleConfig ? 'custom' : formattingProfile;
  
  // Map purpose to content focus
  let purposeFocus = '';
  if (purpose === 'business_overview') {
    purposeFocus = 'Focus on comprehensive business description, operations, market position, and growth potential suitable for stakeholder understanding.';
  } else if (purpose === 'equity_raise') {
    purposeFocus = 'Emphasize investment opportunity, financial performance, growth projections, and reasons why investors should participate.';
  }

  // Map audience to communication style
  let audienceStyle = '';
  if (audience === 'investors') {
    audienceStyle = 'Use financial terminology, emphasize ROI and market opportunities, include detailed metrics and projections.';
  } else if (audience === 'colleagues') {
    audienceStyle = 'Use professional but accessible language, focus on operational details and strategic considerations.';
  } else if (audience === 'friends') {
    audienceStyle = 'Use conversational but professional tone, explain business concepts clearly, minimize jargon.';
  }

  return `You are an expert business analyst creating a professional Confidential Information Memorandum (CIM).

ANALYSIS PARAMETERS:
- Purpose: ${purpose} - ${purposeFocus}
- Audience: ${audience} - ${audienceStyle}
- Formatting Style: ${styleLabel}${customStyleConfig ? ` (Custom: ${customStyleConfig.toneDescription.substring(0, 50)}...)` : ''}

${customDirections ? `CUSTOM DIRECTIONS:
${customDirections}` : ''}

${formatInstructions}

CONTENT REQUIREMENTS:
1. Create a comprehensive CIM document following the specific formatting requirements above
2. Extract and organize information from the provided data according to the custom directions
3. Apply the ${styleLabel} formatting style consistently throughout
4. Write for ${audience} using the appropriate communication style
5. Focus on ${purpose} as the primary objective
6. Include specific details, metrics, and facts from the provided information
7. Organize content into logical sections with clear structure
8. Ensure all information is factual and well-sourced
9. Create a cohesive narrative that integrates all available information sources

RESPONSE FORMAT:
Return ONLY a valid JSON object with the following structure:
{
  "title": "Document title",
  "companyName": "Company name if mentioned",
  "generatedAt": "${new Date().toISOString()}",
  "sections": [
    {
      "id": "unique-id",
      "title": "Section Title",
      "content": "Rich text content using HTML tags according to ${styleLabel} profile",
      "order": 1,
      "type": "text"
    }
  ],
  "metadata": {
    "purpose": "${purpose}",
    "tone": "${styleLabel}",
    "audience": "${audience}",
    "customDirections": "summary of directions used",
    "wordCount": 0,
    "hasFinancials": false,
    "hasImages": false
  }
}

CRITICAL: Return ONLY the JSON object above. Do not include any markdown headers, explanations, or text before or after the JSON.`;
}

/**
 * Logs formatting validation results for debugging
 */
export function logFormattingValidation(
  content: string, 
  profile: FormattingProfile, 
  context: string = 'Generated Content'
): void {
  const validation = validateFormattingCompliance(content, profile);
  
  console.log(`🎨 FORMATTING VALIDATION - ${context}:`);
  console.log(`📝 Profile: ${profile}`);
  console.log(`✅ Valid: ${validation.isValid}`);
  
  if (!validation.isValid) {
    console.log(`❌ Violations (${validation.violations.length}):`);
    validation.violations.forEach((violation, idx) => {
      console.log(`   ${idx + 1}. ${violation}`);
    });
    
    if (validation.suggestions.length > 0) {
      console.log(`💡 Suggestions (${validation.suggestions.length}):`);
      validation.suggestions.forEach((suggestion, idx) => {
        console.log(`   ${idx + 1}. ${suggestion}`);
      });
    }
  }
  
  console.log(`📊 Content preview: ${content.substring(0, 200)}...`);
}