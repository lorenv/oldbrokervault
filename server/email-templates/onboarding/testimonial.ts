export const testimonialEmailTemplate = {
  subject: "How Sarah Saved 50+ Hours Last Month with CIM Share",

  html: (userName: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1e293b;
          margin: 0;
          padding: 0;
          background-color: #f8fafc;
        }
        .wrapper {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .header {
          background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%);
          color: white;
          padding: 48px 32px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
          background-size: 20px 20px;
          animation: shimmer 20s linear infinite;
        }
        @keyframes shimmer {
          0% { transform: translate(0, 0); }
          100% { transform: translate(20px, 20px); }
        }
        .header-title {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
          position: relative;
          z-index: 1;
        }
        .header-subtitle {
          font-size: 16px;
          opacity: 0.95;
          position: relative;
          z-index: 1;
        }
        .content {
          padding: 40px 32px;
          background: #ffffff;
        }
        .greeting {
          font-size: 18px;
          color: #1e293b;
          margin-bottom: 24px;
          font-weight: 500;
        }
        .intro-text {
          font-size: 16px;
          color: #475569;
          margin-bottom: 32px;
          line-height: 1.7;
        }
        .testimonial-card {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-left: 4px solid #3b82f6;
          border-radius: 12px;
          padding: 28px;
          margin: 32px 0;
          position: relative;
        }
        .quote-mark {
          position: absolute;
          top: 20px;
          left: 24px;
          font-size: 48px;
          color: #3b82f6;
          opacity: 0.2;
          font-family: Georgia, serif;
        }
        .testimonial-text {
          font-size: 16px;
          line-height: 1.8;
          color: #475569;
          font-style: italic;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }
        .testimonial-highlight {
          background: linear-gradient(to right, #fef3c7, transparent);
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 600;
          font-style: normal;
          color: #713f12;
        }
        .testimonial-author {
          display: flex;
          align-items: center;
          margin-top: 20px;
        }
        .author-avatar {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 18px;
          margin-right: 16px;
        }
        .author-info {
          flex: 1;
        }
        .author-name {
          font-weight: 600;
          color: #1e293b;
          font-size: 16px;
        }
        .author-title {
          color: #64748b;
          font-size: 14px;
        }
        .results-section {
          margin: 40px 0;
        }
        .results-title {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 24px;
          text-align: center;
        }
        .results-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin: 24px 0;
        }
        .result-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          transition: all 0.3s ease;
        }
        .result-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
          border-color: #3b82f6;
        }
        .result-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }
        .result-value {
          font-size: 24px;
          font-weight: 700;
          color: #3b82f6;
          margin-bottom: 4px;
        }
        .result-label {
          font-size: 14px;
          color: #64748b;
        }
        .impact-question {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-radius: 12px;
          padding: 24px;
          margin: 32px 0;
          text-align: center;
        }
        .impact-title {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 12px;
        }
        .impact-text {
          font-size: 16px;
          color: #475569;
          line-height: 1.7;
        }
        .cta-container {
          text-align: center;
          margin: 40px 0;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.25);
          transition: all 0.2s ease;
        }
        .button:hover {
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35);
          transform: translateY(-1px);
        }
        .pro-tip {
          background: #fef3c7;
          border-radius: 12px;
          padding: 20px;
          margin: 32px 0;
        }
        .pro-tip-content {
          display: flex;
          align-items: flex-start;
        }
        .pro-tip-icon {
          font-size: 24px;
          margin-right: 12px;
        }
        .pro-tip-text {
          flex: 1;
          color: #713f12;
          font-size: 15px;
          line-height: 1.6;
        }
        .signature {
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
          color: #475569;
          font-size: 15px;
        }
        .footer {
          background: #f8fafc;
          padding: 24px 32px;
          border-top: 1px solid #e2e8f0;
        }
        .footer-content {
          text-align: center;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
        }
        .footer-links {
          margin-top: 16px;
        }
        .footer-link {
          color: #3b82f6;
          text-decoration: none;
          margin: 0 8px;
          font-size: 14px;
        }
        .footer-link:hover {
          text-decoration: underline;
        }
        @media only screen and (max-width: 600px) {
          .header { padding: 32px 24px; }
          .content { padding: 32px 24px; }
          .footer { padding: 20px 24px; }
          .results-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="header-title">Real Results from Real Users</div>
          <div class="header-subtitle">Discover how professionals are transforming their workflow</div>
        </div>

        <div class="content">
          <div class="greeting">Hi ${userName},</div>

          <div class="intro-text">
            Don't just take our word for it. See how Sarah Mitchell transformed her business with CIM Share:
          </div>

          <div class="testimonial-card">
            <div class="quote-mark">“</div>
            <div class="testimonial-text">
              I was skeptical at first—I've been creating CIMs manually for 15 years. But CIM Share completely transformed my workflow.
              <br><br>
              Last month alone, I created <span class="testimonial-highlight">12 CIMs</span> for different clients. What used to take me an entire week now takes just a couple of hours total.
              <br><br>
              The best part? The quality is actually <strong>better</strong> than what I was producing manually. The AI catches details I might miss and maintains perfect consistency across all sections.
              <br><br>
              I can't imagine going back to the old way.
            </div>
            <div class="testimonial-author">
              <div class="author-avatar">SM</div>
              <div class="author-info">
                <div class="author-name">Sarah Mitchell</div>
                <div class="author-title">Managing Director, Apex Business Advisors</div>
              </div>
            </div>
          </div>

          <div class="results-section">
            <div class="results-title">Sarah's Incredible Results</div>
            <div class="results-grid">
              <div class="result-card">
                <div class="result-icon">⏱️</div>
                <div class="result-value">50+ hrs</div>
                <div class="result-label">Saved per month</div>
              </div>
              <div class="result-card">
                <div class="result-icon">📈</div>
                <div class="result-value">3x</div>
                <div class="result-label">More deals closed</div>
              </div>
              <div class="result-card">
                <div class="result-icon">✅</div>
                <div class="result-value">100%</div>
                <div class="result-label">Data accuracy</div>
              </div>
              <div class="result-card">
                <div class="result-icon">😌</div>
                <div class="result-value">Zero</div>
                <div class="result-label">Formatting stress</div>
              </div>
            </div>
          </div>

          <div class="impact-question">
            <div class="impact-title">What Could You Achieve?</div>
            <div class="impact-text">
              With 50+ hours back each month, Sarah expanded her client base by 40%.<br>
              Another user launched a new service line. Someone else finally took that vacation.<br>
              <strong>Your success story starts today.</strong>
            </div>
          </div>

          <div class="cta-container">
            <a href="https://cimshare.com/dashboard" class="button">Start Your Success Story</a>
          </div>

          <div class="pro-tip">
            <div class="pro-tip-content">
              <span class="pro-tip-icon">🎁</span>
              <div class="pro-tip-text">
                <strong>Sarah's Secret:</strong> "Start with your most complex CIM first. When you see how easily CIM Share handles it, you'll never look back. The AI actually understood my business better than some junior analysts!"
              </div>
            </div>
          </div>

          <div class="signature">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">Here's to your success,</div>
            <div>The CIM Share Team</div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-content">
            <div>Ready to join thousands of successful professionals?</div>
            <div class="footer-links">
              <a href="https://cimshare.com/knowledge-base/" class="footer-link">Knowledge Base</a>
              <span style="color: #cbd5e1;">•</span>
              <a href="https://cimshare.com/dashboard" class="footer-link">Dashboard</a>
              <span style="color: #cbd5e1;">•</span>
              <a href="mailto:support@cimshare.com" class="footer-link">Contact Support</a>
            </div>
            <div style="height: 1px; background: #e2e8f0; margin: 16px 0;"></div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 16px;">
              CIM Share • AI-Powered CIM Creation<br>
              © 2024 CIM Share. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  text: (userName: string) => `
Real Results from Real Users

Hi ${userName},

Don't just take our word for it. See how Sarah Mitchell transformed her business with CIM Share:

"I was skeptical at first—I've been creating CIMs manually for 15 years. But CIM Share completely transformed my workflow.

Last month alone, I created 12 CIMs for different clients. What used to take me an entire week now takes just a couple of hours total.

The best part? The quality is actually better than what I was producing manually. The AI catches details I might miss and maintains perfect consistency across all sections.

I can't imagine going back to the old way."

– Sarah Mitchell, Managing Director, Apex Business Advisors

SARAH'S INCREDIBLE RESULTS:
⏱️ 50+ hours saved per month
📈 3x more deals closed
✅ 100% data accuracy
😌 Zero formatting stress

WHAT COULD YOU ACHIEVE?
With 50+ hours back each month, Sarah expanded her client base by 40%.
Another user launched a new service line. Someone else finally took that vacation.
Your success story starts today.

Start your success story: https://cimshare.com/dashboard

🎁 SARAH'S SECRET: "Start with your most complex CIM first. When you see how easily CIM Share handles it, you'll never look back. The AI actually understood my business better than some junior analysts!"

Here's to your success,
The CIM Share Team

Ready to join thousands of successful professionals?
Knowledge Base: https://cimshare.com/knowledge-base/
Contact Support: support@cimshare.com

© 2024 CIM Share. All rights reserved.
  `
};