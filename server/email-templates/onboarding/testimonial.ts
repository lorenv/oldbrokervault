import { emailComponents } from '../email-components';

export const testimonialEmailTemplate = {
  subject: "How Sarah Saved 50+ Hours Last Month with CIM Share",

  html: (userName: string, unsubscribeLink?: string) => {
    const content = emailComponents.mainContainer(`
      ${emailComponents.header('Real Results from Real Users', 'See how professionals like you are transforming their workflow')}
      ${emailComponents.contentSection(`
        ${emailComponents.paragraph(`Hi ${userName},`, 'greeting')}
        ${emailComponents.paragraph('Sarah from Venture Partners was skeptical at first. Now? She can\'t imagine working without CIM Share.', 'body')}

        ${emailComponents.testimonial(
          'I was spending entire weekends formatting CIMs. Now I create them during my morning coffee. CIM Share hasn\'t just saved me time—it\'s given me my life back. Last month alone, I saved over 50 hours!',
          'Sarah Chen',
          'Managing Director',
          'Venture Partners LLC'
        )}

        ${emailComponents.sectionTitle('Sarah\'s Results After 30 Days')}
        ${emailComponents.statBlock([
          { value: '12', label: 'CIMs created' },
          { value: '50+ hrs', label: 'Time saved' },
          { value: '3x', label: 'More deals reviewed' }
        ])}

        ${emailComponents.testimonial(
          'The AI understands our business better than some of our junior analysts! It pulls exactly what we need from our data and presents it beautifully.',
          'Michael Rodriguez',
          'Investment Director',
          'Capital Growth Partners'
        )}

        ${emailComponents.sectionTitle('Join 5,000+ Professionals Already Saving Time')}
        ${emailComponents.featureCard(`
          ${emailComponents.featureItem('🚀', 'Average time to first CIM:', '4 minutes')}
          ${emailComponents.featureItem('⏰', 'Average time saved per month:', '45+ hours')}
          ${emailComponents.featureItem('📈', 'Increase in deal flow capacity:', '287%')}
          ${emailComponents.featureItem('⭐', 'User satisfaction rating:', '4.9/5 stars')}
        `)}

        ${emailComponents.ctaButton('Start Your Success Story Today', 'https://cimshare.com/dashboard')}

        ${emailComponents.spacer(20)}
        ${emailComponents.paragraph('<strong style="font-weight: 600; color: #3b82f6;">Special Offer:</strong> Use code TIMEBACK for 20% off your first month. Valid for the next 48 hours only!', 'body')}

        ${emailComponents.divider()}
        ${emailComponents.paragraph('<span style="font-weight: 600; color: #1e293b; display: block; padding: 0 0 4px 0;">Here to help you succeed,</span>The CIM Share Team', 'signature')}
      `)}
      ${emailComponents.footer(unsubscribeLink)}
    `);

    return emailComponents.documentWrapper(content);
  },

  text: (userName: string, unsubscribeLink?: string) => `
Real Results from Real Users

Hi ${userName},

Sarah from Venture Partners was skeptical at first. Now? She can't imagine working without CIM Share.

"I was spending entire weekends formatting CIMs. Now I create them during my morning coffee. CIM Share hasn't just saved me time—it's given me my life back. Last month alone, I saved over 50 hours!"
- Sarah Chen, Managing Director, Venture Partners LLC

SARAH'S RESULTS AFTER 30 DAYS:
• 12 CIMs created
• 50+ hours saved
• 3x more deals reviewed

"The AI understands our business better than some of our junior analysts! It pulls exactly what we need from our data and presents it beautifully."
- Michael Rodriguez, Investment Director, Capital Growth Partners

JOIN 5,000+ PROFESSIONALS ALREADY SAVING TIME:
🚀 Average time to first CIM: 4 minutes
⏰ Average time saved per month: 45+ hours
📈 Increase in deal flow capacity: 287%
⭐ User satisfaction rating: 4.9/5 stars

Start your success story today: https://cimshare.com/dashboard

SPECIAL OFFER: Use code TIMEBACK for 20% off your first month. Valid for the next 48 hours only!

Here to help you succeed,
The CIM Share Team

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