import { emailComponents } from '../email-components';

export const gettingStartedEmailTemplate = {
  subject: "Quick Start: Create Your First CIM in 3 Simple Steps",

  html: (userName: string, unsubscribeLink?: string) => {
    const content = emailComponents.mainContainer(`
      ${emailComponents.header('Let\'s Get You Started!', 'Your first CIM is just 3 steps away')}
      ${emailComponents.contentSection(`
        ${emailComponents.paragraph(`Hi ${userName},`, 'greeting')}
        ${emailComponents.paragraph('Ready to experience the power of AI-driven CIM creation? Follow these three simple steps to create your first professional CIM in minutes.', 'body')}
        ${emailComponents.spacer(16)}
        ${emailComponents.step(1, 'Upload Your Source Material', 'Simply paste your website URL or upload business documents. Our AI instantly extracts and organizes all relevant information.')}
        ${emailComponents.step(2, 'Let AI Work Its Magic', 'Click "Generate CIM" and watch as our AI creates a professional document in under 60 seconds, complete with formatting and structure.')}
        ${emailComponents.step(3, 'Review, Customize & Share', 'Fine-tune any section with our intuitive editor, then share securely with built-in NDA protection and tracking.')}
        ${emailComponents.proTip('Start with your website URL for the fastest results. CIM Share automatically extracts your company information, team details, and service offerings—saving you even more time!')}
        ${emailComponents.ctaButton('Create Your First CIM Now', 'https://cimshare.com/dashboard')}
        ${emailComponents.divider()}
        ${emailComponents.paragraph('<span style="font-weight: 600; color: #1e293b; display: block; padding: 0 0 4px 0;">Happy creating!</span>The CIM Share Team', 'signature')}
      `)}
      ${emailComponents.footer(unsubscribeLink)}
    `);

    return emailComponents.documentWrapper(content);
  },

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
Manage preferences: https://cimshare.com/account

© 2024 CIM Share. All rights reserved.
  `
};