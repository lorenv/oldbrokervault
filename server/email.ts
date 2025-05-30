import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
  }>;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendNdaSignedEmail(
  viewerEmail: string,
  ownerEmail: string,
  ownerName: string,
  cimTitle: string,
  shareLink: string,
  signedNdaBase64: string
): Promise<boolean> {
  const attachment = {
    content: signedNdaBase64,
    filename: `signed-nda-${cimTitle.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
    type: 'application/pdf',
    disposition: 'attachment'
  };

  // Email to viewer
  const viewerSuccess = await sendEmail({
    to: viewerEmail,
    from: ownerEmail, // From the owner's email
    subject: `NDA Signed - Access to ${cimTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>NDA Successfully Signed</h2>
        <p>Thank you for signing the Non-Disclosure Agreement for <strong>${cimTitle}</strong>.</p>
        
        <p>You can now access the confidential information memorandum using the link below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${shareLink}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View CIM Document
          </a>
        </div>
        
        <p>A copy of the signed NDA is attached to this email for your records.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This email contains confidential information. Please handle accordingly.
        </p>
      </div>
    `,
    text: `
      NDA Successfully Signed
      
      Thank you for signing the Non-Disclosure Agreement for ${cimTitle}.
      
      You can now access the confidential information memorandum at: ${shareLink}
      
      A copy of the signed NDA is attached to this email for your records.
    `,
    attachments: [attachment]
  });

  // Email to owner
  const ownerSuccess = await sendEmail({
    to: ownerEmail,
    from: ownerEmail, // From the owner's own email
    subject: `NDA Signed by ${viewerEmail} - ${cimTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>NDA Signature Notification</h2>
        <p>A new user has signed the NDA for your CIM document: <strong>${cimTitle}</strong></p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Signer Details:</h3>
          <p><strong>Email:</strong> ${viewerEmail}</p>
          <p><strong>Signed:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Share Link:</strong> <a href="${shareLink}">${shareLink}</a></p>
        </div>
        
        <p>A copy of the signed NDA is attached to this email.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from your CIM sharing system.
        </p>
      </div>
    `,
    text: `
      NDA Signature Notification
      
      A new user has signed the NDA for your CIM document: ${cimTitle}
      
      Signer Email: ${viewerEmail}
      Signed: ${new Date().toLocaleString()}
      Share Link: ${shareLink}
      
      A copy of the signed NDA is attached to this email.
    `,
    attachments: [attachment]
  });

  return viewerSuccess && ownerSuccess;
}