export const gettingStartedEmailTemplate = {
  subject: "Quick Start: Create Your First CIM in 3 Simple Steps",

  html: (userName: string, unsubscribeLink?: string) => `
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
        .steps-container {
          margin: 32px 0;
        }
        .step {
          display: flex;
          align-items: flex-start;
          margin: 24px 0;
          padding: 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%);
          border-radius: 12px;
          border: 1px solid #e0f2fe;
          transition: all 0.3s ease;
        }
        .step:hover {
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }
        .step-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border-radius: 50%;
          font-weight: 700;
          font-size: 18px;
          flex-shrink: 0;
          margin-right: 20px;
        }
        .step-content {
          flex: 1;
        }
        .step-title {
          font-size: 17px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 8px;
        }
        .step-description {
          font-size: 15px;
          color: #64748b;
          line-height: 1.6;
        }
        .pro-tip {
          background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
          border: 1px solid #fde047;
          border-radius: 12px;
          padding: 20px;
          margin: 32px 0;
        }
        .pro-tip-header {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .pro-tip-icon {
          font-size: 20px;
          margin-right: 8px;
        }
        .pro-tip-title {
          font-weight: 600;
          color: #713f12;
        }
        .pro-tip-text {
          color: #854d0e;
          font-size: 15px;
          line-height: 1.6;
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
        .divider {
          height: 1px;
          background: #e2e8f0;
          margin: 16px 0;
        }
        @media only screen and (max-width: 600px) {
          .header { padding: 32px 24px; }
          .content { padding: 32px 24px; }
          .footer { padding: 20px 24px; }
          .step { flex-direction: column; text-align: center; }
          .step-number { margin: 0 auto 12px auto; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="header-title">Let's Get You Started!</div>
          <div class="header-subtitle">Your first CIM is just 3 steps away</div>
        </div>

        <div class="content">
          <div class="greeting">Hi ${userName},</div>

          <div class="intro-text">
            Ready to experience the power of AI-driven CIM creation? Follow these three simple steps to create your first professional CIM in minutes.
          </div>

          <div class="steps-container">
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-content">
                <div class="step-title">Upload Your Source Material</div>
                <div class="step-description">Simply paste your website URL or upload business documents. Our AI instantly extracts and organizes all relevant information.</div>
              </div>
            </div>

            <div class="step">
              <div class="step-number">2</div>
              <div class="step-content">
                <div class="step-title">Let AI Work Its Magic</div>
                <div class="step-description">Click "Generate CIM" and watch as our AI creates a professional document in under 60 seconds, complete with formatting and structure.</div>
              </div>
            </div>

            <div class="step">
              <div class="step-number">3</div>
              <div class="step-content">
                <div class="step-title">Review, Customize & Share</div>
                <div class="step-description">Fine-tune any section with our intuitive editor, then share securely with built-in NDA protection and tracking.</div>
              </div>
            </div>
          </div>

          <div class="pro-tip">
            <div class="pro-tip-header">
              <span class="pro-tip-icon">💡</span>
              <span class="pro-tip-title">Pro Tip</span>
            </div>
            <div class="pro-tip-text">
              Start with your website URL for the fastest results. CIM Share automatically extracts your company information, team details, and service offerings—saving you even more time!
            </div>
          </div>

          <div class="cta-container">
            <a href="https://cimshare.com/dashboard" class="button">Create Your First CIM Now</a>
          </div>

          <div class="signature">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">Happy creating!</div>
            <div>The CIM Share Team</div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-content">
            <div>Need guidance? We're here to help every step of the way.</div>
            <div class="footer-links">
              <a href="https://cimshare.com/knowledge-base/" class="footer-link">Knowledge Base</a>
              <span style="color: #cbd5e1;">•</span>
              <a href="https://cimshare.com/dashboard" class="footer-link">Dashboard</a>
              <span style="color: #cbd5e1;">•</span>
              <a href="mailto:support@cimshare.com" class="footer-link">Contact Support</a>
            </div>
            <div class="divider"></div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 16px;">
              <strong>CIM Share</strong><br>
              AI-Powered CIM Creation Platform<br>
              606 Venice Blvd<br>
              Venice, CA 90291<br>
              United States<br><br>

              You received this email because you signed up for CIM Share.<br>
              ${unsubscribeLink ? `<a href="${unsubscribeLink}" style="color: #3b82f6; text-decoration: none;">Unsubscribe from onboarding emails</a> | ` : ''}
              <a href="https://cimshare.com/preferences" style="color: #3b82f6; text-decoration: none;">Manage email preferences</a><br><br>

              © 2024 CIM Share. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  text: (userName: string, unsubscribeLink?: string) => `
Let's Get You Started!

Hi ${userName},

Ready to experience the power of AI-driven CIM creation? Follow these three simple steps to create your first professional CIM in minutes.

STEP 1: Upload Your Source Material
Simply paste your website URL or upload business documents. Our AI instantly extracts and organizes all relevant information.

STEP 2: Let AI Work Its Magic
Click "Generate CIM" and watch as our AI creates a professional document in under 60 seconds, complete with formatting and structure.

STEP 3: Review, Customize & Share
Fine-tune any section with our intuitive editor, then share securely with built-in NDA protection and tracking.

💡 PRO TIP: Start with your website URL for the fastest results. CIM Share automatically extracts your company information, team details, and service offerings—saving you even more time!

Create your first CIM now: https://cimshare.com/dashboard

Happy creating!
The CIM Share Team

Need guidance? We're here to help every step of the way.
Knowledge Base: https://cimshare.com/knowledge-base/
Contact Support: support@cimshare.com

---
CIM Share
AI-Powered CIM Creation Platform
606 Venice Blvd
Venice, CA 90291
United States

You received this email because you signed up for CIM Share.
${unsubscribeLink ? `Unsubscribe: ${unsubscribeLink}` : ''}
Manage preferences: https://cimshare.com/preferences

© 2024 CIM Share. All rights reserved.
  `
};