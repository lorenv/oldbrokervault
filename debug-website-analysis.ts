// Comprehensive website analysis debugging script
import fetch from 'node-fetch';

async function testPerplexityAPI() {
  console.log('=== TESTING PERPLEXITY API ===');
  
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY not found');
    return false;
  }
  
  console.log('✅ API key is present');
  
  try {
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
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'What is 2+2? Answer briefly.'
          }
        ],
        max_tokens: 50,
        temperature: 0.2
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API error:', errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ Basic API test successful');
    console.log('Response:', data.choices[0].message.content);
    return true;
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    return false;
  }
}

async function testWebsiteAnalysis(websiteUrl: string) {
  console.log(`\n=== TESTING WEBSITE ANALYSIS: ${websiteUrl} ===`);
  
  // Test different URL formats
  const urlVariations = [
    websiteUrl,
    websiteUrl.replace(/^https?:\/\//, ''),
    `https://${websiteUrl.replace(/^https?:\/\//, '')}`,
    `http://${websiteUrl.replace(/^https?:\/\//, '')}`
  ];
  
  console.log('Testing URL variations:', urlVariations);
  
  for (const testUrl of urlVariations) {
    try {
      console.log(`\n--- Testing: ${testUrl} ---`);
      
      // Clean URL
      let cleanUrl = testUrl.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      
      console.log('Clean URL:', cleanUrl);
      
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

Please extract and structure the following information if available:

1. COMPANY OVERVIEW:
   - Company name and tagline
   - Mission/vision statements  
   - Year founded and company history
   - Business description and core activities

2. SERVICES & PRODUCTS:
   - Primary products or services offered
   - Key features and capabilities
   - Target markets and customer segments

3. TEAM & LEADERSHIP:
   - Key executives and leadership team
   - Team size and organizational structure

Provide a concise summary in 2-3 paragraphs.`
            }
          ],
          max_tokens: 800,
          temperature: 0.2,
          search_domain_filter: undefined,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: 'month'
        })
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error:', errorText);
        continue;
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      console.log('✅ Website analysis successful for:', testUrl);
      console.log('📄 Content preview:', content.substring(0, 300) + '...');
      console.log('🔗 Citations:', data.citations?.length || 0, 'sources');
      
      if (data.citations && data.citations.length > 0) {
        console.log('First citation:', data.citations[0]);
      }
      
      return content;
    } catch (error) {
      console.error(`❌ Failed for ${testUrl}:`, error.message);
    }
  }
  
  return null;
}

async function runDebugTests() {
  console.log('🔍 Starting comprehensive website analysis debugging...\n');
  
  // Test basic API functionality
  const apiWorks = await testPerplexityAPI();
  if (!apiWorks) {
    console.log('❌ Basic API test failed - stopping debug');
    return;
  }
  
  // Test website analysis with different URLs
  const testUrls = [
    'businessexits.com',
    'www.businessexits.com', 
    'https://www.businessexits.com',
    'apple.com',
    'www.apple.com'
  ];
  
  for (const url of testUrls) {
    await testWebsiteAnalysis(url);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
  
  console.log('\n🏁 Debug testing complete');
}

runDebugTests().catch(console.error);