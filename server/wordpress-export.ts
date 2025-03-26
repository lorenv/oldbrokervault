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
  useToolsetFields?: boolean; // Whether to use Toolset fields for export
  postType?: string; // The WordPress post type to use (default: 'listing')
}

interface ToolsetField {
  id: string;
  slug: string;
  name: string;
  description?: string;
  type: string;
  group: string;
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
      
      if (response.status === 403) {
        throw new Error('You do not have permission to access templates. Use an administrator account or a user with proper permissions.');
      }
      
      throw new Error(`Failed to fetch templates: ${response.statusText}`);
    }
    
    let templates;
    const contentType = response.headers.get('content-type') || '';
    
    // Check if the response is actually JSON
    if (!contentType.includes('application/json')) {
      console.error('WordPress returned non-JSON content type:', contentType);
      throw new Error('HTML instead of JSON was returned. Please check that the WordPress REST API is enabled and the site URL is correct.');
    }
    
    try {
      templates = await response.json();
    } catch (error) {
      console.error('Error parsing JSON response:', error);
      throw new Error('Could not parse response from WordPress. The site might be returning HTML instead of JSON.');
    }
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
  fieldsUpdated?: number;
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
    customFields = {},
    useToolsetFields = false,
    postType = 'listing'
  } = options;

  // Remove www. prefix if present and ensure URL has trailing slash
  let baseUrl = wpUrl.replace(/^https?:\/\/www\./i, 'https://');
  baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  console.log(`Using WordPress base URL: ${baseUrl}`);
  // Use the specified post type (defaults to "listing")
  const apiUrl = `${baseUrl}wp-json/wp/v2/${postType}${postId ? `/${postId}` : ''}`;
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
        // Try to get the response text to better diagnose the issue
        const responseText = await checkResponse.text();
        console.error('WordPress API check response text:', responseText.substring(0, 500)); // Log first 500 chars to avoid huge logs
        
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          throw new Error('The WordPress site returned HTML instead of JSON. Please check that the REST API is enabled and the site URL is correct.');
        }
        
        throw new Error(`WordPress API returned invalid content type: ${contentType || 'unknown'}. Expected application/json.`);
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
    
    if (useToolsetFields) {
      try {
        console.log(`Fetching Toolset fields for post type: ${postType}`);
        const toolsetFields = await fetchToolsetFields(wpUrl, username, password, postType);
        
        if (toolsetFields.length === 0) {
          console.warn('No Toolset fields found. Falling back to standard custom field approach.');
          
          // If no Toolset fields were found, use the default approach
          for (const [key, value] of Object.entries(customFields)) {
            meta[key] = value;
          }
        } else {
          console.log(`Found ${toolsetFields.length} Toolset fields. Mapping analysis data to fields.`);
          
          // Parse the content as JSON to get the analysis data
          let analysis;
          try {
            // Check if content is passed as an object or a JSON string
            if (typeof content === 'string') {
              // Try to see if it's a JSON string
              if (content.trim().startsWith('{')) {
                analysis = JSON.parse(content);
              } else {
                // It's regular content, just use customFields
                for (const [key, value] of Object.entries(customFields)) {
                  meta[key] = value;
                }
              }
            } else {
              analysis = content;
            }
            
            if (analysis) {
              // Map the analysis data to Toolset fields
              const fieldMappings = mapCimToToolsetFields(analysis, toolsetFields);
              
              // Add the mapped fields to the meta object
              Object.assign(meta, fieldMappings);
              
              console.log(`Mapped ${Object.keys(fieldMappings).length} Toolset fields.`);
            }
          } catch (error) {
            console.error('Error parsing analysis data:', error);
            // Fall back to using the custom fields if an error occurs
            for (const [key, value] of Object.entries(customFields)) {
              meta[key] = value;
            }
          }
        }
      } catch (error) {
        console.error('Error handling Toolset fields:', error);
        // Fall back to using the custom fields if an error occurs
        for (const [key, value] of Object.entries(customFields)) {
          meta[key] = value;
        }
      }
    } else {
      // Standard approach - just use the custom fields
      for (const [key, value] of Object.entries(customFields)) {
        meta[key] = value;
      }
    }

    if (Object.keys(meta).length > 0) {
      // Logging field mappings for debugging
      console.log("Assigning WordPress meta fields:");
      for (const [fieldId, fieldValue] of Object.entries(meta)) {
        console.log(`  ${fieldId}: ${typeof fieldValue === 'string' ? fieldValue.substring(0, 50) + (fieldValue.length > 50 ? '...' : '') : fieldValue}`);
      }
      
      // In WordPress meta fields must be assigned directly in the top level of the post data
      // Some WordPress configurations may require 'meta' object instead of direct assignment
      // Try both approaches to ensure compatibility
      
      // First approach - direct meta field assignment
      for (const [key, value] of Object.entries(meta)) {
        postData[key] = value;
      }
      
      // Second approach - use 'meta' object which works with some WordPress setups
      postData.meta = meta;
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
      console.error('WordPress non-JSON response:', responseText.substring(0, 500)); // Log first 500 chars
      
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error('The WordPress site returned HTML instead of JSON. This typically happens when there is a problem with the REST API endpoint or when the "listing" custom post type is not properly registered or accessible via REST API.');
      }
      
      throw new Error(`WordPress API returned invalid content type: ${contentType || 'unknown'}. Expected application/json.`);
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
      url: result.link,
      fieldsUpdated: Object.keys(meta).length
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
 * Fetches Toolset custom field definitions from WordPress
 * @param wpUrl WordPress site URL
 * @param username WordPress username
 * @param password WordPress password or app password
 * @param postType The post type to fetch fields for
 * @returns Array of Toolset field objects
 */
export async function fetchToolsetFields(
  wpUrl: string,
  username: string,
  password: string,
  postType: string = 'listings'
): Promise<ToolsetField[]> {
  // Remove www. prefix if present and ensure URL has trailing slash
  let baseUrl = wpUrl.replace(/^https?:\/\/www\./i, 'https://');
  baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  // First, get a sample post to extract field structure
  const apiUrl = `${baseUrl}wp-json/wp/v2/${postType}?per_page=1`;
  console.log(`Fetching Toolset fields metadata from: ${apiUrl}`);
  
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
      console.error('Failed to fetch Toolset fields:', errorText);
      
      if (response.status === 404) {
        throw new Error(`The post type "${postType}" was not found. Please check that it exists and is accessible via the REST API.`);
      }
      
      if (response.status === 403) {
        throw new Error('You do not have permission to access this post type. Use an administrator account or a user with proper permissions.');
      }
      
      throw new Error(`Failed to fetch Toolset fields: ${response.statusText}`);
    }
    
    let posts;
    const contentType = response.headers.get('content-type') || '';
    
    // Check if the response is actually JSON
    if (!contentType.includes('application/json')) {
      console.error('WordPress returned non-JSON content type:', contentType);
      throw new Error('HTML instead of JSON was returned. Please check that the REST API is enabled and the site URL is correct.');
    }
    
    try {
      posts = await response.json();
    } catch (error) {
      console.error('Error parsing JSON response:', error);
      throw new Error('Could not parse response from WordPress. The site might be returning HTML instead of JSON.');
    }

    if (!posts || posts.length === 0) {
      console.warn(`No posts found for post type "${postType}". Creating a temporary empty fields list.`);
      // Let's create some default fields that match our expected CIM data structure
      return [
        // Business Overview fields
        {
          id: 'wpcf-business-summary',
          slug: 'business-summary',
          name: 'Business Summary',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-year-started',
          slug: 'year-started',
          name: 'Year Started',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-business-structure',
          slug: 'business-structure',
          name: 'Business Structure',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-business-model',
          slug: 'business-model',
          name: 'Business Model',
          type: 'text',
          group: 'Listing Details'
        },
        // Market Analysis fields
        {
          id: 'wpcf-customer-profile',
          slug: 'customer-profile',
          name: 'Customer Profile',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-competitors',
          slug: 'competitors',
          name: 'Competitors',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-strengths',
          slug: 'strengths',
          name: 'Strengths',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-sale-reason',
          slug: 'sale-reason',
          name: 'Reason for Sale',
          type: 'text',
          group: 'Listing Details'
        },
        // Operations fields
        {
          id: 'wpcf-recurring-revenue',
          slug: 'recurring-revenue',
          name: 'Recurring Revenue',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-customer-relationships',
          slug: 'customer-relationships',
          name: 'Customer Relationships',
          type: 'text',
          group: 'Listing Details'
        },
        // Team fields
        {
          id: 'wpcf-owner-responsibilities',
          slug: 'owner-responsibilities',
          name: 'Owner Responsibilities',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-owner-hours',
          slug: 'owner-hours',
          name: 'Owner Hours',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-employee-count',
          slug: 'employee-count',
          name: 'Employee Count',
          type: 'text',
          group: 'Listing Details'
        }
      ];
    }

    // Extract Toolset meta fields
    const post = posts[0];
    
    // Try to detect Toolset fields via different properties
    let toolsetMeta: any = {};
    
    if (post['toolset-meta']) {
      console.log('Found Toolset metadata via toolset-meta property');
      toolsetMeta = post['toolset-meta'];
    } else if (post['meta'] && Object.keys(post['meta']).some(key => key.startsWith('wpcf-'))) {
      console.log('Found Toolset metadata via meta property with wpcf- prefix');
      // Extract fields that start with wpcf-
      toolsetMeta = Object.fromEntries(
        Object.entries(post['meta'])
          .filter(([key]) => key.startsWith('wpcf-'))
          .map(([key, value]) => [key.replace('wpcf-', ''), value])
      );
    } else {
      console.warn('No Toolset fields detected in WordPress API response. Using default fields.');
      // If no Toolset fields found, create comprehensive default fields
      // that match our CIM data structure for best compatibility
      return [
        // Business Overview fields
        {
          id: 'wpcf-business-summary',
          slug: 'business-summary',
          name: 'Business Summary',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-year-started',
          slug: 'year-started',
          name: 'Year Started',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-business-structure',
          slug: 'business-structure',
          name: 'Business Structure',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-business-model',
          slug: 'business-model',
          name: 'Business Model',
          type: 'text',
          group: 'Listing Details'
        },
        // Market Analysis fields
        {
          id: 'wpcf-customer-profile',
          slug: 'customer-profile',
          name: 'Customer Profile',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-competitors',
          slug: 'competitors',
          name: 'Competitors',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-strengths',
          slug: 'strengths',
          name: 'Strengths',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-sale-reason',
          slug: 'sale-reason',
          name: 'Reason for Sale',
          type: 'text',
          group: 'Listing Details'
        },
        // Operations fields
        {
          id: 'wpcf-recurring-revenue',
          slug: 'recurring-revenue',
          name: 'Recurring Revenue',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-customer-relationships',
          slug: 'customer-relationships',
          name: 'Customer Relationships',
          type: 'text',
          group: 'Listing Details'
        },
        // Team fields
        {
          id: 'wpcf-owner-responsibilities',
          slug: 'owner-responsibilities',
          name: 'Owner Responsibilities',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-owner-hours',
          slug: 'owner-hours',
          name: 'Owner Hours',
          type: 'text',
          group: 'Listing Details'
        },
        {
          id: 'wpcf-employee-count',
          slug: 'employee-count',
          name: 'Employee Count',
          type: 'text',
          group: 'Listing Details'
        }
      ];
    }

    // Debug output
    console.log(`Found Toolset fields: ${Object.keys(toolsetMeta).join(', ')}`);

    // Convert toolset-meta fields to our ToolsetField format
    const toolsetFields: ToolsetField[] = [];

    for (const [key, value] of Object.entries(toolsetMeta)) {
      const slug = key;
      const name = slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      toolsetFields.push({
        id: `wpcf-${slug}`, // Prefix with wpcf- as that's what Toolset uses
        slug,
        name,
        type: 'text', // Assume text for now
        group: 'Listing Details'
      });
    }

    return toolsetFields;
  } catch (error) {
    console.error('Error fetching Toolset fields:', error);
    throw error;
  }
}

/**
 * Maps CIM analysis data to Toolset fields
 * @param analysis The CIM analysis data
 * @param fields Array of Toolset fields
 * @returns Record mapping field IDs to values
 */
export function mapCimToToolsetFields(analysis: any, fields: ToolsetField[]): Record<string, string> {
  console.log("Mapping CIM data to Toolset fields. Fields found:", fields.map(f => f.slug).join(", "));
  console.log("Analysis data structure:", Object.keys(analysis).join(", "));
  
  const fieldMapping: Record<string, string> = {};

  // First create mappings for all fields to ensure no fields are missed
  for (const field of fields) {
    // Default value before mapping
    fieldMapping[field.id] = "Not specified in transcript";
  }

  // Then map specific fields based on the field slugs
  fields.forEach(field => {
    // Simple mapping strategy based on field slugs
    const slug = field.slug.toLowerCase();
    console.log(`Trying to map field: ${slug}`);

    // Try to find relevant data in the analysis based on the field name
    let value = "Not specified in transcript";

    // Business Overview fields
    if (slug.includes('year-started') || slug.includes('founded')) {
      value = analysis.story?.yearStarted || value;
      console.log(`Mapped '${slug}' to:`, value);
    } 
    else if (slug.includes('structure') || slug.includes('entity-type')) {
      value = analysis.story?.businessStructure || value;
      console.log(`Mapped '${slug}' to:`, value);
    }
    else if (slug.includes('business-model')) {
      value = analysis.story?.businessModel || value;
      console.log(`Mapped '${slug}' to:`, value);
    }
    else if (slug.includes('summary') || slug.includes('description')) {
      value = analysis.story?.businessSummary || value;
      console.log(`Mapped '${slug}' to:`, value);
    }
    else if (slug.includes('growth-history')) {
      value = analysis.story?.growthHistory || value;
      console.log(`Mapped '${slug}' to:`, value);
    }

    // Executive Summary fields
    else if (slug.includes('attractions') || slug.includes('highlights')) {
      if (analysis.executiveSummary?.buyerAttractions?.length > 0) {
        value = analysis.executiveSummary.buyerAttractions.join('\n\n');
        console.log(`Mapped '${slug}' to array of ${analysis.executiveSummary.buyerAttractions.length} items`);
      }
    }
    else if (slug.includes('opportunities')) {
      if (analysis.executiveSummary?.growthOpportunities?.length > 0) {
        value = analysis.executiveSummary.growthOpportunities.join('\n\n');
        console.log(`Mapped '${slug}' to array of ${analysis.executiveSummary.growthOpportunities.length} items`);
      }
    }

    // Market Analysis fields
    else if (slug.includes('target-market') || slug.includes('customer-profile')) {
      value = analysis.marketAnalysis?.customerProfile || value;
      console.log(`Mapped '${slug}' to:`, value);
    }
    else if (slug.includes('competitors')) {
      if (analysis.marketAnalysis?.competitors?.length > 0) {
        value = analysis.marketAnalysis.competitors.join('\n\n');
      }
    }
    else if (slug.includes('strengths')) {
      if (analysis.marketAnalysis?.strengths?.length > 0) {
        value = analysis.marketAnalysis.strengths.join('\n\n');
      }
    }
    else if (slug.includes('reason-for-sale') || slug.includes('sale-reason')) {
      value = analysis.marketAnalysis?.saleReason || value;
    }

    // Operations fields - Customers
    else if (slug.includes('recurring') && slug.includes('revenue')) {
      value = analysis.operations?.customers?.recurring || value;
    }
    else if (slug.includes('customer') && slug.includes('relationship')) {
      value = analysis.operations?.customers?.relationships || value;
    }
    else if (slug.includes('customer') && slug.includes('concentration')) {
      value = analysis.operations?.customers?.concentration || value;
    }
    else if (slug.includes('customer') && slug.includes('contract')) {
      value = analysis.operations?.customers?.contracts || value;
    }

    // Operations fields - Suppliers
    else if (slug.includes('supplier') && slug.includes('count')) {
      value = analysis.operations?.suppliers?.count || value;
    }
    else if (slug.includes('supplier') && slug.includes('terms')) {
      value = analysis.operations?.suppliers?.terms || value;
    }
    else if (slug.includes('supplier') && slug.includes('concentration')) {
      value = analysis.operations?.suppliers?.concentration || value;
    }
    else if (slug.includes('supplier') && slug.includes('transfer')) {
      value = analysis.operations?.suppliers?.transferability || value;
    }

    // Team fields
    else if (slug.includes('owner') && slug.includes('responsibilities')) {
      value = analysis.team?.ownerResponsibilities || value;
    }
    else if (slug.includes('owner') && slug.includes('hours')) {
      value = analysis.team?.ownerHours || value;
    }
    else if (slug.includes('management') || slug.includes('reporting')) {
      value = analysis.team?.management || value;
    }
    else if (slug.includes('employee') && slug.includes('count')) {
      value = analysis.team?.employeeCount || value;
    }
    else if (slug.includes('turnover')) {
      value = analysis.team?.turnover || value;
    }
    else if (slug.includes('retention')) {
      value = analysis.team?.retention || value;
    }

    // Facility fields
    else if (slug.includes('facility') && slug.includes('ownership')) {
      value = analysis.facility?.ownership || value;
    }
    else if (slug.includes('facility') && slug.includes('size')) {
      value = analysis.facility?.size || value;
    }
    else if (slug.includes('facility') && slug.includes('cost')) {
      value = analysis.facility?.cost || value;
    }
    else if (slug.includes('lease') && slug.includes('details')) {
      value = analysis.facility?.leaseDetails || value;
    }

    // Use executive summary for any field that includes "executive-summary"
    else if (slug.includes('executive-summary')) {
      // Create a comprehensive executive summary
      const parts = [];
      
      if (analysis.story?.businessSummary) {
        parts.push(analysis.story.businessSummary);
      }
      
      if (analysis.executiveSummary?.buyerAttractions?.length > 0) {
        parts.push("\nKey Attractions:");
        analysis.executiveSummary.buyerAttractions.forEach((item: string) => {
          parts.push(`• ${item}`);
        });
      }
      
      if (analysis.executiveSummary?.growthOpportunities?.length > 0) {
        parts.push("\nGrowth Opportunities:");
        analysis.executiveSummary.growthOpportunities.forEach((item: string) => {
          parts.push(`• ${item}`);
        });
      }
      
      value = parts.join("\n");
    }
    
    // Handle special field names from WordPress
    else if (slug === 'field-group-for-listings' || slug === 'listing-group') {
      // Use this as a wrapper for business information
      const parts = [];
      parts.push(`CONFIDENTIAL INFORMATION MEMORANDUM`);
      
      if (analysis.story?.businessSummary) {
        parts.push(`\nBUSINESS SUMMARY:\n${analysis.story.businessSummary}`);
      }
      
      if (analysis.story?.yearStarted) {
        parts.push(`\nFounded: ${analysis.story.yearStarted}`);
      }
      
      if (analysis.story?.businessStructure) {
        parts.push(`\nStructure: ${analysis.story.businessStructure}`);
      }
      
      if (analysis.executiveSummary?.buyerAttractions?.length > 0) {
        parts.push("\nKEY ATTRACTIONS:");
        analysis.executiveSummary.buyerAttractions.forEach((item: string) => {
          parts.push(`• ${item}`);
        });
      }
      
      value = parts.join("\n");
      console.log(`Mapped special field '${slug}' to comprehensive business information`);
    }
    else if (slug === 'listing-details') {
      // Use this for the detailed listing information
      const parts = [];
      
      // Market Analysis
      if (analysis.marketAnalysis?.customerProfile) {
        parts.push(`TARGET MARKET: ${analysis.marketAnalysis.customerProfile}`);
      }
      
      if (analysis.marketAnalysis?.competitors?.length > 0) {
        parts.push("\nCOMPETITORS:");
        analysis.marketAnalysis.competitors.forEach((item: string) => {
          parts.push(`• ${item}`);
        });
      }
      
      if (analysis.marketAnalysis?.strengths?.length > 0) {
        parts.push("\nBUSINESS STRENGTHS:");
        analysis.marketAnalysis.strengths.forEach((item: string) => {
          parts.push(`• ${item}`);
        });
      }
      
      if (analysis.operations?.customers?.recurring) {
        parts.push(`\nRECURRING REVENUE: ${analysis.operations.customers.recurring}`);
      }
      
      if (analysis.operations?.customers?.relationships) {
        parts.push(`\nCUSTOMER BASE: ${analysis.operations.customers.relationships}`);
      }
      
      if (analysis.team?.ownerResponsibilities) {
        parts.push(`\nOWNER RESPONSIBILITIES: ${analysis.team.ownerResponsibilities}`);
      }
      
      if (analysis.team?.ownerHours) {
        parts.push(`\nOWNER HOURS: ${analysis.team.ownerHours}`);
      }
      
      if (analysis.team?.employeeCount) {
        parts.push(`\nTEAM SIZE: ${analysis.team.employeeCount}`);
      }
      
      value = parts.join("\n");
      console.log(`Mapped special field '${slug}' to detailed listing information`);
    }

    // Set the field value
    fieldMapping[field.id] = value;
  });

  return fieldMapping;
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