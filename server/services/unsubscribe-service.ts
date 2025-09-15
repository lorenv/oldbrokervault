import { db } from '../db';
import { users } from '../../shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';

interface EmailPreferences {
  onboarding: boolean;
  marketing: boolean;
  transactional: boolean;
}

class UnsubscribeService {
  /**
   * Generate a unique unsubscribe token for a user
   */
  async generateUnsubscribeToken(userId: number): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30); // Token valid for 30 days

    await db.update(users)
      .set({
        unsubscribeToken: token,
        unsubscribeTokenExpiry: expiry
      })
      .where(eq(users.id, userId));

    return token;
  }

  /**
   * Get unsubscribe link for a user
   */
  async getUnsubscribeLink(userId: number): Promise<string> {
    const token = await this.generateUnsubscribeToken(userId);
    const baseUrl = process.env.FRONTEND_URL || 'https://cimshare.com';
    return `${baseUrl}/unsubscribe?token=${token}`;
  }

  /**
   * Validate an unsubscribe token
   */
  async validateToken(token: string): Promise<{ valid: boolean; userId?: number; email?: string }> {
    const [user] = await db.select()
      .from(users)
      .where(
        and(
          eq(users.unsubscribeToken, token),
          gt(users.unsubscribeTokenExpiry, new Date())
        )
      )
      .limit(1);

    if (!user) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: user.id,
      email: user.email
    };
  }

  /**
   * Unsubscribe user from specific email types or all emails
   */
  async unsubscribe(token: string, emailTypes?: Partial<EmailPreferences>): Promise<boolean> {
    const validation = await this.validateToken(token);

    if (!validation.valid || !validation.userId) {
      return false;
    }

    // Get current preferences
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, validation.userId))
      .limit(1);

    const currentPreferences = (user.emailPreferences as EmailPreferences) || {
      onboarding: true,
      marketing: true,
      transactional: true
    };

    // Update preferences
    const newPreferences: EmailPreferences = {
      ...currentPreferences,
      ...(emailTypes || { onboarding: false, marketing: false }) // Default: unsubscribe from onboarding and marketing
    };

    // Always keep transactional emails enabled (required by law for account-related communications)
    newPreferences.transactional = true;

    await db.update(users)
      .set({
        emailPreferences: newPreferences,
        unsubscribeToken: null, // Invalidate token after use
        unsubscribeTokenExpiry: null
      })
      .where(eq(users.id, validation.userId));

    return true;
  }

  /**
   * Check if user should receive a specific type of email
   */
  async canSendEmail(userId: number, emailType: keyof EmailPreferences): Promise<boolean> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return false;
    }

    const preferences = (user.emailPreferences as EmailPreferences) || {
      onboarding: true,
      marketing: true,
      transactional: true
    };

    return preferences[emailType] !== false;
  }

  /**
   * Get user's email preferences
   */
  async getEmailPreferences(userId: number): Promise<EmailPreferences | null> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return null;
    }

    return (user.emailPreferences as EmailPreferences) || {
      onboarding: true,
      marketing: true,
      transactional: true
    };
  }

  /**
   * Update user's email preferences
   */
  async updateEmailPreferences(userId: number, preferences: Partial<EmailPreferences>): Promise<boolean> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return false;
    }

    const currentPreferences = (user.emailPreferences as EmailPreferences) || {
      onboarding: true,
      marketing: true,
      transactional: true
    };

    const newPreferences: EmailPreferences = {
      ...currentPreferences,
      ...preferences
    };

    // Always keep transactional emails enabled
    newPreferences.transactional = true;

    await db.update(users)
      .set({
        emailPreferences: newPreferences
      })
      .where(eq(users.id, userId));

    return true;
  }
}

export const unsubscribeService = new UnsubscribeService();