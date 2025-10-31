import { MailService } from '@sendgrid/mail';

// Lazy initialization - don't crash if key is missing
let mailService: MailService | null = null;

function getMailService(): MailService | null {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set - email functionality will be disabled');
    return null;
  }

  if (!mailService) {
    mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('SendGrid mail service initialized');
  }

  return mailService;
}

interface SendTemplateEmailParams {
  to: string;
  templateId: string;
  dynamicTemplateData?: Record<string, any>;
  from?: string;
}

export class EmailService {
  private defaultFromEmail = 'support@cimshare.com'; // Updated to use verified sender

  async sendTemplateEmail(params: SendTemplateEmailParams): Promise<boolean> {
    const service = getMailService();

    if (!service) {
      console.warn(`Email not sent (SendGrid not configured): ${params.to}`);
      return false;
    }

    try {
      await service.send({
        to: params.to,
        from: params.from || this.defaultFromEmail,
        templateId: params.templateId,
        dynamicTemplateData: params.dynamicTemplateData || {},
      });
      
      console.log(`Email sent successfully to ${params.to} using template ${params.templateId}`);
      return true;
    } catch (error: any) {
      console.error('SendGrid email error:', error);
      // Log more detailed error information for debugging
      if (error.response) {
        console.error('SendGrid error response:', {
          statusCode: error.code,
          body: error.response.body,
          headers: error.response.headers
        });
      }
      return false;
    }
  }

  async sendWelcomeEmail(userEmail: string, userName?: string): Promise<boolean> {
    return this.sendTemplateEmail({
      to: userEmail,
      from: 'support@cimshare.com',
      templateId: 'd-470daf43d03f4e769ff1ad67effcb998',
      dynamicTemplateData: {
        user_name: userName || 'there',
        app_name: 'CIM Share'
      }
    });
  }
}

export const emailService = new EmailService();