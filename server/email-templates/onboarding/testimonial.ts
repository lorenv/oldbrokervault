export const testimonialEmailTemplate = {
  subject: "How Sarah Saved 50+ Hours Last Month with CIM Share",

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
        .testimonial { background: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; font-style: italic; }
        .author { margin-top: 15px; font-style: normal; font-weight: 600; color: #667eea; }
        .results { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .result-item { display: flex; align-items: center; margin: 10px 0; }
        .result-icon { font-size: 24px; margin-right: 15px; }
        .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Real Results from Real Users</h1>
      </div>

      <div class="content">
        <p>Hi ${userName},</p>

        <p>Don't just take our word for it. Here's what Sarah Mitchell, Managing Director at Apex Business Advisors, has to say:</p>

        <div class="testimonial">
          <p>"I was skeptical at first – I've been creating CIMs manually for 15 years. But CIM Share completely transformed my workflow.</p>

          <p>Last month alone, I created <span class="highlight">12 CIMs</span> for different clients. What used to take me an entire week now takes just a couple of hours total.</p>

          <p>The best part? The quality is actually <strong>better</strong> than what I was producing manually. The AI catches details I might miss and maintains perfect consistency across all sections.</p>

          <p>I can't imagine going back to the old way."</p>

          <div class="author">– Sarah Mitchell, Managing Director, Apex Business Advisors</div>
        </div>

        <h2>Sarah's Results:</h2>

        <div class="results">
          <div class="result-item">
            <span class="result-icon">⏰</span>
            <div><strong>50+ hours saved</strong> in just one month</div>
          </div>
          <div class="result-item">
            <span class="result-icon">📈</span>
            <div><strong>3x more deals</strong> closed due to faster turnaround</div>
          </div>
          <div class="result-item">
            <span class="result-icon">✨</span>
            <div><strong>100% accuracy</strong> with automated data extraction</div>
          </div>
          <div class="result-item">
            <span class="result-icon">😊</span>
            <div><strong>Zero stress</strong> about formatting and consistency</div>
          </div>
        </div>

        <p><strong>What could you accomplish with an extra 50 hours every month?</strong></p>

        <p>Sarah took on more clients. Another user finally launched that new service line. Someone else just enjoyed having weekends again.</p>

        <p>Your success story is waiting to be written.</p>

        <div style="text-align: center;">
          <a href="${process.env.APP_URL}/dashboard/new" class="button">Start Creating Like Sarah</a>
        </div>

        <p>Here's to your success,<br>
        The CIM Share Team</p>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin-top: 25px;">
          <p style="margin: 0;"><strong>🎁 Special Tip from Sarah:</strong> "Start with your most complex CIM first. When you see how easily CIM Share handles it, you'll never look back."</p>
        </div>
      </div>

      <div class="footer">
        <p>Ready to transform your workflow? The next success story could be yours.</p>
      </div>
    </body>
    </html>
  `,

  text: (userName: string) => `
Real Results from Real Users

Hi ${userName},

Don't just take our word for it. Here's what Sarah Mitchell, Managing Director at Apex Business Advisors, has to say:

"I was skeptical at first – I've been creating CIMs manually for 15 years. But CIM Share completely transformed my workflow.

Last month alone, I created 12 CIMs for different clients. What used to take me an entire week now takes just a couple of hours total.

The best part? The quality is actually better than what I was producing manually. The AI catches details I might miss and maintains perfect consistency across all sections.

I can't imagine going back to the old way."

– Sarah Mitchell, Managing Director, Apex Business Advisors

SARAH'S RESULTS:
⏰ 50+ hours saved in just one month
📈 3x more deals closed due to faster turnaround
✨ 100% accuracy with automated data extraction
😊 Zero stress about formatting and consistency

What could you accomplish with an extra 50 hours every month?

Sarah took on more clients. Another user finally launched that new service line. Someone else just enjoyed having weekends again.

Your success story is waiting to be written.

Start creating like Sarah: ${process.env.APP_URL}/dashboard/new

Here's to your success,
The CIM Share Team

🎁 Special Tip from Sarah: "Start with your most complex CIM first. When you see how easily CIM Share handles it, you'll never look back."

Ready to transform your workflow? The next success story could be yours.
  `
};