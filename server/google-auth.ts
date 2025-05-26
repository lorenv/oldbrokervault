import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { storage } from "./storage";

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing required Google OAuth credentials');
}

// Create OAuth2Client with dynamic redirect URI
function createOAuth2Client(redirectUri?: string) {
  const defaultRedirectUri = process.env.NODE_ENV === 'production' 
    ? 'https://business-exits-cim-generator.replit.app/api/auth/google/callback'
    : 'http://localhost:5000/api/auth/google/callback';
    
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || defaultRedirectUri
  );
}

// Scopes needed for Google Drive and Docs
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/docs'
];

export function getGoogleAuthUrl(host?: string) {
  const redirectUri = host ? `https://${host}/api/auth/google/callback` : undefined;
  const oauth2Client = createOAuth2Client(redirectUri);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to ensure we get refresh token
  });
}

export async function handleGoogleCallback(code: string, userId: number, host?: string) {
  try {
    const redirectUri = host ? `https://${host}/api/auth/google/callback` : undefined;
    const oauth2Client = createOAuth2Client(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens in database
    await storage.updateGoogleTokens(userId, {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null
    });

    return true;
  } catch (error) {
    console.error('Error getting Google tokens:', error);
    return false;
  }
}

export async function createGoogleDoc(userId: number, title: string, content: any) {
  const user = await storage.getUser(userId);
  if (!user?.googleAccessToken) {
    throw new Error('User not connected to Google');
  }

  // Set up OAuth2 client with user's tokens
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const docs = google.docs({ version: 'v1', auth: oauth2Client });

  try {
    // Format the content as a structured document for a CIM
    let formattedContent = `CONFIDENTIAL INFORMATION MEMORANDUM\n\n`;
    // Add document title at the top
    formattedContent += `${title}\n\n`;
    
    // Business Overview Section
    formattedContent += `BUSINESS OVERVIEW\n==================\n`;
    formattedContent += `Founded: ${content.story?.yearStarted || 'N/A'}\n`;
    formattedContent += `Structure: ${content.story?.businessStructure || 'N/A'}\n\n`;
    
    // Business Summary
    formattedContent += `${content.story?.businessSummary || content.story?.businessModel || 'N/A'}\n\n`;
    
    // Executive Summary Section
    formattedContent += `INVESTMENT HIGHLIGHTS\n===================\n`;
    formattedContent += `Key Attractions:\n`;
    if (content.executiveSummary?.buyerAttractions?.length) {
      content.executiveSummary.buyerAttractions.forEach((item: string) => {
        formattedContent += `• ${item}\n`;
      });
    }
    
    formattedContent += `\nGrowth Opportunities:\n`;
    if (content.executiveSummary?.growthOpportunities?.length) {
      content.executiveSummary.growthOpportunities.forEach((item: string) => {
        formattedContent += `• ${item}\n`;
      });
    }
    
    // Market Position
    formattedContent += `\nMARKET POSITION\n=============\n`;
    formattedContent += `Target Market: ${content.marketAnalysis?.customerProfile || 'N/A'}\n\n`;
    
    formattedContent += `Competitors:\n`;
    if (content.marketAnalysis?.competitors?.length) {
      content.marketAnalysis.competitors.forEach((item: string) => {
        formattedContent += `• ${item}\n`;
      });
    }
    
    formattedContent += `\nBusiness Strengths:\n`;
    if (content.marketAnalysis?.strengths?.length) {
      content.marketAnalysis.strengths.forEach((item: string) => {
        formattedContent += `• ${item}\n`;
      });
    }
    
    // Operations Section
    formattedContent += `\nOPERATIONS\n=========\n`;
    formattedContent += `Customer Relationships:\n`;
    formattedContent += `• Recurring Revenue: ${content.operations?.customers?.recurring || 'N/A'}\n`;
    formattedContent += `• Customer Base: ${content.operations?.customers?.relationships || 'N/A'}\n`;
    formattedContent += `• Revenue Concentration: ${content.operations?.customers?.concentration || 'N/A'}\n`;
    formattedContent += `• Contract Terms: ${content.operations?.customers?.contracts || 'N/A'}\n\n`;
    
    formattedContent += `Supply Chain:\n`;
    formattedContent += `• Number of Suppliers: ${content.operations?.suppliers?.count || 'N/A'}\n`;
    formattedContent += `• Supplier Terms: ${content.operations?.suppliers?.terms || 'N/A'}\n`;
    formattedContent += `• Concentration: ${content.operations?.suppliers?.concentration || 'N/A'}\n`;
    formattedContent += `• Transferability: ${content.operations?.suppliers?.transferability || 'N/A'}\n\n`;
    
    // Team Structure
    formattedContent += `TEAM STRUCTURE\n=============\n`;
    formattedContent += `• Owner Responsibilities: ${content.team?.ownerResponsibilities || 'N/A'}\n`;
    formattedContent += `• Required Hours: ${content.team?.ownerHours || 'N/A'}\n`;
    formattedContent += `• Management Structure: ${content.team?.management || 'N/A'}\n`;
    formattedContent += `• Team Size: ${content.team?.employeeCount || 'N/A'}\n`;
    formattedContent += `• Turnover Rate: ${content.team?.turnover || 'N/A'}\n`;
    formattedContent += `• Retention: ${content.team?.retention || 'N/A'}\n\n`;
    
    // Facilities
    formattedContent += `FACILITIES\n=========\n`;
    formattedContent += `• Ownership Status: ${content.facility?.ownership || 'N/A'}\n`;
    formattedContent += `• Size: ${content.facility?.size || 'N/A'}\n`;
    formattedContent += `• Monthly Cost: ${content.facility?.cost || 'N/A'}\n`;
    if (content.facility?.leaseDetails) {
      formattedContent += `• Lease Details: ${content.facility.leaseDetails}\n`;
    }

    // Create new Google Doc
    const fileMetadata = {
      name: title ? `CIM - ${title}` : 'Confidential Information Memorandum',
      mimeType: 'application/vnd.google-apps.document'
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: 'text/plain',
        body: formattedContent
      }
    });

    if (!file.data.id) {
      throw new Error('Failed to create Google Doc');
    }

    // Configure sharing settings - make it editable by the user
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: user.email
      }
    });

    return `https://docs.google.com/document/d/${file.data.id}/edit`;
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    throw new Error('Failed to create Google Doc');
  }
}