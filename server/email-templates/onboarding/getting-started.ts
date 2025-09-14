export const gettingStartedEmailTemplate = {
  subject: "Quick Start: Create Your First CIM in 3 Simple Steps",

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
        .step { background: #f9fafb; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .step-number { display: inline-block; background: #667eea; color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 10px; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        .tip { background: #fef3c7; border: 1px solid #fbbf24; padding: 12px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Let's Get You Started!</h1>
      </div>

      <div class="content">
        <p>Hi ${userName},</p>

        <p>Creating your first CIM with CIM Share is incredibly simple. Here's how to do it in just <strong>3 easy steps</strong>:</p>

        <div class="step">
          <p><span class="step-number">1</span><strong>Upload Your Source Material</strong></p>
          <p style="margin-left: 38px;">Drop in your business documents, financials, or even just paste your website URL. Our AI will extract all the relevant information.</p>
        </div>

        <div class="step">
          <p><span class="step-number">2</span><strong>Let AI Work Its Magic</strong></p>
          <p style="margin-left: 38px;">Click "Generate CIM" and watch as our AI creates a professional document in under 60 seconds. It analyzes, structures, and formats everything automatically.</p>
        </div>

        <div class="step">
          <p><span class="step-number">3</span><strong>Customize & Share</strong></p>
          <p style="margin-left: 38px;">Review your CIM, make any edits you want (you have full control!), then share it securely with potential buyers or investors.</p>
        </div>

        <div class="tip">
          <strong>💡 Pro Tip:</strong> Start with your website URL for the fastest results. CIM Share can pull all your business information directly from your site!
        </div>

        <p>That's it! You're ready to create professional CIMs in minutes instead of hours.</p>

        <div style="text-align: center;">
          <a href="${process.env.APP_URL}/dashboard/new" class="button">Get Started Now</a>
        </div>

        <p>Questions? Just reply to this email – we're here to help!</p>

        <p>Happy creating,<br>
        The CIM Share Team</p>
      </div>

      <div class="footer">
        <p>📚 Want to learn more? Check out our <a href="${process.env.APP_URL}/help">help center</a></p>
      </div>
    </body>
    </html>
  `,

  text: (userName: string) => `
Let's Get You Started!

Hi ${userName},

Creating your first CIM with CIM Share is incredibly simple. Here's how to do it in just 3 easy steps:

STEP 1: Upload Your Source Material
Drop in your business documents, financials, or even just paste your website URL. Our AI will extract all the relevant information.

STEP 2: Let AI Work Its Magic
Click "Generate CIM" and watch as our AI creates a professional document in under 60 seconds. It analyzes, structures, and formats everything automatically.

STEP 3: Customize & Share
Review your CIM, make any edits you want (you have full control!), then share it securely with potential buyers or investors.

💡 Pro Tip: Start with your website URL for the fastest results. CIM Share can pull all your business information directly from your site!

That's it! You're ready to create professional CIMs in minutes instead of hours.

Get started now: ${process.env.APP_URL}/dashboard/new

Questions? Just reply to this email – we're here to help!

Happy creating,
The CIM Share Team

Want to learn more? Check out our help center: ${process.env.APP_URL}/help
  `
};