import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { storage } from "./storage";

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing required Google OAuth credentials');
}

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/auth/google/callback` // Updated callback URL for Replit deployment
);

// Scopes needed for Google Drive and Docs
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/docs'
];

export function getGoogleAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to ensure we get refresh token
  });
}

export async function handleGoogleCallback(code: string, userId: number) {
  try {
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

export async function createGoogleDoc(userId: number, title: string, content: string) {
  const user = await storage.getUser(userId);
  if (!user?.googleAccessToken) {
    throw new Error('User not connected to Google');
  }

  // Set up OAuth2 client with user's tokens
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const docs = google.docs({ version: 'v1', auth: oauth2Client });

  try {
    // Create new Google Doc
    const fileMetadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.document'
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: 'text/plain',
        body: content
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