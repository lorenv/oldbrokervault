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
import { esignEnvelopes } from '@shared/schema';
import { storage } from '../../storage';
import { db } from '../../db';
import { eq } from 'drizzle-orm';

// HubSpot OAuth configuration
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID || '';
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET || '';
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI ||
  `${process.env.BASE_URL || 'https://cimshare.com'}/api/integrations/oauth/callback/hubspot`;

// Required scopes for CRM access
const HUBSPOT_SCOPES = [
  'oauth',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'files',
  'files.ui_hidden.read',
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

    // Get portal ID for constructing correct URLs
    const portalId = connection.providerAccountId;

    try {
      let result: ExecutionResult;

      if (behavior === 'create') {
        result = await this.createRecord(accessToken, objectType, mappedPayload, portalId);
      } else if (behavior === 'update') {
        result = await this.updateRecord(accessToken, objectType, mappedPayload, matchField, portalId);
      } else {
        // upsert
        result = await this.upsertRecord(accessToken, objectType, mappedPayload, matchField, portalId);
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
    properties: Record<string, any>,
    portalId?: string | null
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
        externalUrl: this.getRecordUrl(objectType, data.id, portalId),
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
    matchField: string,
    portalId?: string | null
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
        externalUrl: this.getRecordUrl(objectType, data.id, portalId),
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
    matchField: string,
    portalId?: string | null
  ): Promise<ExecutionResult> {
    const matchValue = properties[matchField];

    // If no match value, just create
    if (!matchValue) {
      return this.createRecord(accessToken, objectType, properties, portalId);
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
          externalUrl: this.getRecordUrl(objectType, data.id, portalId),
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
      const result = await this.createRecord(accessToken, objectType, properties, portalId);
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
    let fileBuffer: ArrayBuffer;
    let fileName: string = 'document.pdf';

    try {
      // Determine file source based on event type if not explicitly set
      const eventType = eventPayload.event;
      const effectiveFileSource = fileSource || this.getDefaultFileSource(eventType);

      if (effectiveFileSource === 'signed_nda' || effectiveFileSource === 'signed_document') {
        // Get signed NDA directly from database using nda_id
        const ndaId = eventPayload.data?.nda_id;
        if (!ndaId) {
          console.log('[HubSpot] No nda_id in event payload, cannot attach signed NDA');
          return { fileUploaded: false };
        }

        const signature = await storage.getNdaSignatureById(ndaId);
        if (!signature || !signature.signedNdaContent) {
          console.error('[HubSpot] Could not find signed NDA content for ID:', ndaId);
          return { fileUploaded: false };
        }

        // Convert base64 to buffer
        // The signedNdaContent may have a data URL prefix or be raw base64
        let base64Content = signature.signedNdaContent;
        if (base64Content.startsWith('data:')) {
          base64Content = base64Content.split(',')[1];
        }

        const buffer = Buffer.from(base64Content, 'base64');
        fileBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        // Generate filename from signer name
        const signerName = signature.signerName || 'signer';
        const safeName = signerName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        fileName = `signed-nda-${safeName}.pdf`;

        console.log('[HubSpot] Retrieved signed NDA from database, size:', buffer.length);

      } else if (effectiveFileSource === 'signed_esign' || effectiveFileSource === 'esign_document') {
        // Get signed eSign envelope from database
        const envelopeId = eventPayload.data?.envelope?.id;
        if (!envelopeId) {
          console.log('[HubSpot] No envelope.id in event payload, cannot attach signed eSign document');
          return { fileUploaded: false };
        }

        const [envelope] = await db
          .select()
          .from(esignEnvelopes)
          .where(eq(esignEnvelopes.id, envelopeId))
          .limit(1);

        if (!envelope || !envelope.signedDocumentUrl) {
          console.error('[HubSpot] Could not find signed eSign document for envelope ID:', envelopeId);
          return { fileUploaded: false };
        }

        // Download the signed document from object storage URL
        const fileResponse = await fetch(envelope.signedDocumentUrl);
        if (!fileResponse.ok) {
          console.error('[HubSpot] Failed to download signed eSign document');
          return { fileUploaded: false };
        }
        fileBuffer = await fileResponse.arrayBuffer();

        // Generate filename from envelope title
        const safeTitle = (envelope.title || 'document').replace(/[^a-z0-9]/gi, '-').toLowerCase();
        fileName = `${safeTitle}-signed.pdf`;

        console.log('[HubSpot] Retrieved signed eSign document, size:', fileBuffer.byteLength);

      } else if (effectiveFileSource === 'cim_pdf') {
        // Get CIM PDF - need to generate or fetch it
        const cimId = eventPayload.data?.cim_id || eventPayload.data?.document?.id;
        const documentUrl = eventPayload.data?.document_url || eventPayload.data?.cim_url;

        if (documentUrl) {
          // If a URL is provided, use it
          const fileResponse = await fetch(documentUrl);
          if (!fileResponse.ok) {
            console.error('[HubSpot] Failed to download CIM PDF from URL');
            return { fileUploaded: false };
          }
          fileBuffer = await fileResponse.arrayBuffer();
        } else if (cimId) {
          // Otherwise try to get the CIM and generate a PDF URL
          // For now, log that we need a URL
          console.log('[HubSpot] CIM PDF requires a document_url in the event payload');
          return { fileUploaded: false };
        } else {
          console.log('[HubSpot] No CIM document URL or ID in event payload');
          return { fileUploaded: false };
        }

        const title = eventPayload.data?.title || eventPayload.data?.cim_title || 'document';
        const safeTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        fileName = `${safeTitle}.pdf`;

        console.log('[HubSpot] Retrieved CIM PDF, size:', fileBuffer.byteLength);

      } else {
        console.log('[HubSpot] Unknown or unsupported file source:', effectiveFileSource);
        return { fileUploaded: false };
      }
      const fileSize = fileBuffer.byteLength;

      // Upload to HubSpot Files API
      // HubSpot requires multipart form data with specific field names
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), fileName);
      formData.append('folderPath', '/CIMShare');
      formData.append('options', JSON.stringify({
        access: 'PRIVATE',
        overwrite: false,
        duplicateValidationStrategy: 'NONE',
        duplicateValidationScope: 'EXACT_FOLDER',
      }));

      console.log('[HubSpot] Uploading file to HubSpot Files API:', fileName, 'size:', fileSize);

      const uploadResponse = await fetch(`${HUBSPOT_API_BASE}/files/v3/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        console.error('[HubSpot] Failed to upload file to HubSpot:', uploadData);
        return { fileUploaded: false };
      }

      console.log('[HubSpot] File uploaded successfully, file ID:', uploadData.id);

      const hubspotFileId = uploadData.id;

      // Create an engagement/note with the file attached
      console.log('[HubSpot] Creating note with file attachment for record:', recordId, 'objectType:', objectType);

      const notePayload = {
        properties: {
          hs_note_body: `Document attached: ${fileName}`,
          hs_timestamp: new Date().toISOString(),
          hs_attachment_ids: hubspotFileId,
        },
        associations: [{
          to: { id: recordId },
          types: [{
            associationCategory: 'HUBSPOT_DEFINED',
            // Note to Contact = 202, Note to Deal = 214, Note to Company = 190
            associationTypeId: (objectType === 'contacts' || objectType === 'contact') ? 202
              : (objectType === 'deals' || objectType === 'deal') ? 214
              : 190
          }]
        }],
      };

      console.log('[HubSpot] Note payload:', JSON.stringify(notePayload));

      const noteResponse = await this.httpRequest(
        `${HUBSPOT_API_BASE}/crm/v3/objects/notes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notePayload),
        }
      );

      const noteData = await noteResponse.json().catch(() => ({}));
      console.log('[HubSpot] Note creation response:', noteResponse.status, noteResponse.ok ? 'OK' : 'FAILED', noteData);

      if (noteResponse.ok) {
        console.log('[HubSpot] File attached successfully via note');
        return {
          fileUploaded: true,
          fileName,
          fileSize,
        };
      }

      console.error('[HubSpot] Failed to create note with attachment:', noteData);
      return { fileUploaded: false };
    } catch (error) {
      console.error('Error attaching file to HubSpot:', error);
      return { fileUploaded: false };
    }
  }

  /**
   * Get default file source based on event type
   */
  private getDefaultFileSource(eventType?: string): string | null {
    if (!eventType) return null;

    const mapping: Record<string, string> = {
      'nda.signed': 'signed_nda',
      'esign.envelope_completed': 'signed_esign',
      'cim.created': 'cim_pdf',
    };
    return mapping[eventType] || null;
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
  private getRecordUrl(objectType: string, recordId: string, portalId?: string | null): string {
    const typeMap: Record<string, string> = {
      'contacts': 'contact',
      'deals': 'deal',
      'companies': 'company',
    };
    const type = typeMap[objectType] || objectType;
    // Use portal ID if available for correct URL, otherwise use generic format
    if (portalId) {
      return `https://app.hubspot.com/contacts/${portalId}/${type}/${recordId}`;
    }
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
