import { emailComponents } from '../email-components';

export const welcomeEmailTemplate = {
  subject: "Welcome to CIM Share - Your AI-Powered CIM Creation Tool",

  html: (userName: string, unsubscribeLink?: string) => {
    const content = emailComponents.mainContainer(`
      ${emailComponents.header('CIM Share', 'AI-Powered CIM Creation Platform')}
      ${emailComponents.contentSection(`
        ${emailComponents.paragraph(`Hi ${userName},`, 'greeting')}
        ${emailComponents.paragraph('Welcome to CIM Share! You\'ve just joined thousands of professionals who are transforming how they create and share CIM documents.', 'body')}
        ${emailComponents.sectionTitle('Your AI-Powered Advantage')}
        ${emailComponents.featureCard(`
          ${emailComponents.featureItem('⚡', 'Lightning Fast:', 'Create professional CIMs in minutes instead of days')}
          ${emailComponents.featureItem('🎯', 'Full Control:', 'AI assists while you maintain complete editorial control')}
          ${emailComponents.featureItem('🔒', 'Secure Sharing:', 'Built-in NDA protection and document tracking')}
          ${emailComponents.featureItem('📊', 'Smart Analytics:', 'Track engagement and manage your investor pipeline')}
        `)}
        ${emailComponents.ctaButton('Start Creating Your First CIM', 'https://cimshare.com/dashboard')}
        ${emailComponents.divider()}
        ${emailComponents.paragraph('<span style="font-weight: 600; color: #1e293b; display: block; padding: 0 0 4px 0;">Welcome aboard!</span>The CIM Share Team', 'signature')}
      `)}
      ${emailComponents.footer(unsubscribeLink)}
    `);

    return emailComponents.documentWrapper(content);
  },

  text: (userName: string, unsubscribeLink?: string) => `
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

---
CIM Share
AI-Powered CIM Creation Platform
606 Venice Blvd
Venice, CA 90291
United States

You received this email because you signed up for CIM Share.
${unsubscribeLink ? `Unsubscribe: ${unsubscribeLink}` : ''}
Manage preferences: https://cimshare.com/account

© 2024 CIM Share. All rights reserved.
  `
};