export const painSolutionEmailTemplate = {
  subject: "Stop Wasting Hours on CIM Creation - There's a Better Way",

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
        .pain-point { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .solution { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .comparison { display: flex; justify-content: space-between; margin: 20px 0; }
        .comparison-item { flex: 1; padding: 15px; text-align: center; }
        .old-way { background: #f9fafb; }
        .new-way { background: #f0f9ff; border: 2px solid #667eea; }
        .stat { font-size: 32px; font-weight: bold; color: #667eea; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Your Time is Too Valuable for This</h1>
      </div>

      <div class="content">
        <p>Hi ${userName},</p>

        <p>Let me guess – you've spent countless hours creating CIM documents, haven't you?</p>

        <div class="pain-point">
          <strong>😫 The Traditional Way:</strong>
          <ul style="margin: 10px 0;">
            <li>8-12 hours formatting and writing</li>
            <li>Endless copy-pasting from different sources</li>
            <li>Constant revisions and updates</li>
            <li>Worrying about consistency and accuracy</li>
            <li>Starting from scratch every single time</li>
          </ul>
        </div>

        <p><strong>We know it's frustrating.</strong> That's exactly why we built CIM Share.</p>

        <div class="solution">
          <strong>✨ The CIM Share Way:</strong>
          <ul style="margin: 10px 0;">
            <li>Complete CIM in under 60 seconds</li>
            <li>AI extracts and organizes everything automatically</li>
            <li>Professional formatting every time</li>
            <li>100% accurate data pulled from your sources</li>
            <li>Full control to customize anything you want</li>
          </ul>
        </div>

        <h2>See the Difference:</h2>

        <div class="comparison">
          <div class="comparison-item old-way">
            <p><strong>Without CIM Share</strong></p>
            <p class="stat">12 hrs</p>
            <p>Average time to create one CIM</p>
          </div>
          <div class="comparison-item new-way">
            <p><strong>With CIM Share</strong></p>
            <p class="stat">15 min</p>
            <p>Including review and customization!</p>
          </div>
        </div>

        <p><strong>Imagine what you could do with those extra 11+ hours.</strong></p>

        <p>More client meetings? Strategic planning? Or maybe just getting home on time for once?</p>

        <p>Stop letting CIM creation steal your valuable time. Let AI handle the heavy lifting while you stay in complete control.</p>

        <div style="text-align: center;">
          <a href="${process.env.APP_URL}/dashboard/new" class="button">Try CIM Share Today</a>
        </div>

        <p>Your time is worth more than this,<br>
        The CIM Share Team</p>
      </div>

      <div class="footer">
        <p>PS: Most users create their first CIM within 5 minutes of signing up. Will you be next?</p>
      </div>
    </body>
    </html>
  `,

  text: (userName: string) => `
Your Time is Too Valuable for This

Hi ${userName},

Let me guess – you've spent countless hours creating CIM documents, haven't you?

😫 THE TRADITIONAL WAY:
• 8-12 hours formatting and writing
• Endless copy-pasting from different sources
• Constant revisions and updates
• Worrying about consistency and accuracy
• Starting from scratch every single time

We know it's frustrating. That's exactly why we built CIM Share.

✨ THE CIM SHARE WAY:
• Complete CIM in under 60 seconds
• AI extracts and organizes everything automatically
• Professional formatting every time
• 100% accurate data pulled from your sources
• Full control to customize anything you want

SEE THE DIFFERENCE:
Without CIM Share: 12 hours average time to create one CIM
With CIM Share: 15 minutes including review and customization!

Imagine what you could do with those extra 11+ hours.

More client meetings? Strategic planning? Or maybe just getting home on time for once?

Stop letting CIM creation steal your valuable time. Let AI handle the heavy lifting while you stay in complete control.

Try CIM Share today: ${process.env.APP_URL}/dashboard/new

Your time is worth more than this,
The CIM Share Team

PS: Most users create their first CIM within 5 minutes of signing up. Will you be next?
  `
};