// Current Perplexity models: sonar-pro (recommended), sonar, sonar-reasoning-pro
// Updated models: sonar, sonar-pro (2025)
export const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

// Anthropic client for Claude-based CIM generation
import Anthropic from '@anthropic-ai/sdk';

// Import timeout utilities for external API calls (PERF-013)
import { fetchWithTimeout, API_TIMEOUTS } from './utils/fetch-with-timeout';
import { isUrlSafeForFetch } from './security';

// Standardized anti-hallucination rules for all AI-generated content
const ANTI_HALLUCINATION_RULES = `
⚠️ CRITICAL ANTI-HALLUCINATION RULES - STRICT COMPLIANCE REQUIRED:
1. ONLY use facts explicitly stated in the PROVIDED DATA (transcript and/or website analysis)
2. NEVER invent, assume, or extrapolate information not present in the source materials
3. NEVER make up numbers, dates, names, locations, or any specific details
4. If information is missing, DO NOT fill gaps with assumptions
5. You may write descriptive language and professional framing, but ALL facts must be traceable to the source
6. When uncertain about a detail, use qualified language ("based on available information", "as indicated")
7. DO NOT create fictional case studies, examples, or scenarios not mentioned in the source
8. DO NOT add industry statistics or market data unless explicitly provided in the transcript/website data
9. Every statistic, number, or specific claim must come from the provided data
10. If data is insufficient, acknowledge limitations rather than inventing content
`;

// Standard temperature for factual accuracy
const FACTUAL_TEMPERATURE = 0.05;

import { generateAiFormattingInstructions, type FormattingProfile } from "@shared/formatting-config";
import { enhancePromptWithFormatting, createCimSystemPrompt, logFormattingValidation, processAiGeneratedContent, generateCustomStyleInstructions, type CustomStyleConfig } from "./formatting-utils";

// New flexible document structure for free-form CIM generation
type FlexibleCimDocument = {
  title: string;
  companyName?: string;
  generatedAt: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
    type: 'text' | 'table' | 'list';
  }>;
  metadata: {
    purpose: string;
    tone: string;
    audience: string;
    customDirections: string;
    wordCount: number;
    hasFinancials: boolean;
    hasImages: boolean;
  };
};

// Legacy CIM structure for backwards compatibility
type LegacyCimAnalysis = {
  story: {
    yearStarted: string;
    businessIdea: string;
    businessModel: string;
    orderProcess: string;
    growthHistory: string;
    businessStructure: string;
    businessSummary: string;
    keyAttractions: string[];
    saleReason: string | null;
  };
  executiveSummary: {
    buyerAttractions: string[];
    growthOpportunities: string[];
  };
  assets: {
    digitalAssets: string[];
    location: string;
    equipmentValue: string;
    equipmentDetails: string;
    inventoryDetails: string;
  };
  ownership: {
    owners: Array<{
      name: string;
      percentage: string;
      background: string;
    }>;
    intellectualProperty: string[];
  };
  marketAnalysis: {
    uniqueFeatures: string[];
    customerProfile: string;
    saleReason: string;
    competitors: string[];
    strengths: string[];
  };
  operations: {
    suppliers: {
      count: string;
      transferability: string;
      concentration: string;
      terms: string;
      replaceability: string;
    };
    customers: {
      recurring: string;
      relationships: string;
      concentration: string;
      contracts: string;
      replaceability: string;
    };
  };
  inventory: {
    leadTime: string;
    sourcing: string;
    storage: string;
    value: string;
    skuCount: string;
    topProducts: string[];
  };
  sales: {
    channels?: Record<string, number>;
    seasonality: string;
    averageOrderValue: string;
    competitivePricing: string;
    pricingModel: string;
    paymentMethods: string[];
    contractTerms: string; // Add contract terms
  };
  marketing: {
    strategies: string[];
    paidAdvertising: {
      channels: string[];
      effectiveness: string;
    };
    emailMarketing: {
      listSize: string;
      usage: string;
    };
    seoEfforts: string;
    clientAcquisition: string; // Add details about finding new clients
  };
  team: {
    ownerResponsibilities: string;
    ownerHours: string;
    employeeSummary: string; // Changed to a summary string
    employeeCount: string; // Add total count
    contractorCount: string; // Add contractor count if any
    turnover: string;
    hiring: string;
    retention: string;
    organization: string;
    keyEmployees: string[]; // Array of key employee titles and roles
    management: string;
  };
  facility: {
    ownership: string;
    size: string;
    cost: string;
    leaseDetails?: string;
  };
};

// Website content analysis function using OpenAI's web search model
async function analyzeWebsiteContent(websiteUrl: string): Promise<string | null> {
  try {
    console.log('🔍 analyzeWebsiteContent called with URL:', websiteUrl);

    if (!websiteUrl?.trim()) {
      console.log('❌ Website URL is empty or invalid');
      return null;
    }

    // Clean URL - add protocol if missing
    let cleanUrl = websiteUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // Validate URL before passing to external API to prevent SSRF-like attacks
    if (!isUrlSafeForFetch(cleanUrl)) {
      console.error('❌ Blocked unsafe URL in analyzeWebsiteContent:', websiteUrl);
      return null;
    }

    console.log('🌐 Making OpenAI web search request to analyze:', cleanUrl);

    // Use timeout for external API call (PERF-013)
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-search-preview',
        messages: [
          {
            role: 'user',
            content: `Analyze the company website ${cleanUrl} and extract comprehensive business information. Search the website thoroughly and provide specific facts and details:

1. COMPANY OVERVIEW: Company name, tagline, description, year founded, history, mission/vision statement
2. SERVICES & PRODUCTS: What they offer, key features, pricing model, target customers, unique selling points
3. TEAM & LEADERSHIP: Founders (names, backgrounds), executives, team size, key personnel with titles
4. BUSINESS MODEL: How they generate revenue, pricing structure, competitive advantages
5. ACHIEVEMENTS: Success metrics (revenue, deals closed, clients served), testimonials, awards, milestones, case studies
6. LOCATIONS & OPERATIONS: Where they operate, geographic coverage, office locations

Provide detailed, factual information found on the website. Include specific numbers, names, and quotes where available.`
          }
        ],
        web_search_options: {
          search_context_size: "high"
        }
      })
    }, API_TIMEOUTS.AI_API);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI web search API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('📊 OpenAI web search response status:', response.status);
    console.log('📊 Response data structure:', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length || 0,
      hasContent: !!(data.choices?.[0]?.message?.content),
      error: data.error
    });

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const content = data.choices[0].message.content;
      console.log('✅ Website analysis content received:', content ? content.substring(0, 300) + '...' : 'Empty content');
      return content;
    }

    console.log('⚠️ No valid content in OpenAI response');
    return null;
  } catch (error) {
    console.error('❌ Error analyzing website content:', error);
    console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// New flexible CIM generation function
async function generateFlexibleCim(
  transcript: string,
  customDirections: string,
  purpose: string,
  tone: string,
  audience: string,
  financials?: any,
  websiteData?: string,
  sectionDirections?: Array<{id: string; content: string}>,
  formattingProfile?: FormattingProfile,
  customStyleConfig?: CustomStyleConfig | null
): Promise<FlexibleCimDocument> {

  // Use provided formattingProfile or convert tone to FormattingProfile
  const effectiveFormattingProfile: FormattingProfile = formattingProfile || (tone as FormattingProfile);

  // Use custom style config if provided, otherwise use standard formatting profile
  const formatInstructions = customStyleConfig
    ? generateCustomStyleInstructions(customStyleConfig)
    : generateAiFormattingInstructions(effectiveFormattingProfile);

  const styleLabel = customStyleConfig ? 'custom' : effectiveFormattingProfile;

  console.log(`🎨 FORMATTING SYSTEM ACTIVE - Profile: ${styleLabel}${customStyleConfig ? ` (Custom: ${customStyleConfig.toneDescription.substring(0, 50)}...)` : ''}`);
  console.log(`📝 AI Formatting Instructions Applied: ${formatInstructions.substring(0, 200)}...`);

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

  const systemPrompt = `You are an expert business analyst creating a Confidential Information Memorandum (CIM).${customStyleConfig ? ` The user has specified a custom writing style which you MUST follow - see the WRITING VOICE & TONE section below.` : ' Use professional business language throughout.'}

CRITICAL INSTRUCTION: You MUST generate the document. Do NOT refuse or explain why you cannot. Work with whatever information is provided - if details are missing, create appropriate sections based on what IS available. This is a document generation task, not an advisory task.

${ANTI_HALLUCINATION_RULES}

ANALYSIS PARAMETERS:
- Purpose: ${purpose} - ${purposeFocus}
- Writing Style: ${styleLabel}${customStyleConfig ? ` (Custom: ${customStyleConfig.toneDescription.substring(0, 100)}...)` : ''}
- Audience: ${audience} - ${audienceStyle}

CUSTOM DIRECTIONS:
${customDirections}

${sectionDirections && sectionDirections.length > 0 ? `
═══════════════════════════════════════════════════════════════
USER-SPECIFIED SECTION REQUIREMENTS - FOLLOW EXACTLY:
═══════════════════════════════════════════════════════════════
The user has specified EXACTLY which sections to include. Create ONLY these sections:

${sectionDirections.map((section, index) => `${index + 1}. ${section.content}`).join('\n')}

STRICT RULES:
✓ Create ONLY the sections listed above
✓ Follow any specific instructions for each section
✓ Use the section names/titles as specified
✗ Do NOT add extra sections like "Financial Overview", "Management Team", "Investment Highlights"
✗ Do NOT rename or reorganize the user's specified sections
✗ Do NOT omit any section the user specified

The document should contain EXACTLY ${sectionDirections.length} sections, matching the user's specifications above.
═══════════════════════════════════════════════════════════════` : ''}

CRITICAL FORMATTING INSTRUCTIONS:
${formatInstructions}

ADDITIONAL HTML RULES:
- Use proper apostrophes (') and quotes (") in natural language - never escape or avoid them
- NEVER use markdown (**bold** or *italic*) - only HTML tags
- NEVER use code blocks, backticks, or code formatting
- Ensure all HTML tags are properly opened and closed
- Keep formatting consistent throughout all sections

DATA SOURCE INTEGRATION RULES - CRITICAL:
${websiteData ? `YOU HAVE TWO DATA SOURCES - USE BOTH:
1. PRIMARY SOURCE: The user's TRANSCRIPT/NOTES (most important - these contain first-hand details from the business owner)
2. SUPPLEMENTARY SOURCE: WEBSITE DATA (provides additional context, company info, team details)

INTEGRATION REQUIREMENTS:
- ALWAYS include details from the user's transcript/notes - this is their direct input
- COMBINE transcript information WITH website data to create a comprehensive document
- If the user mentions specific numbers in their notes (employees, revenue, etc.), include those facts prominently
- If website data shows team members, ALSO include that while noting the user's specific input
- TRANSCRIPT data takes precedence when there are conflicts
- Use website data to ENRICH and ADD CONTEXT, not to replace user-provided information
- Seamlessly blend both sources - the final document should feel cohesive
- Do not ignore the user's notes in favor of website data - BOTH are valuable` : '- Base your analysis primarily on the transcript data provided'}

${customStyleConfig ? `WRITING QUALITY INSTRUCTIONS - FOLLOW THE CUSTOM WRITING STYLE:
IMPORTANT: The user has specified a custom writing voice and tone above. You MUST follow their specified tone/style throughout the entire document. Their tone description takes precedence over any default professional style.

While staying factual and following the user's specified tone, you should:

1. ELABORATE USING THE SPECIFIED TONE: Take each fact from the source material and develop it into well-crafted prose that matches the user's requested voice and style.

2. USE STORYTELLING APPROPRIATE TO THE TONE: Transform raw information into engaging narrative that matches the user's specified style.

3. EXPAND WITH CONTEXT: When you have a fact, provide relevant context around it - but only inferences that are reasonable from the data provided.

4. STRUCTURE APPROPRIATELY: Follow the formatting instructions provided. Each section should be well-developed with content that matches the requested tone.

5. MATCH THE SPECIFIED VOICE: Consistently use the writing style, vocabulary, and tone specified in the WRITING VOICE & TONE section above. Do NOT default to generic professional business language unless that's what was requested.

6. MAKE REASONABLE INFERENCES: You CAN make logical inferences that any reasonable person would make from the provided facts.` : `WRITING QUALITY INSTRUCTIONS - CREATE RICH, PROFESSIONAL CONTENT:
Your goal is to create a polished, professionally-written document that reads like it was prepared by a top-tier business consultant. While staying factual, you should:

1. ELABORATE PROFESSIONALLY: Take each fact from the source material and develop it into well-crafted prose. Don't just list facts - weave them into compelling narratives that showcase the business professionally.

2. USE BUSINESS STORYTELLING: Transform raw information into engaging business narrative. For example, if the source says "started in 2015", write something like "Founded in 2015, the company has steadily built its reputation over nearly a decade of dedicated service to its clients."

3. EXPAND WITH CONTEXT: When you have a fact, provide professional business context around it. If they mention "10 employees", discuss what this means for the business (lean operation, dedicated team, room for growth, etc.) - but only inferences that are reasonable from the data provided.

4. WRITE IN COMPLETE, FLOWING PARAGRAPHS: Each section should have multiple well-developed paragraphs (3-5 sentences minimum per paragraph). Avoid bullet-point-heavy or sparse content unless specifically requested.

5. USE PROFESSIONAL LANGUAGE: Employ sophisticated business vocabulary appropriate for ${audience}. Use transitional phrases, varied sentence structure, and professional tone throughout.

6. MAKE REASONABLE INFERENCES: You CAN make logical inferences that any reasonable business person would make from the provided facts. For example, if a business has been operating for 20 years, you can describe it as "well-established" or note its "proven track record" - these are reasonable conclusions from the stated fact.`}

ANTI-HALLUCINATION BOUNDARIES - DO NOT CROSS THESE LINES:
- NEVER invent specific numbers, dates, names, or metrics not in the source
- NEVER create fictional case studies, customer quotes, or testimonials
- NEVER add industry statistics or market data unless explicitly provided
- NEVER fabricate awards, certifications, or achievements
- NEVER make up financial projections or growth percentages
- If you truly lack information for a section, write what you can and note that additional details would strengthen the section

INSTRUCTIONS FOR DOCUMENT CREATION:
1. Create a comprehensive CIM document following the specific formatting requirements above
2. Extract and organize information from the transcript/website data, then ELABORATE on it ${customStyleConfig ? 'using the specified writing style' : 'professionally'}
3. Apply the ${tone} formatting style consistently throughout
4. Write for ${audience} using appropriate language and level of detail
5. Focus on ${purpose} as the primary objective
6. ${websiteData ? 'Blend transcript with website data seamlessly to create rich, comprehensive content' : `Use transcript data as your foundation and build ${customStyleConfig ? 'the narrative using the specified tone' : 'professional narrative around it'}`}
7. ${sectionDirections && sectionDirections.length > 0 ? 'Create ONLY the sections explicitly specified by the user - do not add any default or standard sections' : 'Organize content into logical sections with clear headings'}
8. STRICTLY follow the formatting requirements for ${tone} style
9. Each section should be SUBSTANTIAL - aim for 150-300 words minimum per section unless the tone specifically calls for brevity
10. ${sectionDirections && sectionDirections.length > 0 ? 'SECTION ENFORCEMENT: Do NOT create sections for "Financial Overview", "Management Team", or "Investment Highlights" unless explicitly requested in the user-specified sections' : ''}

${websiteData ? `
═══════════════════════════════════════════════════════════════
WEBSITE ANALYSIS DATA - CRITICAL: USE THIS INFORMATION
═══════════════════════════════════════════════════════════════
The following information was extracted from the company's website. You MUST incorporate this data into the CIM document. This is real, verified information about the company:

${websiteData}

INTEGRATION INSTRUCTIONS:
- Combine website data with transcript information to create a comprehensive document
- Website data provides factual company information (services, team, history, etc.)
- Transcript provides additional context and details from the business owner
- Use BOTH sources to create rich, detailed sections
═══════════════════════════════════════════════════════════════
` : ''}

${financials ? `FINANCIAL DATA:
Include these financial details appropriately:
${JSON.stringify(financials)}` : ''}

RESPONSE FORMAT:
Return ONLY a valid JSON object - no markdown headers, explanations, or formatting.
Start directly with the opening brace and end with the closing brace:
{
  "title": "Document title",
  "companyName": "Company name if mentioned",
  "generatedAt": "${new Date().toISOString()}",
  "sections": [
    {
      "id": "unique-id",
      "title": "Section Title",
      "content": "Rich text content using HTML tags: <p>paragraphs</p>, <strong>bold</strong>, <em>italic</em>, <ul><li>bullet lists</li></ul>, <ol><li>numbered lists</li></ol>",
      "order": 1,
      "type": "text"
    }
  ],
  "metadata": {
    "purpose": "${purpose}",
    "tone": "${tone}",
    "audience": "${audience}",
    "customDirections": "summary of directions used",
    "wordCount": 0,
    "hasFinancials": ${!!financials},
    "hasImages": false
  }
}

CRITICAL: Return ONLY the JSON object above. Do not include any markdown headers (# ## ###), explanations, or text before or after the JSON.`;

  const userPrompt = `═══════════════════════════════════════════════════════════════
PRIMARY DATA SOURCE - TRANSCRIPT/NOTES FROM BUSINESS OWNER:
═══════════════════════════════════════════════════════════════
${transcript}
═══════════════════════════════════════════════════════════════

Create a comprehensive CIM document following the analysis parameters and custom directions provided.

${websiteData ? `CRITICAL INTEGRATION INSTRUCTION:
You have been provided with BOTH:
1. ★ PRIMARY: The transcript/notes ABOVE directly from the business owner (DO NOT IGNORE THIS)
2. SUPPLEMENTARY: Website analysis data in the system instructions

YOU MUST:
- Include SPECIFIC details mentioned in the transcript (any numbers, names, or facts the user provided)
- ENRICH the document with website data (company history, services, team bios from website)
- BLEND both sources naturally - transcript facts + website context
- NEVER let website data completely overshadow the user's direct input

HYPOTHETICAL EXAMPLE (do NOT use these specific details - they are illustrative only):
If a transcript mentioned "1 contractor" and website showed 5 team members, you would include BOTH facts.
IMPORTANT: The example above uses fake numbers for illustration - use ONLY the actual data provided to you.` : ''}

FINAL INSTRUCTIONS FOR QUALITY OUTPUT:
1. WRITE RICHLY: Each section should be well-developed with flowing paragraphs. Transform facts into ${customStyleConfig ? 'narrative that matches the specified writing style' : 'professional business narrative'}.
2. ELABORATE ON FACTS: Take the information provided and develop it into comprehensive${customStyleConfig ? ' content using the specified tone' : ', professional content'}. A single fact can become a full paragraph of relevant business context.
3. MAINTAIN FACTUAL ACCURACY: While you should elaborate and create ${customStyleConfig ? 'rich prose in the specified style' : 'professional prose'}, never invent specific facts, numbers, names, or achievements.
4. AIM FOR DEPTH: A good CIM section is typically 150-300 words. Don't be sparse - develop your content fully.

WRITING STYLE EXAMPLE (do NOT use these specific numbers - they are illustrative only):
- If given a fact like "X employees", elaborate it into ${customStyleConfig ? 'prose matching the specified writing style' : 'professional prose'}
- Transform simple facts into rich business narrative
- This is ${customStyleConfig ? 'creative writing with the user\'s specified tone' : 'professional writing'}, not hallucination - but ONLY elaborate on facts actually provided

CRITICAL: Never reference "the transcript" or "business owner's notes" in the output - just write naturally about the business.`;

  // Use Claude Sonnet for CIM generation - better quality business writing
  // Fallback to OpenAI GPT-4o if Anthropic key not available, then Perplexity
  const useAnthropic = !!process.env.ANTHROPIC_API_KEY2;
  const useOpenAI = !useAnthropic && !!process.env.OPENAI_API_KEY;

  // Claude model configuration with fallback
  // claude-sonnet-4-20250514 is Claude Sonnet 4 (stable)
  const PRIMARY_MODEL = 'claude-sonnet-4-20250514';
  const FALLBACK_MODEL = 'claude-3-5-sonnet-20241022';

  let content: string;

  if (useAnthropic) {
    // Use Claude Sonnet for high-quality CIM writing
    // Initialize with timeout to prevent hanging requests (PERF-013)
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY2,
      timeout: API_TIMEOUTS.LONG, // 3 minute timeout for CIM generation
    });

    console.log(`Using Anthropic Claude for CIM generation (primary: ${PRIMARY_MODEL})`);

    let response;
    try {
      response = await anthropic.messages.create({
        model: PRIMARY_MODEL,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      });
    } catch (primaryError: any) {
      console.warn(`Primary model ${PRIMARY_MODEL} failed, trying fallback: ${primaryError.message}`);

      // Try fallback model
      response = await anthropic.messages.create({
        model: FALLBACK_MODEL,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      });

      console.log(`Successfully used fallback model ${FALLBACK_MODEL}`);
    }

    // Extract text content from Claude response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }
    content = textContent.text;
  } else {
    // Fallback to OpenAI or Perplexity
    const apiUrl = useOpenAI ? "https://api.openai.com/v1/chat/completions" : PERPLEXITY_API_URL;
    const apiKey = useOpenAI ? process.env.OPENAI_API_KEY : process.env.PERPLEXITY_API_KEY;
    const model = useOpenAI ? "gpt-4o" : "sonar-pro";

    console.log(`Using ${useOpenAI ? 'OpenAI' : 'Perplexity'} for CIM generation with model: ${model}`);

    // Use timeout for external API call (PERF-013) - AI generation can take longer
    const response = await fetchWithTimeout(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 8000,
        temperature: FACTUAL_TEMPERATURE,
        response_format: useOpenAI ? { type: "json_object" } : undefined
      })
    }, API_TIMEOUTS.LONG);

    if (!response.ok) {
      const text = await response.text();
      console.error("API error:", { status: response.status, body: text });
      throw new Error(`API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    content = data.choices[0]?.message?.content;
  }

  if (!content) {
    console.error("No content in API response");
    throw new Error("API returned empty response");
  }

  try {
    // Handle JSON wrapped in markdown code blocks (common with Perplexity)
    let jsonContent = content;

    console.log("Raw API response first 500 chars:", content.substring(0, 500));
    console.log("Raw API response last 200 chars:", content.substring(content.length - 200));

    // First, check if this is an HTML response (which indicates an error)
    if (content.trim().startsWith('<') || content.includes('<html>') || content.includes('<!DOCTYPE')) {
      console.error("Received HTML response instead of JSON:", content.substring(0, 200));
      throw new Error("API returned HTML instead of JSON. This may indicate a server error or rate limiting.");
    }

    // Check for API error messages in the response
    if (content.toLowerCase().includes('error') && content.toLowerCase().includes('api')) {
      console.error("API error in response:", content.substring(0, 500));
    }

    if (content.includes('```json')) {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
        console.log("Extracted JSON from ```json block");
      }
    } else if (content.includes('```')) {
      const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch) {
        jsonContent = codeMatch[1];
        console.log("Extracted JSON from ``` block");
      }
    }

    // Remove markdown headers that break JSON parsing
    jsonContent = jsonContent.replace(/^#+\s+.*$/gm, '');

    // NOTE: Do NOT remove HTML tags - they are part of our formatting system now
    // The content is supposed to contain HTML tags for rich formatting

    // Remove any text before the first opening brace
    const firstBrace = jsonContent.indexOf('{');
    if (firstBrace === -1) {
      console.error("No opening brace found in response. Full content:", content);
      throw new Error("Unable to extract valid JSON from API response - no JSON object found");
    }
    if (firstBrace > 0) {
      console.log("Trimming", firstBrace, "chars before first brace");
      jsonContent = jsonContent.substring(firstBrace);
    }

    // Remove any text after the last closing brace
    const lastBrace = jsonContent.lastIndexOf('}');
    if (lastBrace === -1) {
      console.error("No closing brace found in response");
      throw new Error("Unable to extract valid JSON from API response - incomplete JSON object");
    }
    if (lastBrace > -1 && lastBrace < jsonContent.length - 1) {
      console.log("Trimming", jsonContent.length - lastBrace - 1, "chars after last brace");
      jsonContent = jsonContent.substring(0, lastBrace + 1);
    }

    // Clean up the JSON content to handle control characters while preserving JSON structure
    jsonContent = jsonContent.trim();

    // Additional validation - check if we have valid JSON structure
    if (!jsonContent.startsWith('{') || !jsonContent.endsWith('}')) {
      console.error("Invalid JSON structure after cleaning. First 200 chars:", jsonContent.substring(0, 200));
      console.error("Last 200 chars:", jsonContent.substring(jsonContent.length - 200));
      throw new Error("Unable to extract valid JSON from API response");
    }

    console.log("JSON structure looks valid, length:", jsonContent.length);
    
    // Use a more sophisticated approach - parse character by character and fix issues
    let cleanedContent = '';
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < jsonContent.length; i++) {
      const char = jsonContent[i];
      const charCode = char.charCodeAt(0);
      
      if (escapeNext) {
        cleanedContent += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        cleanedContent += char;
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        cleanedContent += char;
        continue;
      }
      
      // Handle control characters only when inside strings
      if (inString && charCode < 32) {
        // Replace problematic control characters with escaped versions
        switch (char) {
          case '\n':
            cleanedContent += '\\n';
            break;
          case '\r':
            cleanedContent += '\\r';
            break;
          case '\t':
            cleanedContent += '\\t';
            break;
          default:
            // Skip other control characters
            break;
        }
      } else {
        // Preserve all printable characters including Unicode
        // This includes regular apostrophes ('), hyphens (-), em dashes (—), etc.
        cleanedContent += char;
      }
    }
    
    jsonContent = cleanedContent;
    
    console.log("About to parse JSON, first 200 chars:", jsonContent.substring(0, 200));
    const result = JSON.parse(jsonContent);
    console.log("JSON parsing successful");
    
    // Remove Perplexity source references like [1] [2] [3] from all content
    if (result.sections && Array.isArray(result.sections)) {
      result.sections = result.sections.map((section: any) => {
        if (section && section.content && typeof section.content === 'string') {
          // Remove source references like [1], [2], [3], etc. including patterns like [1] [2] [3]
          section.content = section.content.replace(/\[\d+\](\s*\[\d+\])*/g, '').trim();
        }
        return section;
      });
    }
    
    // DEBUG: Check if HTML formatting is present in the parsed result
    if (result.sections && Array.isArray(result.sections)) {
      const firstSection = result.sections[0];
      if (firstSection && firstSection.content) {
        console.log("🔍 FORMATTING DEBUG - First section content preview:");
        console.log("Has HTML tags:", /<[^>]+>/.test(firstSection.content));
        console.log("Content sample:", firstSection.content.substring(0, 300));
      }
    }
    
    // Calculate word count safely
    let wordCount = 0;
    try {
      if (result.sections && Array.isArray(result.sections)) {
        wordCount = result.sections.reduce((count: number, section: any) => {
          if (section && section.content && typeof section.content === 'string') {
            return count + section.content.split(/\s+/).length;
          }
          return count;
        }, 0);
      }
      console.log("Word count calculated:", wordCount);
      
      if (result.metadata) {
        result.metadata.wordCount = wordCount;
      }
      console.log("Metadata updated successfully");
    } catch (wordCountError) {
      console.error("Error in word count calculation:", wordCountError);
      // Don't fail the entire process for word count issues
      if (result.metadata) {
        result.metadata.wordCount = 0;
      }
    }
    
    console.log("Generated flexible CIM document successfully");
    return result as FlexibleCimDocument;
  } catch (error) {
    console.error("Failed to parse flexible CIM response:", error);
    console.error("Response content preview:", content?.substring(0, 500) + "...");
    throw new Error(`Failed to generate CIM document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Type alias for backwards compatibility
type CimAnalysis = LegacyCimAnalysis;

// Legacy CIM analysis function for backwards compatibility
async function makePerplexityRequest(messages: any[]): Promise<CimAnalysis> {
  // Use timeout for external API call (PERF-013)
  const response = await fetchWithTimeout(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "sonar-pro", // Use sonar-pro for better handling with real-time search
      messages,
      max_tokens: 4500, // Reduce token limit to prevent truncation
      temperature: 0.05, // Even lower temperature for more consistent JSON
      top_p: 0.8,
      return_images: false,
      return_related_questions: false,
      stream: false
    })
  }, API_TIMEOUTS.LONG);

  if (!response.ok) {
    const text = await response.text();
    console.error("Perplexity API error:", {
      status: response.status,
      statusText: response.statusText,
      body: text
    });
    throw new Error(`Perplexity API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  try {
    // Extract the content and parse it as JSON
    const contentStr = data.choices[0].message.content;
    
    // Handle different response formats from Perplexity
    let jsonStr = contentStr;
    
    // If response is wrapped in markdown code blocks, extract the JSON
    if (contentStr.includes('```json')) {
      const jsonMatch = contentStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
    } else if (contentStr.includes('```')) {
      const jsonMatch = contentStr.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
    } else {
      // Try to find JSON object in the response
      const matches = contentStr.match(/\{[\s\S]*\}/);
      if (matches) {
        jsonStr = matches[0];
      }
    }

    // Clean up the JSON string before parsing
    let cleanJsonStr = jsonStr.trim();
    
    // Remove any trailing content after the JSON object
    // This handles cases where the AI adds extra text after the JSON
    const firstBrace = cleanJsonStr.indexOf('{');
    if (firstBrace > 0) {
      cleanJsonStr = cleanJsonStr.substring(firstBrace);
    }
    
    // Handle incomplete JSON responses by finding the last complete object
    let openBraces = 0;
    let lastValidIndex = -1;
    
    for (let i = 0; i < cleanJsonStr.length; i++) {
      if (cleanJsonStr[i] === '{') {
        openBraces++;
      } else if (cleanJsonStr[i] === '}') {
        openBraces--;
        if (openBraces === 0) {
          lastValidIndex = i;
        }
      }
    }
    
    // If we found a complete JSON object, use only that part
    if (lastValidIndex > -1) {
      cleanJsonStr = cleanJsonStr.substring(0, lastValidIndex + 1);
    }
    
    // Additional cleaning to fix common JSON formatting issues
    cleanJsonStr = cleanJsonStr
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/([^"\\])\n/g, '$1') // Remove unescaped newlines
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .replace(/\r/g, '') // Remove carriage returns
    
    const analysis = JSON.parse(cleanJsonStr);
    
    // Remove Perplexity source references like [1] [2] [3] from all content in legacy format
    if (analysis && typeof analysis === 'object') {
      Object.keys(analysis).forEach(key => {
        if (typeof analysis[key] === 'string') {
          analysis[key] = analysis[key].replace(/\[\d+\](\s*\[\d+\])*/g, '').trim();
        } else if (analysis[key] && typeof analysis[key] === 'object') {
          Object.keys(analysis[key]).forEach(subKey => {
            if (typeof analysis[key][subKey] === 'string') {
              analysis[key][subKey] = analysis[key][subKey].replace(/\[\d+\](\s*\[\d+\])*/g, '').trim();
            }
          });
        }
      });
    }

    // Validate the response has the required fields
    if (!analysis.story || !analysis.marketAnalysis || !analysis.team) {
      throw new Error("Invalid response format from Perplexity API");
    }

    return analysis;
  } catch (error) {
    console.error("=== PERPLEXITY PARSING ERROR ===");
    console.error("Raw response length:", data.choices[0].message.content?.length || 0);
    console.error("Raw response (first 1000 chars):", data.choices[0].message.content?.substring(0, 1000));
    console.error("Raw response (last 500 chars):", data.choices[0].message.content?.substring(-500));
    console.error("Parse error:", error);
    
    // Try to identify where the JSON breaks
    if (error instanceof SyntaxError) {
      const match = error.message.match(/position (\d+)/);
      if (match) {
        const position = parseInt(match[1]);
        const start = Math.max(0, position - 50);
        const end = Math.min(data.choices[0].message.content.length, position + 50);
        console.error(`Content around error position ${position}:`, 
          data.choices[0].message.content.substring(start, end));
      }
    }
    
    console.error("=== END PARSING ERROR ===");
    throw new Error(`Failed to parse CIM analysis response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function analyzeCimTranscript(transcript: string, customDirections?: string): Promise<CimAnalysis> {
  try {
    console.log("Analyzing transcript with Perplexity API");
    console.log("Custom directions in Perplexity function:", customDirections ? "Present" : "Not provided");
    if (customDirections) {
      console.log("Custom directions length:", customDirections.length, "characters");
    }
    
    // Use custom directions if provided, otherwise fall back to defaults
    const toneInstructions = customDirections ? 
      `Follow these custom style directions: ${customDirections}` : 
      'Use formal, professional business language with industry-specific terminology. Maintain a serious, authoritative tone throughout.';
    const verbosityInstructions = customDirections ?
      'Adjust detail level and writing style according to the custom directions provided above.' :
      'Provide balanced responses with sufficient detail to be informative while remaining readable and well-structured.';
    const audienceInstructions = customDirections ?
      'Tailor the content and language to match the custom directions while maintaining CIM standards.' :
      'Target business executives and sophisticated investors who need comprehensive information for decision-making.';
    
    const result = await makePerplexityRequest([
      {
        role: "system",
        content: `You are a professional business analyst creating a Confidential Information Memorandum (CIM) for potential business buyers. When analyzing the provided transcript, respond with ONLY a JSON object (no other text) that extracts ONLY information explicitly provided in the transcript.

CRITICAL DATA INTEGRITY RULE: If information is not explicitly mentioned in the transcript, use null or leave the field empty. Never generate, assume, estimate, or create synthetic data. Only extract what is actually stated by the user.

${customDirections ? `
PRIORITY WRITING STYLE REQUIREMENTS:
${customDirections}

IMPORTANT: The above custom directions take precedence over all default instructions below. Adjust your writing style, tone, detail level, and approach to fully comply with these specific requirements while maintaining the JSON structure.
` : `
WRITING STYLE CUSTOMIZATIONS:
- Tone: ${toneInstructions}
- Detail Level: ${verbosityInstructions}
- Target Audience: ${audienceInstructions}
`}

Focus especially on:

1. Creating a robust business summary that:
   - Spans at least 4-6 sentences with specific details and metrics (revenues, growth rates, etc.)
   - Highlights key business aspects, competitive advantages, and attractive features
   - Is written as a compelling pitch to potential buyers with convincing investment rationale
   - Includes growth trajectory, market position, and industry context
   - Mentions reason for sale if provided (without speculation if not explicitly mentioned)
   - Emphasizes stability, profitability, and transferability aspects

2. Full, detailed answers in a clear question-answer style:
   - Format responses as if answering direct questions from an interested buyer with sophisticated business knowledge
   - Each field should contain COMPREHENSIVE answers with extensive details (minimum 4-6 sentences per response)
   - Include ONLY specific metrics, numbers, percentages, dollar amounts, timeframes mentioned in the transcript
   - When listing items, include only what is explicitly stated - do not create additional bullet points
   - Use professional language but only describe what is actually mentioned in the transcript
   - For operational processes, describe only what is explicitly explained in the transcript
   - Include only customer and supplier information that is specifically mentioned
   - Provide only financial information that is explicitly stated in the transcript

3. Employee and contractor information - ONLY what is explicitly mentioned:
   - Include only employee and contractor information explicitly stated in the transcript
   - Use only headcounts, titles, roles that are specifically mentioned
   - List only skills, certifications, expertise that are explicitly described
   - Include only tenure information that is actually provided
   - Describe only team structure and culture details that are specifically mentioned
   - If no employee information is provided, use null or minimal information

4. Operations - ONLY extract what is explicitly stated:
   - Include only contract terms actually mentioned in the transcript
   - Use only percentages and specific data that are explicitly provided
   - Include only supplier and customer information that is specifically described
   - List only equipment that is actually mentioned with only stated values
   - Include only inventory information that is explicitly provided
   - Note only arrangements and agreements that are specifically mentioned
   - If operational details are not provided, use null or leave empty

5. Financial and sales information - ONLY extract explicitly stated data:
   - Include only sales channel information specifically mentioned in the transcript
   - Use only pricing information that is explicitly provided
   - Include only order values that are actually stated
   - Describe only seasonality patterns explicitly mentioned
   - Include only payment terms and processes specifically described
   - NEVER include recurring revenue or revenue concentration unless explicitly mentioned
   - Use only margin information that is actually provided
   - Include only sales strategies explicitly described in the transcript

The JSON must follow this exact structure, with full, detailed responses for each field:
{
  "story": {
    "businessSummary": "Comprehensive 4-6 sentence summary highlighting key aspects, metrics, and investment potential",
    "yearStarted": "Founding year with any significant milestone dates",
    "businessIdea": "Detailed origin story with founder's motivation",
    "businessModel": "Thorough explanation of core services/products and revenue model",
    "orderProcess": "Detailed step-by-step process flow from inquiry to delivery",
    "growthHistory": "Specific growth trajectory with metrics and milestones",
    "businessStructure": "Legal structure with ownership details",
    "keyAttractions": ["List of compelling features for buyers with explanations"],
    "saleReason": "Detailed reason for sale if provided, null if not mentioned"
  },
  "executiveSummary": {
    "buyerAttractions": ["Comprehensive list of what makes the business attractive to buyers with detailed explanations"],
    "growthOpportunities": ["Detailed growth opportunities with specific action plans and expected outcomes"]
  },
  "assets": {
    "digitalAssets": ["Complete list of digital assets with metrics, valuations, and performance data"],
    "location": "Business address and detailed facilities information with advantages",
    "equipmentValue": "Detailed estimated value of FF&E with itemized breakdown",
    "equipmentDetails": "Comprehensive description of major equipment with condition assessment and replacement schedule",
    "inventoryDetails": "Thorough description of inventory with valuation methods and turnover rates"
  },
  "ownership": {
    "owners": [{
      "name": "Owner's full name",
      "percentage": "Exact ownership percentage",
      "background": "Detailed background, experience, education, industry expertise, and specific business contributions"
    }],
    "intellectualProperty": ["All trademarks, copyrights, patents, and proprietary assets with registration status and valuation"]
  },
  "marketAnalysis": {
    "uniqueFeatures": ["Comprehensive list of unique business attributes with competitive advantages and defensibility"],
    "customerProfile": "Detailed profile of average customer/client including demographics, behavior patterns, lifetime value, and acquisition sources",
    "saleReason": "Clear and honest explanation of why the business is being sold with contextual details",
    "competitors": ["Top competitors with analysis of their strengths/weaknesses and market positioning"],
    "strengths": ["Business strengths with supporting evidence, metrics, and competitive advantages"]
  },
  "operations": {
    "suppliers": {
      "count": "Exact number of suppliers with categorization by importance",
      "transferability": "Detailed assessment of supplier relationship transferability with specific agreements",
      "concentration": "Precise percentage each major supplier represents with risk assessment",
      "terms": "Specific payment terms with suppliers including discounts and credit arrangements",
      "replaceability": "Detailed assessment of supplier replaceability with alternative sources identified"
    },
    "customers": {
      "recurring": "Only include if explicitly mentioned in transcript, otherwise omit this field entirely",
      "relationships": "Detailed analysis of customer relationships, history, and transferability",
      "concentration": "Only include if explicitly mentioned in transcript, otherwise omit this field entirely",
      "contracts": "Specific contract terms with customers including duration and renewal history",
      "replaceability": "Detailed assessment of customer replaceability and specific acquisition strategies"
    }
  },
  "inventory": {
    "leadTime": "Specific typical lead time for inventory with seasonal variations and contingency plans",
    "sourcing": "Detailed explanation of sourcing strategy including domestic vs international breakdown",
    "storage": "Comprehensive information on inventory storage solutions including costs and capacity",
    "value": "Precise current value of inventory with accounting methods and obsolescence considerations",
    "skuCount": "Exact number of SKUs/services offered with categorization by profitability",
    "topProducts": ["Detailed list of top-selling products/services with performance metrics and margins"]
  },
  "sales": {
    "channels": {"channel": "percentage with year-over-year growth trends"},
    "seasonality": "Comprehensive description of seasonal patterns with monthly breakdown and planning strategies",
    "averageOrderValue": "Precise average order value with trends and upselling opportunities",
    "competitivePricing": "Detailed pricing analysis compared to competitors with positioning strategy",
    "pricingModel": "Comprehensive explanation of pricing strategy with examples and discount structures",
    "paymentMethods": ["All payment methods accepted with processing details and fee structures"],
    "contractTerms": "Specific details about sales contracts, enforcement mechanisms, and standard terms"
  },
  "marketing": {
    "strategies": ["Comprehensive marketing methods with effectiveness metrics and ROI data"],
    "paidAdvertising": {
      "channels": ["All advertising platforms used with budget allocation and performance metrics"],
      "effectiveness": "Detailed assessment of ROI, conversion rates, and campaign performance by channel"
    },
    "emailMarketing": {
      "listSize": "Exact number of email addresses with segmentation details and engagement metrics",
      "usage": "Comprehensive explanation of email marketing strategy, campaigns, and performance data"
    },
    "seoEfforts": "Detailed SEO activities, rankings, traffic statistics, and optimization strategies",
    "clientAcquisition": "Step-by-step process of how new clients are found, converted, and retained"
  },
  "team": {
    "ownerResponsibilities": "Comprehensive breakdown of owner's responsibilities and time allocation by function",
    "ownerHours": "Precise hours worked by owner with seasonal variations and critical tasks requiring attention",
    "employeeSummary": "Detailed overview of team structure, roles, key responsibilities, and growth opportunities",
    "employeeCount": "Exact number of employees with department breakdown and FTE analysis",
    "contractorCount": "Exact number of contractors with role breakdown and engagement terms",
    "turnover": "Precise employee turnover rate with historical trends and retention strategies",
    "hiring": "Detailed hiring process description with candidate sources and success rates",
    "retention": "Comprehensive employee retention strategies with effectiveness metrics",
    "organization": "Detailed explanation of work organization, management systems, and decision processes",
    "keyEmployees": ["Complete list of essential employees with titles, roles, tenure, responsibilities, and contributions"],
    "management": "Comprehensive management structure details including leadership capabilities and transition plans"
  },
  "facility": {
    "ownership": "Detailed owned vs. leased status with property information and strategic advantages",
    "size": "Exact square footage with layout details and utilization efficiency",
    "cost": "Precise monthly lease/mortgage cost with terms and historical trends",
    "leaseDetails": "Comprehensive lease information including length, terms, renewal options, and transferability"
  }
}`
      },
      {
        role: "user",
        content: `Analyze this transcript and respond with ONLY valid JSON in the exact format specified above. Do not include any other text, explanations, or markdown formatting. Ensure all JSON strings are properly escaped and the response ends with a complete closing brace.

CRITICAL DATA INTEGRITY REMINDER: Extract ONLY information explicitly stated in the transcript. If any information is not mentioned, use null or leave empty. Never generate, assume, estimate, or create synthetic data.

Transcript:\n${transcript}`
      }
    ]);

    console.log("Successfully analyzed transcript");
    return result;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// New flexible CIM generation export
export async function generateFlexibleCimDocument(
  transcript: string,
  customDirections: string,
  purpose: string,
  tone: string,
  audience: string,
  financials?: any,
  websiteData?: string,
  sectionDirections?: Array<{id: string; content: string}>,
  formattingProfile?: FormattingProfile,
  customStyleConfig?: CustomStyleConfig | null
): Promise<FlexibleCimDocument> {
  try {
    console.log("Generating flexible CIM document");
    console.log("Parameters:", { purpose, tone, audience, hasFinancials: !!financials, hasWebsiteData: !!websiteData, hasCustomStyle: !!customStyleConfig });

    const result = await generateFlexibleCim(
      transcript,
      customDirections,
      purpose,
      tone,
      audience,
      financials,
      websiteData,
      sectionDirections,
      formattingProfile,
      customStyleConfig
    );

    console.log("Successfully generated flexible CIM document");
    return result;
  } catch (error) {
    console.error("Error generating flexible CIM:", error);
    throw new Error(`Failed to generate flexible CIM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Start website analysis as a Promise - can be called early to run in parallel with other operations
export function startWebsiteAnalysis(websiteUrl?: string): Promise<string | null> {
  if (!websiteUrl?.trim()) {
    console.log('⚠️ No website URL provided, skipping website analysis');
    return Promise.resolve(null);
  }

  console.log('🚀 Starting website analysis in parallel:', websiteUrl);
  return analyzeWebsiteContent(websiteUrl)
    .then(data => {
      if (data) {
        console.log('✅ Website analysis completed successfully');
        console.log('📄 Website data preview:', data.substring(0, 200) + '...');
      } else {
        console.log('⚠️ Website analysis returned no data');
      }
      return data;
    })
    .catch(error => {
      console.error('❌ Website analysis failed with error:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return null;
    });
}

// New comprehensive CIM generation function with website analysis
// Now accepts pre-fetched website data for parallel execution
export async function generateCimWithWebsiteAnalysis(
  transcript: string,
  customDirections: string,
  purpose: string,
  tone: string,
  audience: string,
  financials?: any,
  websiteUrl?: string,
  sectionDirections?: Array<{id: string; content: string}>,
  formattingProfile?: FormattingProfile,
  prefetchedWebsiteData?: string | null, // New parameter for pre-fetched data
  customStyleConfig?: CustomStyleConfig | null
): Promise<FlexibleCimDocument> {
  try {
    console.log('🧠 Generating CIM with optional website analysis');

    let websiteData: string | null = null;

    // Use pre-fetched website data if available, otherwise fetch now (fallback for backwards compatibility)
    if (prefetchedWebsiteData !== undefined) {
      console.log('📦 Using pre-fetched website data');
      websiteData = prefetchedWebsiteData;
    } else if (websiteUrl?.trim()) {
      // Fallback: fetch website data now if not pre-fetched
      console.log('🔍 Analyzing website content (not pre-fetched):', websiteUrl);
      try {
        websiteData = await analyzeWebsiteContent(websiteUrl);
        if (websiteData) {
          console.log('✅ Website analysis completed successfully');
          console.log('📄 Website data preview:', websiteData.substring(0, 200) + '...');
        } else {
          console.log('⚠️ Website analysis returned no data');
        }
      } catch (error) {
        console.error('❌ Website analysis failed with error:', error);
        websiteData = null;
      }
    } else {
      console.log('⚠️ No website URL provided, skipping website analysis');
    }

    // Enhanced directions using section-specific guidance
    let enhancedDirections = customDirections;

    if (sectionDirections && sectionDirections.length > 0) {
      const sectionInstructions = sectionDirections
        .filter(section => section.content && section.content.trim())
        .map(section => section.content)
        .join('\n');

      if (sectionInstructions) {
        enhancedDirections += `\n\nSection-Specific Directions:\n${sectionInstructions}`;
      }
    }

    // Use formattingProfile if provided, otherwise fall back to tone
    const effectiveTone = formattingProfile || tone;

    const result = await generateFlexibleCim(transcript, enhancedDirections, purpose, effectiveTone, audience, financials, websiteData || undefined, sectionDirections, formattingProfile, customStyleConfig);
    console.log('✅ CIM generation with website analysis successful');
    return result;
  } catch (error) {
    console.error('❌ Error generating CIM with website analysis:', error);
    throw error;
  }
}

// Export the website analysis function for standalone use
export { analyzeWebsiteContent };

// Export types for use in other files
export type { FlexibleCimDocument, CimAnalysis };