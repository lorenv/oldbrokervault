export const welcomeEmailTemplate = {
  subject: "Welcome to CIM Share - Your AI-Powered CIM Creation Tool",

  html: (userName: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #5a67d8; }
        h1 { margin: 0; font-size: 28px; }
        h2 { color: #667eea; font-size: 20px; margin-top: 25px; }
        .highlight { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Welcome to CIM Share!</h1>
      </div>

      <div class="content">
        <p>Hi ${userName},</p>

        <p><strong>Thank you for joining CIM Share!</strong> You're now part of a community that's revolutionizing how CIM documents are created.</p>

        <h2>What is CIM Share?</h2>

        <div class="highlight">
          <p>CIM Share is your AI-powered assistant that:</p>
          <ul style="margin: 10px 0;">
            <li>✨ Creates professional CIM documents in minutes, not hours</li>
            <li>🎯 Gives you complete control over every detail</li>
            <li>🚀 Automates the tedious work while you focus on strategy</li>
          </ul>
        </div>

        <p>Ready to explore? Your workspace is waiting for you.</p>

        <div style="text-align: center;">
          <a href="${process.env.APP_URL}/dashboard" class="button">Log In & Explore</a>
        </div>

        <p>We're excited to have you on board!</p>

        <p>Best regards,<br>
        The CIM Share Team</p>
      </div>

      <div class="footer">
        <p>Need help? Reply to this email and we'll assist you right away.</p>
      </div>
    </body>
    </html>
  `,

  text: (userName: string) => `
Welcome to CIM Share!

Hi ${userName},

Thank you for joining CIM Share! You're now part of a community that's revolutionizing how CIM documents are created.

What is CIM Share?
CIM Share is your AI-powered assistant that:
• Creates professional CIM documents in minutes, not hours
• Gives you complete control over every detail
• Automates the tedious work while you focus on strategy

Ready to explore? Your workspace is waiting for you.

Log in at: ${process.env.APP_URL}/dashboard

We're excited to have you on board!

Best regards,
The CIM Share Team

Need help? Reply to this email and we'll assist you right away.
  `
};