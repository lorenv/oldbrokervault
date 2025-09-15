/**
 * CAN-SPAM compliant footer for all emails
 */

export const getCanSpamFooterHtml = (unsubscribeLink?: string, emailType: 'onboarding' | 'marketing' | 'transactional' = 'onboarding') => `
  <div style="font-size: 13px; color: #94a3b8; margin-top: 16px; line-height: 1.6;">
    <strong>CIM Share</strong><br>
    AI-Powered CIM Creation Platform<br>
    606 Venice Blvd<br>
    Venice, CA 90291<br>
    United States<br><br>

    ${emailType === 'transactional' ?
      'This is a transactional email related to your account.' :
      'You received this email because you signed up for CIM Share.'
    }<br>
    ${unsubscribeLink && emailType !== 'transactional' ?
      `<a href="${unsubscribeLink}" style="color: #3b82f6; text-decoration: none;">Unsubscribe from ${emailType} emails</a> | ` :
      ''
    }
    <a href="https://cimshare.com/account" style="color: #3b82f6; text-decoration: none;">Manage email preferences</a><br><br>

    © 2024 CIM Share. All rights reserved.
  </div>
`;

export const getCanSpamFooterText = (unsubscribeLink?: string, emailType: 'onboarding' | 'marketing' | 'transactional' = 'onboarding') => `
---
CIM Share
AI-Powered CIM Creation Platform
606 Venice Blvd
Venice, CA 90291
United States

${emailType === 'transactional' ?
  'This is a transactional email related to your account.' :
  'You received this email because you signed up for CIM Share.'
}
${unsubscribeLink && emailType !== 'transactional' ?
  `Unsubscribe: ${unsubscribeLink}` :
  ''
}
Manage preferences: https://cimshare.com/account

© 2024 CIM Share. All rights reserved.
`;