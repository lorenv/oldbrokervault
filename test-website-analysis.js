// Test script to verify website analysis functionality
const fetch = require('node-fetch');

async function testWebsiteAnalysis(websiteUrl) {
  console.log(`Testing website analysis for: ${websiteUrl}`);
  
  try {
    // Clean URL - add protocol if missing
    let cleanUrl = websiteUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    console.log(`Clean URL: ${cleanUrl}`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a business intelligence analyst. Analyze the provided website and extract key business information.`
          },
          {
            role: 'user',
            content: `Analyze this company website: ${cleanUrl}

Please extract:
1. Company name and what they do
2. Services/products offered  
3. Key team members
4. Business model
5. Market focus

Provide a concise summary in 2-3 paragraphs.`
          }
        ],
        max_tokens: 500,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('Website analysis successful:');
    console.log(content);
    console.log('\nCitations:', data.citations);
    
    return content;
  } catch (error) {
    console.error('Website analysis failed:', error.message);
    return null;
  }
}

// Test with Business Exits
testWebsiteAnalysis('www.businessexits.com');