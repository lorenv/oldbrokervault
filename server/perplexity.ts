// the newest Perplexity model is llama-3.1-sonar-small-128k-online, use this by default
export const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

type CimAnalysis = {
  story: {
    yearStarted: string;
    businessIdea: string;
    businessModel: string;
    orderProcess: string;
    growthHistory: string;
    businessStructure: string;
    // Add new fields for robust business description
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
    // Add inventory and equipment details
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

async function makePerplexityRequest(messages: any[]): Promise<CimAnalysis> {
  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-large-128k-online", // Use larger model for better handling
      messages,
      max_tokens: 4500, // Reduce token limit to prevent truncation
      temperature: 0.05, // Even lower temperature for more consistent JSON
      top_p: 0.8,
      return_images: false,
      return_related_questions: false,
      stream: false
    })
  });

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