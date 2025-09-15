export const painSolutionEmailTemplate = {
  subject: "Stop Wasting Hours on CIM Creation - There's a Better Way",

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
        .comparison-container {
          margin: 32px 0;
        }
        .comparison-card {
          border-radius: 12px;
          padding: 24px;
          margin: 20px 0;
        }
        .pain-card {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border: 1px solid #fecaca;
        }
        .solution-card {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
        }
        .card-header {
          display: flex;
          align-items: center;
          font-weight: 600;
          font-size: 18px;
          margin-bottom: 16px;
        }
        .card-icon {
          font-size: 24px;
          margin-right: 12px;
        }
        .pain-header {
          color: #991b1b;
        }
        .solution-header {
          color: #14532d;
        }
        .card-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .card-list li {
          display: flex;
          align-items: flex-start;
          margin: 12px 0;
          font-size: 15px;
        }
        .list-bullet {
          color: #ef4444;
          margin-right: 12px;
          font-size: 18px;
          line-height: 1;
        }
        .solution-list .list-bullet {
          color: #10b981;
        }
        .stats-comparison {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 32px 0;
        }
        .stat-card {
          text-align: center;
          padding: 24px;
          border-radius: 12px;
        }
        .stat-old {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
        }
        .stat-new {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 2px solid #3b82f6;
          position: relative;
        }
        .stat-label {
          font-size: 14px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .stat-value {
          font-size: 36px;
          font-weight: 700;
          color: #1e293b;
          margin: 8px 0;
        }
        .stat-new .stat-value {
          color: #3b82f6;
        }
        .stat-description {
          font-size: 14px;
          color: #64748b;
        }
        .impact-section {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
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
        .ps-message {
          margin-top: 20px;
          padding: 16px;
          background: #fef3c7;
          border-radius: 8px;
          color: #713f12;
          font-size: 14px;
          font-weight: 500;
        }
        @media only screen and (max-width: 600px) {
          .header { padding: 32px 24px; }
          .content { padding: 32px 24px; }
          .footer { padding: 20px 24px; }
          .stats-comparison { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="header-title">Your Time is Too Valuable</div>
          <div class="header-subtitle">There's a smarter way to create CIMs</div>
        </div>

        <div class="content">
          <div class="greeting">Hi ${userName},</div>

          <div class="intro-text">
            How many hours have you lost to CIM creation this month? If you're like most professionals, it's far too many.
          </div>

          <div class="comparison-container">
            <div class="comparison-card pain-card">
              <div class="card-header pain-header">
                <span class="card-icon">😩</span>
                <span>The Traditional Struggle</span>
              </div>
              <ul class="card-list">
                <li><span class="list-bullet">•</span><span>8-12 hours per CIM, every single time</span></li>
                <li><span class="list-bullet">•</span><span>Endless copy-pasting between documents</span></li>
                <li><span class="list-bullet">•</span><span>Formatting nightmares and inconsistencies</span></li>
                <li><span class="list-bullet">•</span><span>Version control chaos with multiple revisions</span></li>
                <li><span class="list-bullet">•</span><span>Starting from scratch, always</span></li>
              </ul>
            </div>

            <div class="comparison-card solution-card">
              <div class="card-header solution-header">
                <span class="card-icon">✨</span>
                <span>The CIM Share Revolution</span>
              </div>
              <ul class="card-list solution-list">
                <li><span class="list-bullet">✓</span><span>Complete CIM in under 60 seconds</span></li>
                <li><span class="list-bullet">✓</span><span>AI extracts and organizes automatically</span></li>
                <li><span class="list-bullet">✓</span><span>Perfect formatting, guaranteed</span></li>
                <li><span class="list-bullet">✓</span><span>Real-time collaboration and tracking</span></li>
                <li><span class="list-bullet">✓</span><span>Reusable templates and smart suggestions</span></li>
              </ul>
            </div>
          </div>

          <div class="stats-comparison">
            <div class="stat-card stat-old">
              <div class="stat-label">Without CIM Share</div>
              <div class="stat-value">12 hrs</div>
              <div class="stat-description">Per CIM creation</div>
            </div>
            <div class="stat-card stat-new">
              <div class="stat-label">With CIM Share</div>
              <div class="stat-value">15 min</div>
              <div class="stat-description">Including customization!</div>
            </div>
          </div>

          <div class="impact-section">
            <div class="impact-title">What Would You Do With 11+ Hours Back?</div>
            <div class="impact-text">
              Close more deals. Strengthen client relationships. Develop new strategies.<br>
              Or simply enjoy dinner with your family instead of your laptop.
            </div>
          </div>

          <div class="cta-container">
            <a href="https://cimshare.com/dashboard" class="button">Reclaim Your Time Today</a>
          </div>

          <div class="ps-message">
            🎯 PS: Most users create their first professional CIM within 5 minutes of signing up. Join them today!
          </div>

          <div class="signature">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">Your time is worth more,</div>
            <div>The CIM Share Team</div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-content">
            <div>Ready to transform your workflow?</div>
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
Your Time is Too Valuable

Hi ${userName},

How many hours have you lost to CIM creation this month? If you're like most professionals, it's far too many.

😩 THE TRADITIONAL STRUGGLE:
• 8-12 hours per CIM, every single time
• Endless copy-pasting between documents
• Formatting nightmares and inconsistencies
• Version control chaos with multiple revisions
• Starting from scratch, always

✨ THE CIM SHARE REVOLUTION:
✓ Complete CIM in under 60 seconds
✓ AI extracts and organizes automatically
✓ Perfect formatting, guaranteed
✓ Real-time collaboration and tracking
✓ Reusable templates and smart suggestions

THE NUMBERS SPEAK FOR THEMSELVES:
Without CIM Share: 12 hours per CIM creation
With CIM Share: 15 minutes including customization!

WHAT WOULD YOU DO WITH 11+ HOURS BACK?
Close more deals. Strengthen client relationships. Develop new strategies.
Or simply enjoy dinner with your family instead of your laptop.

Reclaim your time today: https://cimshare.com/dashboard

🎯 PS: Most users create their first professional CIM within 5 minutes of signing up. Join them today!

Your time is worth more,
The CIM Share Team

Ready to transform your workflow?
Knowledge Base: https://cimshare.com/knowledge-base/
Contact Support: support@cimshare.com

© 2024 CIM Share. All rights reserved.
  `
};