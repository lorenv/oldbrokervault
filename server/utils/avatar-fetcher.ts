import crypto from 'crypto';
import sharp from 'sharp';
import { db } from '../db';
import { integrationConnections, crmContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { objectStorage } from '../object-storage';

const AVATAR_SIZE = 80; // 80x80 pixels
const GRAVATAR_BASE_URL = 'https://www.gravatar.com/avatar';
const GOOGLE_PEOPLE_API_URL = 'https://people.googleapis.com/v1/people:searchContacts';

interface AvatarResult {
  buffer: Buffer | null;
  source: 'gravatar' | 'google' | null;
  mimeType: string;
}

/**
 * Generate MD5 hash of email for Gravatar
 */
function getGravatarHash(email: string): string {
  return crypto
    .createHash('md5')
    .update(email.toLowerCase().trim())
    .digest('hex');
}

/**
 * Fetch avatar from Gravatar
 * Returns null if no custom avatar exists (404)
 */
async function fetchGravatarAvatar(email: string): Promise<Buffer | null> {
  const hash = getGravatarHash(email);
  // d=404 returns 404 if no custom avatar exists
  const url = `${GRAVATAR_BASE_URL}/${hash}?s=${AVATAR_SIZE * 2}&d=404`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null; // No Gravatar found
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[Avatar] Gravatar fetch error:', error);
    return null;
  }
}

/**
 * Fetch avatar from Google People API (requires Gmail OAuth)
 */
async function fetchGoogleAvatar(
  email: string,
  accessToken: string
): Promise<Buffer | null> {
  try {
    // Search for the contact by email
    const searchUrl = `${GOOGLE_PEOPLE_API_URL}?query=${encodeURIComponent(email)}&readMask=photos&pageSize=1`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('[Avatar] Google People API error:', response.status);
      return null;
    }

    const data = await response.json();

    // Check if we found a contact with a photo
    const results = data.results || [];
    if (results.length === 0) return null;

    const person = results[0].person;
    const photos = person?.photos || [];

    // Find a photo (preferring non-default photos)
    const photo = photos.find((p: any) => !p.default) || photos[0];
    if (!photo?.url) return null;

    // Fetch the actual image
    const imageResponse = await fetch(photo.url);
    if (!imageResponse.ok) return null;

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[Avatar] Google avatar fetch error:', error);
    return null;
  }
}

/**
 * Process and optimize avatar image
 * Resize to standard size and convert to WebP for efficiency
 */
async function processAvatar(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE, {
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Get Gmail OAuth access token for a user (if connected)
 */
async function getGmailAccessToken(userId: number): Promise<string | null> {
  try {
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.userId, userId),
          eq(integrationConnections.provider, 'gmail'),
          eq(integrationConnections.status, 'connected')
        )
      )
      .limit(1);

    if (!connection) return null;

    // Check if token is expired and needs refresh
    const tokenData = connection.tokenData as any;
    if (!tokenData?.access_token) return null;

    // Check expiry (with 5 minute buffer)
    const expiresAt = tokenData.expires_at;
    if (expiresAt && Date.now() > expiresAt - 300000) {
      // Token expired or about to expire - would need to refresh
      // For now, return null and let it fail gracefully
      return null;
    }

    return tokenData.access_token;
  } catch (error) {
    console.error('[Avatar] Error getting Gmail token:', error);
    return null;
  }
}

/**
 * Fetch avatar for an email address
 * Tries Gravatar first, then Google if Gmail is connected
 */
export async function fetchAvatar(
  email: string,
  userId?: number
): Promise<AvatarResult> {
  // Try Gravatar first (no auth required)
  const gravatarBuffer = await fetchGravatarAvatar(email);
  if (gravatarBuffer) {
    const processedBuffer = await processAvatar(gravatarBuffer);
    return {
      buffer: processedBuffer,
      source: 'gravatar',
      mimeType: 'image/webp',
    };
  }

  // Try Google People API if user has Gmail connected
  if (userId) {
    const accessToken = await getGmailAccessToken(userId);
    if (accessToken) {
      const googleBuffer = await fetchGoogleAvatar(email, accessToken);
      if (googleBuffer) {
        const processedBuffer = await processAvatar(googleBuffer);
        return {
          buffer: processedBuffer,
          source: 'google',
          mimeType: 'image/webp',
        };
      }
    }
  }

  // No avatar found
  return {
    buffer: null,
    source: null,
    mimeType: 'image/webp',
  };
}

/**
 * Batch fetch avatars for multiple emails
 * Useful when importing contacts
 */
export async function fetchAvatarsBatch(
  emails: string[],
  userId?: number
): Promise<Map<string, AvatarResult>> {
  const results = new Map<string, AvatarResult>();

  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(email => fetchAvatar(email, userId))
    );

    batch.forEach((email, index) => {
      results.set(email, batchResults[index]);
    });
  }

  return results;
}

/**
 * Fetch and save avatar for a contact
 * Uploads to object storage and updates the contact record
 */
export async function fetchAndSaveContactAvatar(
  contactId: number,
  email: string,
  userId?: number
): Promise<{ url: string | null; source: string | null }> {
  try {
    const result = await fetchAvatar(email, userId);

    if (!result.buffer || !result.source) {
      return { url: null, source: null };
    }

    // Generate unique filename with timestamp for cache busting
    const timestamp = Date.now();
    const key = `contacts/${contactId}/avatar-${timestamp}.webp`;

    // Upload to object storage
    const { url } = await objectStorage.uploadBuffer(key, result.buffer, 'image/webp');

    // Update contact record
    await db
      .update(crmContacts)
      .set({
        avatarUrl: url,
        avatarSource: result.source,
        updatedAt: new Date(),
      })
      .where(eq(crmContacts.id, contactId));

    console.log(`[Avatar] Saved avatar for contact ${contactId} from ${result.source}`);
    return { url, source: result.source };
  } catch (error) {
    console.error(`[Avatar] Failed to fetch/save avatar for contact ${contactId}:`, error);
    return { url: null, source: null };
  }
}

/**
 * Refresh avatar for a contact (force re-fetch)
 */
export async function refreshContactAvatar(
  contactId: number,
  email: string,
  userId?: number
): Promise<{ url: string | null; source: string | null }> {
  return fetchAndSaveContactAvatar(contactId, email, userId);
}
