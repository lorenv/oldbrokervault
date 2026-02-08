import { storage } from './storage';
import { emailService } from './email-service';

export class OnboardingEmailSystem {
  async processPendingEmails(): Promise<void> {
    try {
      console.log('🔄 Processing pending onboarding emails...');
      
      const pendingEmails = await storage.getPendingEmails();
      
      if (pendingEmails.length === 0) {
        console.log('✅ No pending emails to process');
        return;
      }

      console.log(`📧 Found ${pendingEmails.length} pending emails to process`);

      for (const email of pendingEmails) {
        try {
          console.log(`📤 Sending ${email.sequenceName} to ${email.userEmail} (Queue ID: ${email.queueId})`);
          
          const success = await emailService.sendTemplateEmail({
            to: email.userEmail,
            from: 'support@brokervault.ai',
            templateId: email.templateId,
            dynamicTemplateData: {
              user_name: email.userName || 'there',
              app_name: 'Broker Vault'
            }
          });

          if (success) {
            await storage.markEmailAsSent(email.queueId);
            console.log(`✅ Successfully sent ${email.sequenceName} to ${email.userEmail}`);
          } else {
            await storage.markEmailAsFailed(email.queueId, 'Failed to send email via SendGrid');
            console.error(`❌ Failed to send ${email.sequenceName} to ${email.userEmail}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await storage.markEmailAsFailed(email.queueId, errorMessage);
          console.error(`❌ Error sending ${email.sequenceName} to ${email.userEmail}:`, error);
        }
      }
      
      console.log('✅ Finished processing pending emails');
    } catch (error) {
      console.error('❌ Error processing pending emails:', error);
    }
  }

  async scheduleEmailProcessing(): Promise<void> {
    // Process emails immediately and then set up periodic processing
    await this.processPendingEmails();
    
    // Set up periodic processing every 5 minutes
    setInterval(async () => {
      await this.processPendingEmails();
    }, 5 * 60 * 1000); // 5 minutes
  }
}

export const onboardingEmailSystem = new OnboardingEmailSystem();