import { db } from './db';
import { users } from '../shared/schema';
import { gte } from 'drizzle-orm';
import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

export class DailySignupSummaryService {
  async sendDailySummary(): Promise<void> {
    try {
      console.log('📊 Starting daily signup summary check...');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const newUsers = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          name: users.name,
          email: users.email,
          subscriptionStatus: users.subscriptionStatus,
          createdAt: users.createdAt
        })
        .from(users)
        .where(gte(users.createdAt, yesterday));

      if (newUsers.length === 0) {
        console.log('✅ No new users signed up yesterday. Skipping email.');
        return;
      }

      console.log(`📧 Found ${newUsers.length} new user(s). Preparing email...`);

      const emailHtml = this.generateEmailHtml(newUsers);
      const emailText = this.generateEmailText(newUsers);

      await mailService.send({
        to: 'robertkale20@gmail.com',
        from: 'support@cimshare.com',
        subject: `Daily Signup Summary - ${newUsers.length} New User${newUsers.length > 1 ? 's' : ''}`,
        html: emailHtml,
        text: emailText
      });

      console.log('✅ Daily signup summary email sent successfully');
    } catch (error) {
      console.error('❌ Error sending daily signup summary:', error);
    }
  }

  private generateEmailHtml(users: any[]): string {
    const userRows = users.map(user => {
      const displayName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.name || 'N/A';
      
      return `
        <tr>
          <td style="padding: 12px; border: 1px solid #ddd;">${displayName}</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${user.email}</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${user.subscriptionStatus}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #2563eb; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #2563eb; color: white; padding: 12px; text-align: left; border: 1px solid #ddd; }
          .summary { background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Daily Signup Summary</h1>
          <div class="summary">
            <strong>Total New Users:</strong> ${users.length}
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Subscription Status</th>
              </tr>
            </thead>
            <tbody>
              ${userRows}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
  }

  private generateEmailText(users: any[]): string {
    const userList = users.map(user => {
      const displayName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`
        : user.name || 'N/A';
      
      return `- ${displayName} (${user.email}) - ${user.subscriptionStatus}`;
    }).join('\n');

    return `
Daily Signup Summary

Total New Users: ${users.length}

${userList}
    `.trim();
  }

  async scheduleDaily(): Promise<void> {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    console.log(`⏰ Scheduling daily signup summary. Next run in ${Math.round(msUntilMidnight / 1000 / 60 / 60)} hours`);

    setTimeout(async () => {
      await this.sendDailySummary();
      setInterval(async () => {
        await this.sendDailySummary();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }
}

export const dailySignupSummary = new DailySignupSummaryService();
