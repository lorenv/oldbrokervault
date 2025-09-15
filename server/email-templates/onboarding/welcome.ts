export const welcomeEmailTemplate = {
  subject: "Welcome to CIM Share - Your AI-Powered CIM Creation Tool",

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
        .logo {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
          position: relative;
          z-index: 1;
        }
        .tagline {
          font-size: 16px;
          opacity: 0.95;
          font-weight: 400;
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
        .main-message {
          font-size: 16px;
          color: #475569;
          margin-bottom: 32px;
          line-height: 1.7;
        }
        .section-title {
          font-size: 20px;
          color: #1e293b;
          font-weight: 600;
          margin: 32px 0 16px 0;
          letter-spacing: -0.3px;
        }
        .feature-card {
          background: linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%);
          border: 1px solid #e0f2fe;
          border-radius: 12px;
          padding: 24px;
          margin: 24px 0;
        }
        .feature-list {
          list-style: none;
          padding: 0;
          margin: 16px 0;
        }
        .feature-item {
          display: flex;
          align-items: flex-start;
          margin: 12px 0;
          font-size: 15px;
          color: #475569;
          line-height: 1.6;
        }
        .feature-icon {
          display: inline-block;
          width: 24px;
          height: 24px;
          background: #3b82f6;
          color: white;
          border-radius: 50%;
          text-align: center;
          line-height: 24px;
          margin-right: 12px;
          flex-shrink: 0;
          font-size: 14px;
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
          .logo { font-size: 28px; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="logo">CIM Share</div>
          <div class="tagline">AI-Powered CIM Creation Platform</div>
        </div>

        <div class="content">
          <div class="greeting">Hi ${userName},</div>

          <div class="main-message">
            Welcome to CIM Share! You've just joined thousands of professionals who are transforming how they create and share CIM documents.
          </div>

          <div class="section-title">Your AI-Powered Advantage</div>

          <div class="feature-card">
            <ul class="feature-list">
              <li class="feature-item">
                <span class="feature-icon">⚡</span>
                <span><strong>Lightning Fast:</strong> Create professional CIMs in minutes instead of days</span>
              </li>
              <li class="feature-item">
                <span class="feature-icon">🎯</span>
                <span><strong>Full Control:</strong> AI assists while you maintain complete editorial control</span>
              </li>
              <li class="feature-item">
                <span class="feature-icon">🔒</span>
                <span><strong>Secure Sharing:</strong> Built-in NDA protection and document tracking</span>
              </li>
              <li class="feature-item">
                <span class="feature-icon">📊</span>
                <span><strong>Smart Analytics:</strong> Track engagement and manage your investor pipeline</span>
              </li>
            </ul>
          </div>

          <div class="cta-container">
            <a href="https://cimshare.com/dashboard" class="button">Start Creating Your First CIM</a>
          </div>

          <div class="signature">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">Welcome aboard!</div>
            <div>The CIM Share Team</div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-content">
            <div>Questions? Our support team is here to help.</div>
            <div class="footer-links">
              <a href="https://cimshare.com/knowledge-base/" class="footer-link">Knowledge Base</a>
              <span style="color: #cbd5e1;">•</span>
              <a href="https://cimshare.com/dashboard" class="footer-link">Dashboard</a>
              <span style="color: #cbd5e1;">•</span>
              <a href="mailto:support@cimshare.com" class="footer-link">Contact Support</a>
            </div>
            <div class="divider"></div>
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
Welcome to CIM Share!

Hi ${userName},

Welcome to CIM Share! You've just joined thousands of professionals who are transforming how they create and share CIM documents.

YOUR AI-POWERED ADVANTAGE:
⚡ Lightning Fast: Create professional CIMs in minutes instead of days
🎯 Full Control: AI assists while you maintain complete editorial control
🔒 Secure Sharing: Built-in NDA protection and document tracking
📊 Smart Analytics: Track engagement and manage your investor pipeline

Ready to get started? Your workspace is waiting for you.

Start creating your first CIM: https://cimshare.com/dashboard

Welcome aboard!
The CIM Share Team

Questions? Our support team is here to help.
Knowledge Base: https://cimshare.com/knowledge-base/
Contact Support: support@cimshare.com

© 2024 CIM Share. All rights reserved.
  `
};