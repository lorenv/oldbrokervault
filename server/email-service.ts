import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface SendTemplateEmailParams {
  to: string;
  templateId: string;
  dynamicTemplateData?: Record<string, any>;
  from?: string;
}

export class EmailService {
  private defaultFromEmail = 'noreply@cimshare.io'; // Update with your actual from email

  async sendTemplateEmail(params: SendTemplateEmailParams): Promise<boolean> {
    try {
      await mailService.send({
        to: params.to,
        from: params.from || this.defaultFromEmail,
        templateId: params.templateId,
        dynamicTemplateData: params.dynamicTemplateData || {},
      });
      
      console.log(`Email sent successfully to ${params.to} using template ${params.templateId}`);
      return true;
    } catch (error) {
      console.error('SendGrid email error:', error);
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