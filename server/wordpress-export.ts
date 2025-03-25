// Using the node native fetch API instead of the node-fetch package
import { Buffer } from 'buffer';

interface WordPressExportOptions {
  wpUrl: string;
  username: string;
  password: string;
  postId?: number; // Existing post ID if updating
  title: string;
  content: string;
  status?: string; // 'draft', 'publish', 'private'
  excerpt?: string;
  customFields?: Record<string, string | number>; // WordPress custom fields only accept string or number
}

/**
 * Export CIM content to WordPress via REST API
 * This function creates or updates a WordPress post with the CIM data
 */
/**
 * Fetch available Beaver Builder templates from a WordPress site
 * @param wpUrl WordPress site URL
 * @param username WordPress username
 * @param password WordPress password or app password
 * @returns Array of template objects with id, title, and type
 */
export async function fetchBeaverBuilderTemplates(
  wpUrl: string,
  username: string,
  password: string
): Promise<Array<{ id: number; title: string; type: string }>> {
  // Remove www. prefix if present and ensure URL has trailing slash
  let baseUrl = wpUrl.replace(/^https?:\/\/www\./i, 'https://');
  baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  const apiUrl = `${baseUrl}wp-json/wp/v2/fl-builder-template?per_page=50`;
  console.log(`Fetching Beaver Builder templates from: ${apiUrl}`);
  
  try {
    // Set up basic auth
    const authString = Buffer.from(`${username}:${password}`).toString('base64');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`
    };

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch templates:', errorText);
      
      if (response.status === 404) {
        throw new Error('Beaver Builder template post type not found. Is Beaver Builder installed and active?');
      }
      
      throw new Error(`Failed to fetch templates: ${response.statusText}`);
    }
    
    const templates = await response.json();
    return templates.map((template: any) => ({
      id: template.id,
      title: template.title.rendered,
      type: template.meta?.template_type || 'layout'
    }));
  } catch (error) {
    console.error('Error fetching Beaver Builder templates:', error);
    throw error;
  }
}

export async function exportToWordPress(options: WordPressExportOptions): Promise<{
  success: boolean;
  postId?: number;
  url?: string;
  error?: string;
}> {
  const {
    wpUrl,
    username,
    password,
    postId,
    title,
    content,
    status = 'draft',
    excerpt = '',
    customFields = {}
  } = options;

  // Remove www. prefix if present and ensure URL has trailing slash
  let baseUrl = wpUrl.replace(/^https?:\/\/www\./i, 'https://');
  baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  console.log(`Using WordPress base URL: ${baseUrl}`);
  // Use "listing" custom post type instead of "posts"
  const apiUrl = `${baseUrl}wp-json/wp/v2/listing${postId ? `/${postId}` : ''}`;
  console.log(`Using WordPress API endpoint for custom post type: ${apiUrl}`);

  try {
    // Set up basic auth
    const authString = Buffer.from(`${username}:${password}`).toString('base64');
    
    // WordPress sites may require different authentication methods
    // Some may use Basic Auth, others use Application Passwords, and some use nonces
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`
    };

    // Check if the WordPress site is accessible and has REST API enabled
    try {
      const checkResponse = await fetch(`${baseUrl}wp-json/`, {
        method: 'GET',
        headers
      });
      
      if (!checkResponse.ok) {
        // Try to get text response to help diagnose the issue
        const errorText = await checkResponse.text();
        console.log('WordPress API check response:', errorText);
        
        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          throw new Error('The WordPress site returned HTML instead of JSON. Please check that the REST API is enabled and the URL is correct.');
        }
        
        throw new Error(`WordPress API check failed with status ${checkResponse.status}`);
      }
      
      // Make sure we're getting JSON and not HTML
      const contentType = checkResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`WordPress API returned invalid content type: ${contentType}. Expected application/json.`);
      }
      
    } catch (error) {
      console.error('WordPress site check error:', error);
      throw error;
    }

    // WordPress REST API can be different between versions, try the simplest approach
    const postData: Record<string, any> = {};
    
    // Always include these basic fields
    postData.title = title;
    postData.content = content;
    postData.status = status;
    
    if (excerpt) {
      postData.excerpt = excerpt;
    }

    // Add custom fields if needed
    const meta: Record<string, any> = {};
    for (const [key, value] of Object.entries(customFields)) {
      meta[key] = value;
    }

    if (Object.keys(meta).length > 0) {
      Object.assign(postData, { meta });
    }

    console.log(`Making ${postId ? 'PUT' : 'POST'} request to ${apiUrl}`);
    
    // Create or update post
    const response = await fetch(apiUrl, {
      method: postId ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(postData)
    });

    console.log(`WordPress response status: ${response.status}`);
    
    // Check response format before trying to parse as JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error('WordPress non-JSON response:', responseText);
      throw new Error(`WordPress API returned invalid content type: ${contentType}. Expected application/json.`);
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WordPress API error:', errorData);
      
      // Handle specific error cases with better error messages
      if (errorData.code === 'rest_cannot_create') {
        throw new Error('You are not allowed to create posts as this user. Please use an administrator account or a user with Editor role.');
      }
      
      if (errorData.code === 'rest_cannot_edit') {
        throw new Error('You are not allowed to edit posts as this user. Please use an administrator account or a user with Editor role.');
      }
      
      if (errorData.code === 'rest_invalid_param') {
        throw new Error(`Invalid WordPress parameter: ${errorData.message}`);
      }
      
      if (errorData.code === 'rest_no_route') {
        throw new Error(`The WordPress 'listing' custom post type is not available. Please ensure the 'listing' post type is properly registered and accessible via the REST API. You may need to check Toolset Types settings or your WordPress site configuration.`);
      }
      
      throw new Error(errorData.message || 'Failed to export to WordPress');
    }

    const result = await response.json();
    
    return {
      success: true,
      postId: result.id,
      url: result.link
    };
  } catch (error) {
    console.error('WordPress export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Formats CIM analysis data for WordPress export
 */
export function formatWordPressContent(analysis: any): string {
  // Create HTML content with proper WordPress formatting
  return `
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">CONFIDENTIAL INFORMATION MEMORANDUM</h1>
<!-- /wp:heading -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">BUSINESS OVERVIEW</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><strong>Founded:</strong> ${analysis.story?.yearStarted || 'N/A'}<br>
<strong>Structure:</strong> ${analysis.story?.businessStructure || 'N/A'}</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>${analysis.story?.businessSummary || analysis.story?.businessModel || 'N/A'}</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">INVESTMENT HIGHLIGHTS</h2>
<!-- /wp:heading -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Key Attractions</h3>
<!-- /wp:heading -->

<!-- wp:list -->
<ul>
${analysis.executiveSummary?.buyerAttractions?.map((item: string) => `<li>${item}</li>`).join('\n') || '<li>N/A</li>'}
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Growth Opportunities</h3>
<!-- /wp:heading -->

<!-- wp:list -->
<ul>
${analysis.executiveSummary?.growthOpportunities?.map((item: string) => `<li>${item}</li>`).join('\n') || '<li>N/A</li>'}
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">MARKET POSITION</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><strong>Target Market:</strong> ${analysis.marketAnalysis?.customerProfile || 'N/A'}</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Competitors</h3>
<!-- /wp:heading -->

<!-- wp:list -->
<ul>
${analysis.marketAnalysis?.competitors?.map((item: string) => `<li>${item}</li>`).join('\n') || '<li>N/A</li>'}
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Business Strengths</h3>
<!-- /wp:heading -->

<!-- wp:list -->
<ul>
${analysis.marketAnalysis?.strengths?.map((item: string) => `<li>${item}</li>`).join('\n') || '<li>N/A</li>'}
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">OPERATIONS</h2>
<!-- /wp:heading -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Customer Relationships</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><strong>Recurring Revenue:</strong> ${analysis.operations?.customers?.recurring || 'N/A'}<br>
<strong>Customer Base:</strong> ${analysis.operations?.customers?.relationships || 'N/A'}<br>
<strong>Revenue Concentration:</strong> ${analysis.operations?.customers?.concentration || 'N/A'}<br>
<strong>Contract Terms:</strong> ${analysis.operations?.customers?.contracts || 'N/A'}</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Supply Chain</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><strong>Number of Suppliers:</strong> ${analysis.operations?.suppliers?.count || 'N/A'}<br>
<strong>Supplier Terms:</strong> ${analysis.operations?.suppliers?.terms || 'N/A'}<br>
<strong>Concentration:</strong> ${analysis.operations?.suppliers?.concentration || 'N/A'}<br>
<strong>Transferability:</strong> ${analysis.operations?.suppliers?.transferability || 'N/A'}</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">TEAM STRUCTURE</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><strong>Owner Responsibilities:</strong> ${analysis.team?.ownerResponsibilities || 'N/A'}<br>
<strong>Required Hours:</strong> ${analysis.team?.ownerHours || 'N/A'}<br>
<strong>Management Structure:</strong> ${analysis.team?.management || 'N/A'}<br>
<strong>Team Size:</strong> ${analysis.team?.employeeCount || 'N/A'}<br>
<strong>Turnover Rate:</strong> ${analysis.team?.turnover || 'N/A'}<br>
<strong>Retention:</strong> ${analysis.team?.retention || 'N/A'}</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">FACILITIES</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><strong>Ownership Status:</strong> ${analysis.facility?.ownership || 'N/A'}<br>
<strong>Size:</strong> ${analysis.facility?.size || 'N/A'}<br>
<strong>Monthly Cost:</strong> ${analysis.facility?.cost || 'N/A'}
${analysis.facility?.leaseDetails ? `<br><strong>Lease Details:</strong> ${analysis.facility.leaseDetails}` : ''}</p>
<!-- /wp:paragraph -->
  `.trim();
}