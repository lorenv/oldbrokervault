/**
 * HubSpot Provider
 *
 * OAuth-based integration with HubSpot CRM.
 * Supports creating/updating Contacts, Deals, Companies, and Notes.
 * Also supports file attachments.
 */

import { BaseProvider } from './base';
import { encrypt, decrypt } from '../encryption';
import type {
  ExecutionResult,
  FieldSchema,
  OAuthResult,
  OAuthTokens,
  HubSpotDestinationConfig,
  ConnectionTestResult
} from '../types';
import type {
  IntegrationConnection,
  IntegrationAutomation,
  IntegrationProvider,
  DestinationType,
  FieldMapping
} from '@shared/schema';

// HubSpot OAuth configuration
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID || '';
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET || '';
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI ||
  `${process.env.PUBLIC_URL || 'http://localhost:5000'}/api/integrations/oauth/callback/hubspot`;

// Required scopes for full CRM access
const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'files.ui_hidden.read',
  'files.ui_hidden.write',
];

// HubSpot API base URL
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

export class HubSpotProvider extends BaseProvider {
  id: IntegrationProvider = 'hubspot';
  name = 'HubSpot';
  icon = 'hubspot';
  description = 'Sync contacts, deals, and documents with HubSpot CRM';
  authType: 'oauth' | 'webhook' | 'api_key' = 'oauth';
  destinationTypes: DestinationType[] = [
    'hubspot_contact',
    'hubspot_deal',
    'hubspot_company',
    'hubspot_note'
  ];

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(userId: number, state: string): string {
    const params = new URLSearchParams({
      client_id: HUBSPOT_CLIENT_ID,
      scope: HUBSPOT_SCOPES.join(' '),
      redirect_uri: HUBSPOT_REDIRECT_URI,
      state: state,
    });

    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, userId: number): Promise<OAuthResult> {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        code: code,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error || 'Failed to authenticate with HubSpot');
    }

    // Get account info
    const accountInfo = await this.getAccountInfo(data.access_token);

    return {
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        scopes: HUBSPOT_SCOPES,
      },
      accountId: accountInfo.portalId,
      accountName: accountInfo.name,
    };
  }

  /**
   * Refresh expired access token
   */
  async refreshToken(connection: IntegrationConnection): Promise<OAuthTokens> {
    const refreshToken = connection.refreshTokenEncrypted
      ? decrypt(connection.refreshTokenEncrypted)
      : null;

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || 'Failed to refresh HubSpot token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: HUBSPOT_SCOPES,
    };
  }

  /**
   * Get HubSpot account info
   */
  private async getAccountInfo(accessToken: string): Promise<{ portalId: string; name: string }> {
    const response = await fetch(`${HUBSPOT_API_BASE}/account-info/v3/details`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return {
      portalId: String(data.portalId || ''),
      name: data.companyName || data.accountName || 'HubSpot Account',
    };
  }

  /**
   * Test connection
   */
  async testConnection(connection: IntegrationConnection): Promise<ConnectionTestResult> {
    const accessToken = connection.accessTokenEncrypted
      ? decrypt(connection.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return { success: false, error: 'No access token available' };
    }

    try {
      const accountInfo = await this.getAccountInfo(accessToken);
      return {
        success: true,
        accountInfo: {
          id: accountInfo.portalId,
          name: accountInfo.name,
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection test failed'
      };
    }
  }

  /**
   * Get available properties for a HubSpot object type
   */
  async getDestinationSchema(
    connection: IntegrationConnection,
    destinationType: DestinationType
  ): Promise<FieldSchema[]> {
    const accessToken = connection.accessTokenEncrypted
      ? decrypt(connection.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return this.getDefaultSchema(destinationType);
    }

    const objectType = this.getObjectType(destinationType);
    if (!objectType) {
      return [];
    }

    try {
      const response = await fetch(
        `${HUBSPOT_API_BASE}/crm/v3/properties/${objectType}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!data.results) {
        return this.getDefaultSchema(destinationType);
      }

      return data.results
        .filter((prop: any) => !prop.hidden && !prop.readOnlyValue)
        .map((prop: any) => ({
          name: prop.name,
          label: prop.label,
          type: this.mapHubSpotType(prop.type, prop.fieldType),
          required: prop.name === 'email' && objectType === 'contacts',
          description: prop.description,
          group: prop.groupName,
          options: prop.options?.map((opt: any) => ({
            value: opt.value,
            label: opt.label,
          })),
        }));
    } catch (error) {
      console.error('Failed to fetch HubSpot properties:', error);
      return this.getDefaultSchema(destinationType);
    }
  }

  /**
   * Execute HubSpot operation
   */
  async execute(
    connection: IntegrationConnection | null,
    automation: IntegrationAutomation,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>
  ): Promise<ExecutionResult> {
    if (!connection) {
      return { success: false, error: 'HubSpot connection not found' };
    }

    let accessToken = connection.accessTokenEncrypted
      ? decrypt(connection.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return { success: false, error: 'HubSpot access token not available' };
    }

    // Check if token is expired and refresh if needed
    if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) < new Date()) {
      try {
        const newTokens = await this.refreshToken(connection);
        accessToken = newTokens.accessToken;
        // Note: Token refresh is handled by the automation engine
      } catch (error) {
        return { success: false, error: 'HubSpot token expired. Please reconnect.' };
      }
    }

    const config = automation.destinationConfig as HubSpotDestinationConfig;
    const objectType = config?.objectType || this.getObjectType(automation.destinationType);

    if (!objectType) {
      return { success: false, error: 'Invalid HubSpot object type' };
    }

    // Handle note creation differently
    if (automation.destinationType === 'hubspot_note') {
      return this.createNote(accessToken, mappedPayload, eventPayload, automation);
    }

    // Determine behavior
    const behavior = automation.behavior || 'upsert';
    const matchField = automation.matchField || 'email';

    try {
      let result: ExecutionResult;

      if (behavior === 'create') {
        result = await this.createRecord(accessToken, objectType, mappedPayload);
      } else if (behavior === 'update') {
        result = await this.updateRecord(accessToken, objectType, mappedPayload, matchField);
      } else {
        // upsert
        result = await this.upsertRecord(accessToken, objectType, mappedPayload, matchField);
      }

      // Handle file attachment if configured
      if (result.success && automation.includeFile && result.externalId) {
        const fileResult = await this.attachFile(
          accessToken,
          objectType,
          result.externalId,
          eventPayload,
          automation.fileSource
        );

        if (fileResult.fileUploaded) {
          result.fileUploaded = true;
          result.fileName = fileResult.fileName;
          result.fileSize = fileResult.fileSize;
        }
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'HubSpot operation failed'
      };
    }
  }

  /**
   * Create a new record
   */
  private async createRecord(
    accessToken: string,
    objectType: string,
    properties: Record<string, any>
  ): Promise<ExecutionResult> {
    const response = await this.httpRequest(
      `${HUBSPOT_API_BASE}/crm/v3/objects/${objectType}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        externalId: data.id,
        externalUrl: this.getRecordUrl(objectType, data.id),
        responseBody: JSON.stringify(data),
      };
    } else {
      return {
        success: false,
        statusCode: response.status,
        error: data.message || `Failed to create ${objectType}`,
        responseBody: JSON.stringify(data),
      };
    }
  }

  /**
   * Update an existing record
   */
  private async updateRecord(
    accessToken: string,
    objectType: string,
    properties: Record<string, any>,
    matchField: string
  ): Promise<ExecutionResult> {
    const matchValue = properties[matchField];
    if (!matchValue) {
      return {
        success: false,
        error: `Match field "${matchField}" is required for update`
      };
    }

    // Search for existing record
    const existingId = await this.findRecordByField(accessToken, objectType, matchField, matchValue);

    if (!existingId) {
      return {
        success: false,
        error: `No ${objectType} found with ${matchField} = ${matchValue}`
      };
    }

    const response = await this.httpRequest(
      `${HUBSPOT_API_BASE}/crm/v3/objects/${objectType}/${existingId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        externalId: data.id,
        externalUrl: this.getRecordUrl(objectType, data.id),
        responseBody: JSON.stringify(data),
      };
    } else {
      return {
        success: false,
        statusCode: response.status,
        error: data.message || `Failed to update ${objectType}`,
        responseBody: JSON.stringify(data),
      };
    }
  }

  /**
   * Upsert - create or update
   */
  private async upsertRecord(
    accessToken: string,
    objectType: string,
    properties: Record<string, any>,
    matchField: string
  ): Promise<ExecutionResult> {
    const matchValue = properties[matchField];

    // If no match value, just create
    if (!matchValue) {
      return this.createRecord(accessToken, objectType, properties);
    }

    // Search for existing record
    const existingId = await this.findRecordByField(accessToken, objectType, matchField, matchValue);

    if (existingId) {
      // Update existing
      const response = await this.httpRequest(
        `${HUBSPOT_API_BASE}/crm/v3/objects/${objectType}/${existingId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          externalId: data.id,
          externalUrl: this.getRecordUrl(objectType, data.id),
          responseBody: JSON.stringify({ ...data, _operation: 'updated' }),
        };
      } else {
        return {
          success: false,
          statusCode: response.status,
          error: data.message || `Failed to update ${objectType}`,
          responseBody: JSON.stringify(data),
        };
      }
    } else {
      // Create new
      const result = await this.createRecord(accessToken, objectType, properties);
      if (result.success && result.responseBody) {
        result.responseBody = result.responseBody.replace('}', ', "_operation": "created"}');
      }
      return result;
    }
  }

  /**
   * Search for a record by field value
   */
  private async findRecordByField(
    accessToken: string,
    objectType: string,
    field: string,
    value: string
  ): Promise<string | null> {
    try {
      const response = await this.httpRequest(
        `${HUBSPOT_API_BASE}/crm/v3/objects/${objectType}/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: field,
                operator: 'EQ',
                value: value,
              }],
            }],
            limit: 1,
          }),
        }
      );

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        return data.results[0].id;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a note/engagement
   */
  private async createNote(
    accessToken: string,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>,
    automation: IntegrationAutomation
  ): Promise<ExecutionResult> {
    // Build note body
    const noteBody = mappedPayload.body ||
      `Event: ${eventPayload.event}\n\n${JSON.stringify(eventPayload.data, null, 2)}`;

    // Find associated record if specified
    let associations: any[] = [];
    if (mappedPayload.associatedEmail) {
      const contactId = await this.findRecordByField(
        accessToken, 'contacts', 'email', mappedPayload.associatedEmail
      );
      if (contactId) {
        associations.push({
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] // Note to Contact
        });
      }
    }

    const response = await this.httpRequest(
      `${HUBSPOT_API_BASE}/crm/v3/objects/notes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            hs_note_body: noteBody,
            hs_timestamp: new Date().toISOString(),
          },
          associations: associations.length > 0 ? associations : undefined,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        externalId: data.id,
        responseBody: JSON.stringify(data),
      };
    } else {
      return {
        success: false,
        statusCode: response.status,
        error: data.message || 'Failed to create note',
        responseBody: JSON.stringify(data),
      };
    }
  }

  /**
   * Attach a file to a HubSpot record
   */
  private async attachFile(
    accessToken: string,
    objectType: string,
    recordId: string,
    eventPayload: Record<string, any>,
    fileSource?: string | null
  ): Promise<{ fileUploaded: boolean; fileName?: string; fileSize?: number }> {
    // Determine file URL based on source
    let fileUrl: string | undefined;
    let fileName: string = 'document.pdf';

    if (fileSource === 'signed_document' || !fileSource) {
      fileUrl = eventPayload.data?.signed_document_url;
      fileName = eventPayload.data?.file_name || 'signed_document.pdf';
    } else if (fileSource === 'cim_pdf') {
      fileUrl = eventPayload.data?.document_url || eventPayload.data?.cim_url;
      fileName = eventPayload.data?.title ? `${eventPayload.data.title}.pdf` : 'document.pdf';
    }

    if (!fileUrl) {
      return { fileUploaded: false };
    }

    try {
      // Download the file
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        console.error('Failed to download file for HubSpot attachment');
        return { fileUploaded: false };
      }

      const fileBuffer = await fileResponse.arrayBuffer();
      const fileSize = fileBuffer.byteLength;

      // Upload to HubSpot Files API
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer]), fileName);
      formData.append('options', JSON.stringify({
        access: 'PRIVATE',
        folderPath: '/CIMShare',
      }));

      const uploadResponse = await fetch(`${HUBSPOT_API_BASE}/files/v3/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        console.error('Failed to upload file to HubSpot:', uploadData);
        return { fileUploaded: false };
      }

      const hubspotFileId = uploadData.id;

      // Create an engagement/note with the file attached
      const noteResponse = await this.httpRequest(
        `${HUBSPOT_API_BASE}/crm/v3/objects/notes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              hs_note_body: `Document attached: ${fileName}`,
              hs_timestamp: new Date().toISOString(),
              hs_attachment_ids: hubspotFileId,
            },
            associations: [{
              to: { id: recordId },
              types: [{
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: objectType === 'contacts' ? 202 : 214 // Note to Contact or Deal
              }]
            }],
          }),
        }
      );

      if (noteResponse.ok) {
        return {
          fileUploaded: true,
          fileName,
          fileSize,
        };
      }

      return { fileUploaded: false };
    } catch (error) {
      console.error('Error attaching file to HubSpot:', error);
      return { fileUploaded: false };
    }
  }

  /**
   * Map destination type to HubSpot object type
   */
  private getObjectType(destinationType: DestinationType): string | null {
    const mapping: Record<string, string> = {
      'hubspot_contact': 'contacts',
      'hubspot_deal': 'deals',
      'hubspot_company': 'companies',
      'hubspot_note': 'notes',
    };
    return mapping[destinationType] || null;
  }

  /**
   * Get URL to view record in HubSpot
   */
  private getRecordUrl(objectType: string, recordId: string): string {
    const typeMap: Record<string, string> = {
      'contacts': 'contact',
      'deals': 'deal',
      'companies': 'company',
    };
    const type = typeMap[objectType] || objectType;
    return `https://app.hubspot.com/contacts/record/${type}/${recordId}`;
  }

  /**
   * Map HubSpot property type to our field type
   */
  private mapHubSpotType(type: string, fieldType?: string): FieldSchema['type'] {
    if (fieldType === 'select' || fieldType === 'radio') return 'select';
    if (fieldType === 'checkbox') return 'multiselect';
    if (fieldType === 'textarea') return 'textarea';

    const typeMap: Record<string, FieldSchema['type']> = {
      'string': 'string',
      'number': 'number',
      'bool': 'boolean',
      'date': 'date',
      'datetime': 'datetime',
      'enumeration': 'select',
      'phone_number': 'phone',
    };

    return typeMap[type] || 'string';
  }

  /**
   * Get default schema when API call fails
   */
  private getDefaultSchema(destinationType: DestinationType): FieldSchema[] {
    if (destinationType === 'hubspot_contact') {
      return [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'firstname', label: 'First Name', type: 'string', required: false },
        { name: 'lastname', label: 'Last Name', type: 'string', required: false },
        { name: 'phone', label: 'Phone Number', type: 'phone', required: false },
        { name: 'company', label: 'Company Name', type: 'string', required: false },
        { name: 'jobtitle', label: 'Job Title', type: 'string', required: false },
        { name: 'website', label: 'Website URL', type: 'url', required: false },
        { name: 'city', label: 'City', type: 'string', required: false },
        { name: 'state', label: 'State/Region', type: 'string', required: false },
        { name: 'country', label: 'Country', type: 'string', required: false },
      ];
    }

    if (destinationType === 'hubspot_deal') {
      return [
        { name: 'dealname', label: 'Deal Name', type: 'string', required: true },
        { name: 'amount', label: 'Amount', type: 'number', required: false },
        { name: 'dealstage', label: 'Deal Stage', type: 'string', required: false },
        { name: 'pipeline', label: 'Pipeline', type: 'string', required: false },
        { name: 'closedate', label: 'Close Date', type: 'date', required: false },
      ];
    }

    if (destinationType === 'hubspot_company') {
      return [
        { name: 'name', label: 'Company Name', type: 'string', required: true },
        { name: 'domain', label: 'Website Domain', type: 'string', required: false },
        { name: 'industry', label: 'Industry', type: 'string', required: false },
        { name: 'phone', label: 'Phone Number', type: 'phone', required: false },
        { name: 'city', label: 'City', type: 'string', required: false },
        { name: 'state', label: 'State/Region', type: 'string', required: false },
        { name: 'country', label: 'Country', type: 'string', required: false },
      ];
    }

    return [];
  }
}

// Export singleton instance
export const hubspotProvider = new HubSpotProvider();
