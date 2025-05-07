/**
 * AI-powered website analyzer for CIM generator
 * 
 * This module uses Perplexity AI to analyze websites and enhance CIM data
 * WITHOUT any HTML parsing to avoid JSON errors.
 * 
 * It also includes targeted image extraction for logo and key images
 * that operates independently from the AI analysis to avoid cascading failures.
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as https from 'https';
import * as http from 'http';

/**
 * Analyze a website using Perplexity AI
 * @param websiteUrl The URL of the website to analyze
 * @returns Website information extracted by AI
 */
async function analyzeWebsiteWithAI(websiteUrl: string) {
  console.log(`AI analyzing website: ${websiteUrl}`);
  
  try {
    // Verify API key is present
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error("Missing PERPLEXITY_API_KEY");
      throw new Error("Perplexity API key is required for website analysis");
    }
    
    // Make request to Perplexity API
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You analyze websites and extract business information. Return a structured JSON response with the following fields: companyName, businessDescription, teamInfo, servicesInfo. For any field where you can't find information, return an empty string."
          },
          {
            role: "user",
            content: `Please analyze this website URL: ${websiteUrl}. Extract the company name, business description, team information, and services offered. Respond with a JSON object containing only these fields.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });
    
    // Parse response
    const responseData = await response.json() as any;
    
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      console.error("Invalid Perplexity API response:", responseData);
      throw new Error("Invalid AI response format");
    }
    
    // Extract content
    const aiContent = responseData.choices[0].message.content;
    
    try {
      // Parse JSON response
      const websiteData = JSON.parse(aiContent);
      console.log("Successfully parsed AI website analysis");
      return websiteData;
    } catch (error) {
      console.error("Failed to parse AI response as JSON:", error);
      throw new Error("AI response is not valid JSON");
    }
    
  } catch (error) {
    console.error("Error in AI website analysis:", error);
    return {
      companyName: "Unknown",
      businessDescription: "",
      teamInfo: "",
      servicesInfo: ""
    };
  }
}

/**
 * Integrate website information with CIM analysis
 * @param analysis The CIM analysis from transcript
 * @param websiteData The website data from AI analysis
 * @returns Enhanced and integrated analysis
 */
async function integrateData(analysis: any, websiteData: any) {
  console.log("Integrating website data with CIM analysis");
  
  try {
    // Add detailed validation of input objects
    console.log("INTEGRATE DEBUG: Analyzing input objects");
    console.log("INTEGRATE DEBUG: Analysis type:", typeof analysis);
    console.log("INTEGRATE DEBUG: WebsiteData type:", typeof websiteData);
    
    if (!analysis || typeof analysis !== 'object') {
      console.error("INTEGRATE DEBUG: Invalid analysis object");
      return null;
    }
    
    if (!websiteData || typeof websiteData !== 'object') {
      console.error("INTEGRATE DEBUG: Invalid website data object");
      return null;
    }
    
    // Verify API key is present
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error("INTEGRATE DEBUG: Missing PERPLEXITY_API_KEY");
      throw new Error("Perplexity API key is required for data integration");
    }
    
    // Create context for website data with careful error handling
    let websiteContext = "WEBSITE INFORMATION:\n";
    
    try {
      websiteContext += `Company Name: ${websiteData.companyName || "Unknown"}\n`;
      websiteContext += `Business Description: ${websiteData.businessDescription || ""}\n`;
      websiteContext += `Team Information: ${websiteData.teamInfo || ""}\n`;
      websiteContext += `Services Information: ${websiteData.servicesInfo || ""}\n`;
      console.log("INTEGRATE DEBUG: Website context created successfully");
    } catch (contextError) {
      console.error("INTEGRATE DEBUG: Error creating website context:", contextError);
      websiteContext = "WEBSITE INFORMATION: Error processing website data\n";
    }
    
    // Extract relevant CIM analysis with careful error handling
    let analysisContext = "";
    
    try {
      console.log("INTEGRATE DEBUG: Analysis object keys:", Object.keys(analysis));
      
      if (analysis.story) {
        console.log("INTEGRATE DEBUG: Found story section");
        analysisContext += "TRANSCRIPT INFORMATION:\n";
        
        // Use optional chaining and nullish coalescing for safety
        const yearStarted = analysis.story?.yearStarted ?? "";
        const businessIdea = analysis.story?.businessIdea ?? "";
        const businessModel = analysis.story?.businessModel ?? "";
        const growthHistory = analysis.story?.growthHistory ?? "";
        
        analysisContext += `Business Started: ${yearStarted}\n`;
        analysisContext += `Business Idea: ${businessIdea}\n`;
        analysisContext += `Business Model: ${businessModel}\n`;
        analysisContext += `Growth History: ${growthHistory}\n`;
      }
      
      if (analysis.marketAnalysis) {
        console.log("INTEGRATE DEBUG: Found marketAnalysis section");
        analysisContext += "Market Information:\n";
        
        // Use optional chaining with safety checks
        const customerProfile = analysis.marketAnalysis?.customerProfile ?? "";
        
        // Array handling with careful validation
        let competitors = "";
        if (Array.isArray(analysis.marketAnalysis?.competitors)) {
          competitors = analysis.marketAnalysis.competitors.join(", ");
        }
        
        let strengths = "";
        if (Array.isArray(analysis.marketAnalysis?.strengths)) {
          strengths = analysis.marketAnalysis.strengths.join(", ");
        }
        
        analysisContext += `Customer Profile: ${customerProfile}\n`;
        analysisContext += `Competitors: ${competitors}\n`;
        analysisContext += `Strengths: ${strengths}\n`;
      }
    } catch (error) {
      console.error("INTEGRATE DEBUG: Error preparing analysis context:", error);
      analysisContext = "TRANSCRIPT INFORMATION: Error extracting transcript information\n";
    }
    
    // Make integration request to Perplexity with careful error handling
    console.log("INTEGRATE DEBUG: Preparing Perplexity API request");
    
    try {
      console.log("INTEGRATE DEBUG: Creating request payload");
      const requestBody = {
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You are an expert business analyst who creates Confidential Information Memorandums (CIMs) for business sales. Create enhanced CIM content by integrating website information with transcript data. Where information conflicts, prioritize transcript data but use website data for additional context and details."
          },
          {
            role: "user",
            content: `I have information from two sources about a business:

${websiteContext}

${analysisContext}

Please integrate this information to enhance the CIM. For any inconsistencies between sources, prioritize the transcript data but enhance it with website details. Return a JSON object that enhances the story and marketing sections with combined insights from both sources. Format as:
{
  "enhancedStory": {
    "businessSummary": "",
    "businessModel": "",
    "ownerBackground": ""
  },
  "enhancedMarket": {
    "customerProfile": "",
    "uniqueFeatures": []
  },
  "recommendedHighlights": []
}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      };
      
      // Test stringification before sending
      try {
        const testStringify = JSON.stringify(requestBody);
        console.log("INTEGRATE DEBUG: Request payload is valid JSON, length:", testStringify.length);
      } catch (jsonError) {
        console.error("INTEGRATE DEBUG: Request body JSON error:", jsonError);
        return null;
      }
      
      console.log("INTEGRATE DEBUG: Sending request to Perplexity API");
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log("INTEGRATE DEBUG: Received response from Perplexity API, status:", response.status);
      
      if (!response.ok) {
        console.error("INTEGRATE DEBUG: Perplexity API error, status:", response.status);
        const errorText = await response.text();
        console.error("INTEGRATE DEBUG: Error text:", errorText);
        return null;
      }
      
      // Parse response with careful error handling
      let responseData;
      try {
        responseData = await response.json() as any;
        console.log("INTEGRATE DEBUG: Successfully parsed response as JSON");
      } catch (jsonError) {
        console.error("INTEGRATE DEBUG: Response JSON parse error:", jsonError);
        const responseText = await response.text();
        console.error("INTEGRATE DEBUG: Raw response text:", responseText.substring(0, 500) + "...");
        return null;
      }
      
      if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
        console.error("INTEGRATE DEBUG: Invalid Perplexity API response structure:", 
          JSON.stringify(responseData).substring(0, 500) + "...");
        return null;
      }
      
      // Extract content with validation
      console.log("INTEGRATE DEBUG: Extracting message content");
      const aiContent = responseData.choices[0].message.content;
      
      if (!aiContent || typeof aiContent !== 'string') {
        console.error("INTEGRATE DEBUG: Invalid message content:", aiContent);
        return null;
      }
      
      try {
        // Parse JSON response
        console.log("INTEGRATE DEBUG: Parsing message content as JSON");
        const integratedData = JSON.parse(aiContent);
        console.log("INTEGRATE DEBUG: Successfully parsed AI integration data");
        
        // Verify structure of integrated data
        console.log("INTEGRATE DEBUG: Verifying data structure, keys:", Object.keys(integratedData));
        
        return integratedData;
      } catch (error) {
        console.error("INTEGRATE DEBUG: Failed to parse integration response as JSON:", error);
        console.error("INTEGRATE DEBUG: Raw content:", aiContent.substring(0, 500) + "...");
        return null;
      }
    } catch (requestError) {
      console.error("INTEGRATE DEBUG: Error making API request:", requestError);
      return null;
    }
    
  } catch (error) {
    console.error("Error integrating data:", error);
    return null;
  }
}

/**
 * Safely extract image URLs from a website
 * This function uses isolated try/catch blocks for each operation
 * so failure in one doesn't affect the others
 */
async function extractWebsiteImages(url: string): Promise<{
  logo: string | null;
  images: Array<string>;
}> {
  console.log(`Extracting images from website: ${url}`);
  
  // Initialize result
  const result: {
    logo: string | null,
    images: Array<string>
  } = {
    logo: null,
    images: []
  };
  
  try {
    // Fetch the website content
    const websiteContent = await fetchWithTimeout(url, 10000);
    
    if (!websiteContent) {
      console.error("Failed to fetch website content");
      return result;
    }
    
    // Load into cheerio
    const $ = cheerio.load(websiteContent);
    
    // Try to extract logo (isolated in try/catch)
    try {
      console.log("Attempting to extract logo...");
      // Common logo selectors and patterns
      const logoSelectors = [
        'header img[src*="logo"]',
        'img[src*="logo"]',
        'a.logo img',
        'img.logo',
        '.logo img',
        '.navbar-brand img',
        '.site-logo img',
        'img[alt*="logo"]'
      ];
      
      // Try each selector
      for (const selector of logoSelectors) {
        const logo = $(selector).first();
        if (logo.length) {
          const logoSrc = $(logo).attr('src');
          if (logoSrc) {
            // Convert relative URL to absolute
            const logoUrl = new URL(logoSrc, url).href;
            console.log(`Logo found: ${logoUrl}`);
            
            // Download and convert to base64
            try {
              const logoBase64 = await downloadImageAsBase64(logoUrl);
              if (logoBase64) {
                result.logo = logoBase64 as string;
                break;
              }
            } catch (imgError) {
              console.error("Error downloading logo:", imgError);
            }
          }
        }
      }
    } catch (logoError) {
      console.error("Error extracting logo:", logoError);
    }
    
    // Try to extract key images (isolated in try/catch)
    try {
      console.log("Attempting to extract key images...");
      
      // Look for significant images (hero images, large images, slider images)
      const imageSelectors = [
        // Hero and banner images
        '.hero img', 
        '.banner img',
        '.carousel img',
        '.slider img',
        // Main content area images
        'main img',
        '.content img',
        // Large images
        'img[width][height]',
        // Fallback to any images
        'img'
      ];
      
      const downloadedImages = new Set<string>();
      
      // Try each selector
      for (const selector of imageSelectors) {
        if (result.images.length >= 3) break; // Max 3 images
        
        $(selector).each((i, el) => {
          if (result.images.length >= 3) return false; // Max 3 images
          
          const imgSrc = $(el).attr('src');
          if (!imgSrc) return true;
          
          // Skip tiny icons, data URLs, and SVGs
          if (imgSrc.startsWith('data:') || imgSrc.endsWith('.svg') || imgSrc.includes('icon')) {
            return true;
          }
          
          try {
            // Get image dimensions if available
            const width = parseInt($(el).attr('width') || '0');
            const height = parseInt($(el).attr('height') || '0');
            
            // Skip very small images
            if (width > 0 && height > 0 && (width < 100 || height < 100)) {
              return true;
            }
            
            // Convert relative URL to absolute
            const imgUrl = new URL(imgSrc, url).href;
            
            // Skip if we've already processed this URL
            if (downloadedImages.has(imgUrl)) return true;
            
            // Download image (async but we'll collect promises and wait later)
            downloadedImages.add(imgUrl);
            
            // Process the image
            downloadImageAsBase64(imgUrl)
              .then(base64 => {
                if (base64 && result.images.length < 3) {
                  result.images.push(base64);
                }
              })
              .catch(err => {
                console.error(`Error downloading image ${imgUrl}:`, err);
              });
          } catch (imgError) {
            // Suppress individual image errors
          }
          
          return true;
        });
      }
      
      // Wait a moment for image downloads to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`Found ${result.images.length} key images`);
    } catch (imagesError) {
      console.error("Error extracting images:", imagesError);
    }
    
  } catch (error) {
    console.error("Error in website image extraction:", error);
  }
  
  return result;
}

/**
 * Helper function to fetch with timeout
 */
async function fetchWithTimeout(url: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // Choose protocol based on URL
    const httpModule = url.startsWith('https:') ? https : http;
    
    const req = httpModule.get(url, { timeout }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const newUrl = res.headers.location;
        if (!newUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        
        console.log(`Following redirect to ${newUrl}`);
        fetchWithTimeout(newUrl, timeout)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      // Check for successful response
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP error: ${res.statusCode}`));
        return;
      }
      
      // Collect response data
      let data = '';
      res.setEncoding('utf8');
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    // Ensure request is sent
    req.end();
  });
}

/**
 * Download an image and convert it to base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    // Choose protocol based on URL
    const httpModule = imageUrl.startsWith('https:') ? https : http;
    
    const req = httpModule.get(imageUrl, { timeout: 5000 }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const newUrl = res.headers.location;
        if (!newUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        
        downloadImageAsBase64(newUrl)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      // Check for successful response
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP error: ${res.statusCode}`));
        return;
      }
      
      // Check content type
      const contentType = res.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        reject(new Error(`Not an image: ${contentType}`));
        return;
      }
      
      // Collect image data
      const chunks: Buffer[] = [];
      
      res.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          // Include MIME type in data URL
          const dataUrl = `data:${contentType};base64,${base64}`;
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    // Ensure request is sent
    req.end();
  });
}

/**
 * Main function to enhance CIM analysis with website data
 * @param analysis The CIM analysis from transcript
 * @param websiteUrl The URL of the website to analyze
 * @returns Enhanced analysis with integrated website information
 */
export async function enhanceCimWithWebsite(analysis: any, websiteUrl: string): Promise<any> {
  console.log(`Enhancing CIM with website: ${websiteUrl}`);
  
  // Input validation
  if (!analysis || typeof analysis !== 'object') {
    console.error("Invalid analysis object provided");
    throw new Error("Valid analysis object required");
  }
  
  if (!websiteUrl || websiteUrl.trim() === '') {
    console.error("Empty website URL provided");
    return analysis; // Return unmodified analysis
  }
  
  try {
    // Add extra debugging for the analysis object
    console.log("DEBUG: Analysis object type:", typeof analysis);
    console.log("DEBUG: Analysis object keys:", Object.keys(analysis));
    
    try {
      // Test JSON serialization of input analysis
      const testJson = JSON.stringify(analysis);
      console.log("DEBUG: Input analysis is valid JSON, length:", testJson.length);
    } catch (jsonError) {
      console.error("DEBUG: Input analysis JSON serialization error:", jsonError);
      throw new Error("Input analysis cannot be serialized to JSON: " + String(jsonError));
    }
    
    // Create deep clone of analysis to avoid mutations
    let enhancedAnalysis;
    try {
      const analysisJson = JSON.stringify(analysis);
      enhancedAnalysis = JSON.parse(analysisJson);
      console.log("DEBUG: Successfully cloned analysis object");
    } catch (cloneError) {
      console.error("DEBUG: Error cloning analysis:", cloneError);
      throw new Error("Failed to clone analysis: " + String(cloneError));
    }
    
    // Run website AI analysis and image extraction in parallel
    // If one fails, the other can still succeed
    console.log("DEBUG: Starting parallel website analysis tasks");
    const [websiteData, websiteImages] = await Promise.allSettled([
      analyzeWebsiteWithAI(websiteUrl),
      extractWebsiteImages(websiteUrl)
    ]);
    
    // Process AI analysis results
    if (websiteData.status === 'fulfilled') {
      console.log("Website AI analysis complete");
      
      // Step 2: Add raw website data to analysis
      enhancedAnalysis.website = {
        url: websiteUrl,
        companyName: websiteData.value.companyName || "",
        businessDescription: websiteData.value.businessDescription || "",
        teamInfo: websiteData.value.teamInfo || "",
        servicesInfo: websiteData.value.servicesInfo || ""
      };
    } else {
      console.error("Website AI analysis failed:", websiteData.reason);
      enhancedAnalysis.website = {
        url: websiteUrl,
        companyName: "",
        businessDescription: "",
        teamInfo: "",
        servicesInfo: ""
      };
    }
    
    // Process image extraction results
    if (websiteImages.status === 'fulfilled') {
      console.log("Website image extraction complete");
      
      // Add images to website data
      enhancedAnalysis.website.logo = websiteImages.value.logo;
      enhancedAnalysis.website.images = websiteImages.value.images;
      
      console.log(`Added ${websiteImages.value.logo ? '1' : '0'} logo and ${websiteImages.value.images.length} images to analysis`);
    } else {
      console.error("Website image extraction failed:", websiteImages.reason);
      // Set empty image data
      enhancedAnalysis.website.logo = null;
      enhancedAnalysis.website.images = [];
    }
    
    // Step 3: Integrate website data with transcript analysis
    let integrated = null;
    
    if (websiteData.status === 'fulfilled') {
      try {
        integrated = await integrateData(analysis, websiteData.value);
      } catch (integrationError) {
        console.error("Data integration error:", integrationError);
      }
    }
    
    if (integrated) {
      console.log("Successfully integrated website and transcript data");
      
      // Step 4: Enhance analysis with integrated data
      if (integrated.enhancedStory) {
        // Add to executive summary
        if (enhancedAnalysis.executiveSummary && integrated.enhancedStory.businessSummary) {
          enhancedAnalysis.executiveSummary.businessSummary = integrated.enhancedStory.businessSummary;
        }
        
        // Enhance story section
        if (enhancedAnalysis.story) {
          if (integrated.enhancedStory.businessModel) {
            enhancedAnalysis.story.businessModel = integrated.enhancedStory.businessModel;
          }
          if (integrated.enhancedStory.businessSummary) {
            enhancedAnalysis.story.businessSummary = integrated.enhancedStory.businessSummary;
          }
        }
      }
      
      // Enhance market analysis
      if (integrated.enhancedMarket && enhancedAnalysis.marketAnalysis) {
        if (integrated.enhancedMarket.customerProfile) {
          enhancedAnalysis.marketAnalysis.customerProfile = integrated.enhancedMarket.customerProfile;
        }
        
        if (integrated.enhancedMarket.uniqueFeatures && 
            Array.isArray(integrated.enhancedMarket.uniqueFeatures) && 
            integrated.enhancedMarket.uniqueFeatures.length > 0) {
          enhancedAnalysis.marketAnalysis.uniqueFeatures = integrated.enhancedMarket.uniqueFeatures;
        }
      }
      
      // Add highlights to executive summary
      if (integrated.recommendedHighlights && 
          Array.isArray(integrated.recommendedHighlights) && 
          integrated.recommendedHighlights.length > 0 &&
          enhancedAnalysis.executiveSummary) {
        enhancedAnalysis.executiveSummary.integratedHighlights = integrated.recommendedHighlights;
      }
    }
    
    console.log("Enhanced analysis created successfully");
    return enhancedAnalysis;
    
  } catch (error) {
    console.error("Website enhancement error:", error);
    // Return original analysis if enhancement fails
    return analysis;
  }
}