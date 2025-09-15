import { emailComponents } from '../email-components';

export const painSolutionEmailTemplate = {
  subject: "Stop Wasting Hours on CIM Creation - There's a Better Way",

  html: (userName: string, unsubscribeLink?: string) => {
    const content = emailComponents.mainContainer(`
      ${emailComponents.header('Your Time is Too Valuable', 'There\'s a smarter way to create CIMs')}
      ${emailComponents.contentSection(`
        ${emailComponents.paragraph(`Hi ${userName},`, 'greeting')}
        ${emailComponents.paragraph('How many hours have you lost to CIM creation this month? If you\'re like most professionals, it\'s far too many.', 'body')}

        ${emailComponents.comparisonCard('pain', '😩', 'The Traditional Struggle', [
          '8-12 hours per CIM, every single time',
          'Endless copy-pasting between documents',
          'Formatting nightmares and inconsistencies',
          'Version control chaos with multiple revisions',
          'Starting from scratch, always'
        ])}

        ${emailComponents.comparisonCard('solution', '✨', 'The CIM Share Revolution', [
          'Complete CIM in under 60 seconds',
          'AI extracts and organizes automatically',
          'Perfect formatting, guaranteed',
          'Real-time collaboration and tracking',
          'Reusable templates and smart suggestions'
        ])}

        ${emailComponents.statBlock([
          { value: '12 hrs', label: 'Without CIM Share<br />Per CIM creation' },
          { value: '15 min', label: 'With CIM Share<br />Including customization!' }
        ])}

        ${emailComponents.sectionTitle('What Would You Do With 11+ Hours Back?')}
        ${emailComponents.paragraph('Close more deals. Strengthen client relationships. Develop new strategies.<br />Or simply enjoy dinner with your family instead of your laptop.', 'body')}

        ${emailComponents.ctaButton('Reclaim Your Time Today', 'https://cimshare.com/dashboard')}

        ${emailComponents.psMessage('🎯 PS: Most users create their first professional CIM within 5 minutes of signing up. Join them today!')}

        ${emailComponents.divider()}
        ${emailComponents.paragraph('<span style="font-weight: 600; color: #1e293b; display: block; padding: 0 0 4px 0;">Your time is worth more,</span>The CIM Share Team', 'signature')}
      `)}
      ${emailComponents.footer(unsubscribeLink)}
    `);

    return emailComponents.documentWrapper(content);
  },

  text: (userName: string, unsubscribeLink?: string) => `
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