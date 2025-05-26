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
      max_tokens: 6000, // Increase token limit for longer responses
      temperature: 0.1, // Lower temperature for more consistent JSON
      top_p: 0.9,
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
    
    const analysis = JSON.parse(cleanJsonStr);

    // Validate the response has the required fields
    if (!analysis.story || !analysis.marketAnalysis || !analysis.team) {
      throw new Error("Invalid response format from Perplexity API");
    }

    return analysis;
  } catch (error) {
    console.error("Failed to parse Perplexity response:", data.choices[0].message.content);
    throw new Error("Failed to parse CIM analysis response");
  }
}

export async function analyzeCimTranscript(transcript: string, customDirections?: string): Promise<CimAnalysis> {
  try {
    console.log("Analyzing transcript with Perplexity API");
    console.log("Custom directions in Perplexity function:", customDirections ? "Present" : "Not provided");
    if (customDirections) {
      console.log("Custom directions length:", customDirections.length, "characters");
    }
    const result = await makePerplexityRequest([
      {
        role: "system",
        content: `You are a professional business analyst creating a Confidential Information Memorandum (CIM) for potential business buyers. When analyzing the provided transcript, respond with ONLY a JSON object (no other text) structured to answer key questions about the business in a clear Q&A style format.

${customDirections ? `IMPORTANT: Pay special attention to these custom analysis directions from the user: "${customDirections}". Incorporate these specific requirements throughout your analysis while maintaining the overall CIM structure.` : ''}

Focus especially on:

1. Creating a robust business summary that:
   - Spans at least 4-6 sentences with specific details and metrics (revenues, growth rates, etc.)
   - Highlights key business aspects, competitive advantages, and attractive features
   - Is written as a compelling pitch to potential buyers with convincing investment rationale
   - Includes growth trajectory, market position, and industry context
   - Mentions reason for sale if provided (without speculation if not explicitly mentioned)
   - Emphasizes stability, profitability, and transferability aspects

2. Full, detailed answers in a clear question-answer style:
   - Format responses as if answering direct questions from an interested buyer
   - Each field should contain COMPLETE answers with comprehensive details (minimum 3-4 sentences)
   - Include specifics, numbers, percentages, dollar amounts, and concrete examples
   - When listing items, provide 3-5 bullet points with explanations of 1-3 sentences each
   - Use full sentences, professional business language, and industry-specific terminology
   - For fields asking about processes (like ordering), provide detailed step-by-step explanations
   - Include actual customer/client examples (anonymized) where helpful

3. Employee and contractor information should be comprehensive:
   - Provide a clear, detailed summary of all employees and contractors (at least 3-4 sentences)
   - Include total number of employees and contractors separately with specific headcount
   - List key employee titles, roles, responsibilities, and reporting structure
   - Note specialized skills, certifications, unique expertise, and institutional knowledge
   - Mention length of employment/tenure for all key positions
   - For key employees, explain their specific contributions to business success
   - Detail any succession planning or knowledge transfer processes in place
   - Describe team dynamics and organizational culture

4. Comprehensive details about operations:
   - Detail all customer and supplier contract terms thoroughly with specific terms
   - Provide specific information about customer concentration with exact percentages when available
   - Include explicit details about supplier relationships, including reliability assessments
   - List and describe any significant equipment with estimated values and remaining useful life
   - Include inventory details with specific counts, values, turnover rates, and management procedures
   - Note any special arrangements, exclusive agreements, or unusual terms with clear explanations
   - Describe operational workflows, bottlenecks, and improvement opportunities
   - Explain quality control measures and operational safeguards

5. Financial and sales information:
   - For sales channels, include percentages for each channel with trend information
   - Explain pricing models in detail with specific examples and price points
   - Specify average order values with exact figures and comparison to industry standards
   - Describe seasonality patterns with specific peak/low periods and percentage fluctuations
   - Explain payment terms, contracts, and collection processes in detail
   - Highlight any recurring revenue streams or subscription models with retention metrics
   - Note gross margin information by product/service line when available
   - Include information about sales strategies and customer acquisition costs

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
      "recurring": "If mentioned in transcript: Detailed explanation of recurring revenue patterns with retention rates, or '[NOT MENTIONED]' if not applicable",
      "relationships": "Detailed analysis of customer relationships, history, and transferability",
      "concentration": "If mentioned in transcript: Details about revenue concentration by customer segment with percentages, or '[NOT MENTIONED]' if not applicable",
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
        content: `Analyze this transcript and respond with ONLY the JSON object specified, no other text:\n\n${transcript}`
      }
    ]);

    console.log("Successfully analyzed transcript");
    return result;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}