import sgMail from '@sendgrid/mail';
import { welcomeEmailTemplate } from '../email-templates/onboarding/welcome';
import { gettingStartedEmailTemplate } from '../email-templates/onboarding/getting-started';
import { painSolutionEmailTemplate } from '../email-templates/onboarding/pain-solution';
import { testimonialEmailTemplate } from '../email-templates/onboarding/testimonial';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface OnboardingEmailData {
  email: string;
  userName: string;
  userId: number;
}

// Email delay configuration (in milliseconds)
const EMAIL_DELAYS = {
  welcome: 0,           // Immediate
  gettingStarted: 60 * 60 * 1000,    // 1 hour
  painSolution: 24 * 60 * 60 * 1000,  // 1 day
  testimonial: 48 * 60 * 60 * 1000    // 2 days
};

class OnboardingEmailService {
  private scheduledEmails: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start the onboarding email sequence for a new user
   */
  async startOnboardingSequence(userData: OnboardingEmailData): Promise<void> {
    console.log(`Starting onboarding email sequence for ${userData.email}`);

    // Send welcome email immediately
    await this.sendWelcomeEmail(userData);

    // Schedule the remaining emails
    this.scheduleEmail('gettingStarted', userData, EMAIL_DELAYS.gettingStarted);
    this.scheduleEmail('painSolution', userData, EMAIL_DELAYS.painSolution);
    this.scheduleEmail('testimonial', userData, EMAIL_DELAYS.testimonial);
  }

  /**
   * Send the welcome email (Email 1)
   */
  private async sendWelcomeEmail(userData: OnboardingEmailData): Promise<void> {
    try {
      const msg = {
        to: userData.email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@cimshare.com',
        subject: welcomeEmailTemplate.subject,
        text: welcomeEmailTemplate.text(userData.userName),
        html: welcomeEmailTemplate.html(userData.userName),
      };

      await sgMail.send(msg);
      console.log(`Welcome email sent to ${userData.email}`);
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }

  /**
   * Send the getting started email (Email 2)
   */
  private async sendGettingStartedEmail(userData: OnboardingEmailData): Promise<void> {
    try {
      const msg = {
        to: userData.email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@cimshare.com',
        subject: gettingStartedEmailTemplate.subject,
        text: gettingStartedEmailTemplate.text(userData.userName),
        html: gettingStartedEmailTemplate.html(userData.userName),
      };

      await sgMail.send(msg);
      console.log(`Getting started email sent to ${userData.email}`);
    } catch (error) {
      console.error('Error sending getting started email:', error);
    }
  }

  /**
   * Send the pain/solution email (Email 3)
   */
  private async sendPainSolutionEmail(userData: OnboardingEmailData): Promise<void> {
    try {
      const msg = {
        to: userData.email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@cimshare.com',
        subject: painSolutionEmailTemplate.subject,
        text: painSolutionEmailTemplate.text(userData.userName),
        html: painSolutionEmailTemplate.html(userData.userName),
      };

      await sgMail.send(msg);
      console.log(`Pain/solution email sent to ${userData.email}`);
    } catch (error) {
      console.error('Error sending pain/solution email:', error);
    }
  }

  /**
   * Send the testimonial email (Email 4)
   */
  private async sendTestimonialEmail(userData: OnboardingEmailData): Promise<void> {
    try {
      const msg = {
        to: userData.email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@cimshare.com',
        subject: testimonialEmailTemplate.subject,
        text: testimonialEmailTemplate.text(userData.userName),
        html: testimonialEmailTemplate.html(userData.userName),
      };

      await sgMail.send(msg);
      console.log(`Testimonial email sent to ${userData.email}`);
    } catch (error) {
      console.error('Error sending testimonial email:', error);
    }
  }

  /**
   * Schedule an email to be sent after a delay
   */
  private scheduleEmail(
    emailType: 'gettingStarted' | 'painSolution' | 'testimonial',
    userData: OnboardingEmailData,
    delay: number
  ): void {
    const timeoutId = setTimeout(async () => {
      switch (emailType) {
        case 'gettingStarted':
          await this.sendGettingStartedEmail(userData);
          break;
        case 'painSolution':
          await this.sendPainSolutionEmail(userData);
          break;
        case 'testimonial':
          await this.sendTestimonialEmail(userData);
          break;
      }

      // Clean up the scheduled email from our map
      this.scheduledEmails.delete(`${userData.userId}-${emailType}`);
    }, delay);

    // Store the timeout ID so we can cancel if needed
    this.scheduledEmails.set(`${userData.userId}-${emailType}`, timeoutId);

    console.log(`Scheduled ${emailType} email for ${userData.email} in ${delay / 1000} seconds`);
  }

  /**
   * Cancel all scheduled emails for a user (e.g., if they unsubscribe)
   */
  cancelScheduledEmails(userId: number): void {
    const emailTypes = ['gettingStarted', 'painSolution', 'testimonial'];

    emailTypes.forEach(emailType => {
      const key = `${userId}-${emailType}`;
      const timeoutId = this.scheduledEmails.get(key);

      if (timeoutId) {
        clearTimeout(timeoutId);
        this.scheduledEmails.delete(key);
        console.log(`Cancelled scheduled ${emailType} email for user ${userId}`);
      }
    });
  }

  /**
   * Send a test version of all emails immediately (for testing)
   */
  async sendTestSequence(userData: OnboardingEmailData): Promise<void> {
    console.log('Sending test onboarding sequence...');

    await this.sendWelcomeEmail(userData);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between emails

    await this.sendGettingStartedEmail(userData);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.sendPainSolutionEmail(userData);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.sendTestimonialEmail(userData);

    console.log('Test sequence complete!');
  }
}

// Export singleton instance
export const onboardingEmailService = new OnboardingEmailService();