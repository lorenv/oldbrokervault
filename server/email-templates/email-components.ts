/**
 * Email Template Components
 * Following email client best practices for maximum compatibility
 */

export const emailComponents = {
  /**
   * Main document wrapper with all necessary meta tags and inline styles
   */
  documentWrapper: (content: string) => `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Broker Vault</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f8fafc;">
  ${content}
</body>
</html>`,

  /**
   * Main container table - centered 600px wide
   */
  mainContainer: (content: string) => `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
  <tr>
    <td align="center" style="padding: 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; max-width: 600px;">
        ${content}
      </table>
    </td>
  </tr>
</table>`,

  /**
   * Header with gradient background (using VML for Outlook support)
   */
  header: (title: string, subtitle?: string) => `
<tr>
  <td align="center" style="padding: 0;">
    <!--[if gte mso 9]>
    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:120px;">
      <v:fill type="gradient" color="#06b6d4" color2="#6366f1" angle="135" />
      <v:textbox inset="0,0,0,0">
    <![endif]-->
    <div>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background: #3b82f6; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%);">
        <tr>
          <td align="center" style="padding: 48px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
            <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
              <tr>
                <td align="center" style="padding: 0; font-size: 32px; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.2;">
                  ${title}
                </td>
              </tr>
              ${subtitle ? `
              <tr>
                <td align="center" style="padding: 8px 0 0 0; font-size: 16px; font-weight: 400; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.4; opacity: 0.95;">
                  ${subtitle}
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>
    </div>
    <!--[if gte mso 9]>
      </v:textbox>
    </v:rect>
    <![endif]-->
  </td>
</tr>`,

  /**
   * Content section with white background
   */
  contentSection: (content: string) => `
<tr>
  <td align="left" bgcolor="#ffffff" style="padding: 40px 32px; background-color: #ffffff;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
      ${content}
    </table>
  </td>
</tr>`,

  /**
   * Text paragraph
   */
  paragraph: (text: string, style: 'greeting' | 'body' | 'signature' = 'body') => {
    const styles = {
      greeting: 'font-size: 18px; font-weight: 500; color: #1e293b; line-height: 1.4;',
      body: 'font-size: 16px; font-weight: 400; color: #475569; line-height: 1.7;',
      signature: 'font-size: 15px; font-weight: 400; color: #475569; line-height: 1.6;'
    };

    return `
<tr>
  <td align="left" style="padding: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; ${styles[style]}">
    ${text}
  </td>
</tr>`;
  },

  /**
   * Section title
   */
  sectionTitle: (title: string) => `
<tr>
  <td align="left" style="padding: 32px 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 20px; font-weight: 600; color: #1e293b; line-height: 1.3;">
    ${title}
  </td>
</tr>`,

  /**
   * Feature card with light background
   */
  featureCard: (content: string) => `
<tr>
  <td align="left" style="padding: 24px 0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 12px;">
      <tr>
        <td align="left" style="padding: 24px; background-color: #f0f9ff; border-radius: 12px;">
          ${content}
        </td>
      </tr>
    </table>
  </td>
</tr>`,

  /**
   * Feature list item with icon
   */
  featureItem: (icon: string, title: string, description?: string) => `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
  <tr>
    <td align="left" valign="top" width="40" style="padding: 0 12px 16px 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="40" height="40" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
          <td align="center" valign="middle" bgcolor="#3b82f6" style="background-color: #3b82f6; border-radius: 50%; width: 40px; height: 40px; font-size: 20px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
            ${icon}
          </td>
        </tr>
      </table>
    </td>
    <td align="left" valign="top" style="padding: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
      <span style="display: block; font-size: 15px; font-weight: 600; color: #1e293b; line-height: 1.4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">${title}</span>
      ${description ? `<span style="display: block; font-size: 15px; font-weight: 400; color: #475569; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; padding: 4px 0 0 0;">${description}</span>` : ''}
    </td>
  </tr>
</table>`,

  /**
   * Numbered step
   */
  step: (number: number, title: string, description: string) => `
<tr>
  <td align="left" style="padding: 12px 0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f8fafc; border: 1px solid #e0f2fe; border-radius: 12px;">
      <tr>
        <td align="left" style="padding: 20px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
            <tr>
              <td align="center" valign="top" width="50" style="padding: 0 20px 0 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="40" height="40" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                  <tr>
                    <td align="center" valign="middle" bgcolor="#3b82f6" style="background-color: #3b82f6; border-radius: 50%; width: 40px; height: 40px; font-size: 18px; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                      ${number}
                    </td>
                  </tr>
                </table>
              </td>
              <td align="left" valign="top" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                <span style="display: block; font-size: 17px; font-weight: 600; color: #1e293b; line-height: 1.4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; padding: 0 0 8px 0;">${title}</span>
                <span style="display: block; font-size: 15px; font-weight: 400; color: #64748b; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">${description}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`,

  /**
   * Pro tip box
   */
  proTip: (content: string) => `
<tr>
  <td align="left" style="padding: 32px 0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fef3c7; border: 1px solid #fde047; border-radius: 12px;">
      <tr>
        <td align="left" style="padding: 20px; background-color: #fef3c7; border-radius: 12px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
            <tr>
              <td align="left" style="padding: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                <span style="font-size: 20px; padding: 0 8px 0 0;">💡</span>
                <span style="font-size: 16px; font-weight: 600; color: #713f12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">Pro Tip</span>
              </td>
            </tr>
            <tr>
              <td align="left" style="padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; font-weight: 400; color: #854d0e; line-height: 1.6;">
                ${content}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`,

  /**
   * Call-to-action button (bulletproof button technique)
   */
  ctaButton: (text: string, url: string, align: 'center' | 'left' = 'center') => `
<tr>
  <td align="${align}" style="padding: 40px 0;">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" stroke="f" fillcolor="#3b82f6">
      <w:anchorlock/>
      <center>
    <![endif]-->
    <a href="${url}" style="background-color: #3b82f6; border-radius: 8px; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 48px; text-align: center; text-decoration: none; width: 240px; -webkit-text-size-adjust: none;">${text}</a>
    <!--[if mso]>
      </center>
    </v:roundrect>
    <![endif]-->
  </td>
</tr>`,

  /**
   * Spacer row for vertical spacing
   */
  spacer: (height: number) => `
<tr>
  <td style="height: ${height}px; font-size: 0; line-height: 0;">
    &nbsp;
  </td>
</tr>`,

  /**
   * Divider line
   */
  divider: () => `
<tr>
  <td style="padding: 24px 0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
      <tr>
        <td bgcolor="#e2e8f0" style="background-color: #e2e8f0; height: 1px; font-size: 0; line-height: 0;">
          &nbsp;
        </td>
      </tr>
    </table>
  </td>
</tr>`,

  /**
   * Footer with CAN-SPAM compliance
   */
  footer: (unsubscribeLink?: string) => `
<tr>
  <td align="center" bgcolor="#f8fafc" style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
      <tr>
        <td align="center" style="padding: 0 0 20px 0;">
          <img src="https://cimshare.com/cim-share-logo.png" alt="Broker Vault" width="150" height="auto" style="display: block; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; max-width: 150px; height: auto;" />
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 400; color: #64748b; line-height: 1.6;">
          Questions? Our support team is here to help.
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 1.6;">
          <a href="https://cimshare.com/knowledge-base/" style="color: #3b82f6; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">Knowledge Base</a>
          <span style="color: #cbd5e1; padding: 0 8px;">•</span>
          <a href="https://cimshare.com/dashboard" style="color: #3b82f6; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">Dashboard</a>
          <span style="color: #cbd5e1; padding: 0 8px;">•</span>
          <a href="mailto:support@cimshare.com" style="color: #3b82f6; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">Contact Support</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 0;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
            <tr>
              <td bgcolor="#e2e8f0" style="background-color: #e2e8f0; height: 1px; font-size: 0; line-height: 0;">
                &nbsp;
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: 400; color: #94a3b8; line-height: 1.6;">
          <strong style="font-weight: 600;">Broker Vault</strong><br />
          AI-Powered CIM Creation Platform<br />
          606 Venice Blvd<br />
          Venice, CA 90291<br />
          United States<br /><br />

          You received this email because you signed up for Broker Vault.<br />
          ${unsubscribeLink ? `<a href="${unsubscribeLink}" style="color: #3b82f6; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">Unsubscribe from onboarding emails</a> | ` : ''}
          <a href="https://cimshare.com/account" style="color: #3b82f6; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">Manage email preferences</a><br /><br />

          © 2024 Broker Vault. All rights reserved.
        </td>
      </tr>
    </table>
  </td>
</tr>`,

  /**
   * Image with proper attributes
   */
  image: (src: string, alt: string, width: number, height: number) => `
<img src="${src}" alt="${alt}" width="${width}" height="${height}" border="0" style="display: block; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; max-width: 100%; height: auto;" />`,

  /**
   * Testimonial block
   */
  testimonial: (quote: string, author: string, role: string, company: string) => `
<tr>
  <td align="left" style="padding: 24px 0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f8fafc; border-left: 4px solid #3b82f6;">
      <tr>
        <td align="left" style="padding: 24px; background-color: #f8fafc;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
            <tr>
              <td align="left" style="padding: 0 0 16px 0; font-family: Georgia, serif; font-size: 18px; font-style: italic; color: #475569; line-height: 1.6;">
                "${quote}"
              </td>
            </tr>
            <tr>
              <td align="left" style="padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                <span style="display: block; font-size: 15px; font-weight: 600; color: #1e293b; line-height: 1.4;">${author}</span>
                <span style="display: block; font-size: 14px; font-weight: 400; color: #64748b; line-height: 1.4; padding: 2px 0 0 0;">${role}, ${company}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`,

  /**
   * Statistics block
   */
  statBlock: (stats: Array<{value: string, label: string}>) => `
<tr>
  <td align="center" style="padding: 32px 0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
      <tr>
        ${stats.map(stat => `
        <td align="center" style="padding: 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
          <span style="display: block; font-size: 32px; font-weight: 700; color: #3b82f6; line-height: 1.2; padding: 0 0 8px 0;">${stat.value}</span>
          <span style="display: block; font-size: 14px; font-weight: 400; color: #64748b; line-height: 1.4;">${stat.label}</span>
        </td>
        `).join('')}
      </tr>
    </table>
  </td>
</tr>`,

  /**
   * Comparison card (pain vs solution)
   */
  comparisonCard: (type: 'pain' | 'solution', icon: string, title: string, items: string[]) => {
    const bgColor = type === 'pain' ? '#fef2f2' : '#f0fdf4';
    const borderColor = type === 'pain' ? '#fecaca' : '#bbf7d0';
    const bullet = type === 'pain' ? '•' : '✓';
    const iconColor = type === 'pain' ? '#dc2626' : '#16a34a';

    return `
<tr>
  <td align="left" style="padding: 12px 0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 12px;">
      <tr>
        <td align="left" style="padding: 24px; background-color: ${bgColor}; border-radius: 12px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
            <tr>
              <td align="left" style="padding: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                <span style="font-size: 20px; padding: 0 8px 0 0;">${icon}</span>
                <span style="font-size: 18px; font-weight: 600; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">${title}</span>
              </td>
            </tr>
            ${items.map(item => `
            <tr>
              <td align="left" style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                  <tr>
                    <td align="left" valign="top" width="25" style="padding: 0; font-size: 15px; color: ${type === 'pain' ? '#dc2626' : '#16a34a'}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                      ${bullet}
                    </td>
                    <td align="left" valign="top" style="padding: 0; font-size: 15px; color: #475569; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                      ${item}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            `).join('')}
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
  },

  /**
   * PS message box
   */
  psMessage: (content: string) => `
<tr>
  <td align="left" style="padding: 20px 0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fef3c7; border-radius: 8px;">
      <tr>
        <td align="left" style="padding: 16px; background-color: #fef3c7; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 500; color: #713f12; line-height: 1.6;">
          ${content}
        </td>
      </tr>
    </table>
  </td>
</tr>`
};