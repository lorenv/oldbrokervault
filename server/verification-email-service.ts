import { MailService } from '@sendgrid/mail';
import { logger } from './logger';
import crypto from 'crypto';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

export class VerificationEmailService {
  private static readonly FROM_EMAIL = 'noreply@cimshare.com';
  private static readonly FROM_NAME = 'CIM Share';

  /**
   * Generate a 6-digit verification code
   */
  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a secure verification token for the clickable link
   */
  static generateVerificationToken(email: string, code: string): string {
    const data = `${email}:${code}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Send verification email with both code and clickable link
   */
  static async sendVerificationEmail(
    email: string, 
    name: string, 
    code: string,
    baseUrl: string
  ): Promise<boolean> {
    try {
      // Generate verification link token
      const token = this.generateVerificationToken(email, code);
      const verificationLink = `${baseUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}&code=${code}`;

      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your CIM Share Account</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to CIM Share!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Verify your email to get started</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Thank you for registering with CIM Share! To complete your account setup and start creating professional Confidential Information Memorandums, please verify your email address.
            </p>
            
            <div style="background: white; padding: 25px; border-radius: 8px; border: 2px solid #e9ecef; margin: 25px 0;">
              <h3 style="color: #495057; margin-top: 0; text-align: center;">Two Ways to Verify:</h3>
              
              <!-- Option 1: Click the button -->
              <div style="text-align: center; margin: 25px 0;">
                <a href="${verificationLink}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                  ✓ Verify Email Address
                </a>
                <p style="font-size: 14px; color: #6c757d; margin-top: 15px;">
                  Click the button above for instant verification
                </p>
              </div>
              
              <div style="text-align: center; margin: 20px 0; color: #6c757d;">
                <strong>— OR —</strong>
              </div>
              
              <!-- Option 2: Enter the code manually -->
              <div style="text-align: center; margin: 25px 0;">
                <p style="font-size: 16px; margin-bottom: 10px; color: #495057;">
                  Enter this verification code:
                </p>
                <div style="background: #f8f9fa; border: 2px dashed #667eea; padding: 20px; border-radius: 8px; display: inline-block;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: monospace;">
                    ${code}
                  </span>
                </div>
                <p style="font-size: 14px; color: #6c757d; margin-top: 15px;">
                  This code will expire in 15 minutes
                </p>
              </div>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>Security Note:</strong> This verification link and code will expire in 15 minutes. If you didn't create a CIM Share account, please ignore this email.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6c757d; margin-top: 30px; text-align: center;">
              Need help? Contact us at <a href="mailto:support@cimshare.com" style="color: #667eea;">support@cimshare.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; color: #6c757d; font-size: 12px;">
            <p style="margin: 0;">
              © ${new Date().getFullYear()} CIM Share. All rights reserved.<br>
              This email was sent to ${email}
            </p>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Welcome to CIM Share!

Hi ${name},

Thank you for registering with CIM Share! To complete your account setup, please verify your email address.

Two ways to verify:

1. Click this link: ${verificationLink}

2. Or enter this verification code: ${code}

This verification code will expire in 15 minutes.

If you didn't create a CIM Share account, please ignore this email.

Need help? Contact us at support@cimshare.com

© ${new Date().getFullYear()} CIM Share. All rights reserved.
      `.trim();

      await mailService.send({
        to: email,
        from: {
          email: this.FROM_EMAIL,
          name: this.FROM_NAME
        },
        subject: 'Verify Your CIM Share Account',
        text: textContent,
        html: emailContent,
      });

      logger.info('Verification email sent successfully', { 
        email,
        code: code.substring(0, 2) + '****' // Log partial code for debugging
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send verification email', { 
        email,
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Verify a verification token
   */
  static verifyToken(token: string, email: string, code: string): boolean {
    try {
      const expectedToken = this.generateVerificationToken(email, code);
      return token === expectedToken;
    } catch (error) {
      logger.error('Token verification failed', { error });
      return false;
    }
  }
}