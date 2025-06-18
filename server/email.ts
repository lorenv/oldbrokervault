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
  replyTo?: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
  }>;
}

async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      replyTo: params.replyTo,
      html: params.html,
      attachments: params.attachments,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

async function sendNdaSignedEmail(
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
    from: 'rob@cimshare.com', // Use verified sender
    replyTo: 'rob@cimshare.com', // Use verified reply-to address
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
    from: 'rob@cimshare.com', // Use verified sender
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

async function sendPasswordResetEmail(
  userEmail: string,
  resetToken: string
): Promise<boolean> {
  const resetLink = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

  return await sendEmail({
    to: userEmail,
    from: 'rob@cimshare.com', // Use verified sender
    subject: 'Reset Your CIM Share Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You recently requested to reset your password for your CIM Share account.</p>
        
        <p>Click the button below to reset your password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetLink}</p>
        
        <p><strong>This link will expire in 1 hour.</strong></p>
        
        <p>If you didn't request this password reset, you can safely ignore this email.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated email from CIM Share. Please do not reply to this email.
        </p>
      </div>
    `,
    text: `
      Password Reset Request
      
      You recently requested to reset your password for your CIM Share account.
      
      Click the link below to reset your password:
      ${resetLink}
      
      This link will expire in 1 hour.
      
      If you didn't request this password reset, you can safely ignore this email.
    `
  });
}

async function sendApprovalEmail(
  signature: any,
  cimDoc: any
): Promise<boolean> {
  const { signerEmail, signerName, accessToken } = signature;
  const { title, shareSlug } = cimDoc;
  
  // Create direct share URL with access token
  const shareUrl = `https://cimshare.com/share/${shareSlug}?token=${accessToken}`;
  
  return await sendEmail({
    to: signerEmail,
    from: 'rob@cimshare.com',
    replyTo: 'rob@cimshare.com',
    subject: `Access Approved - ${title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Document Access Approved</h2>
        <p>Hello ${signerName},</p>
        
        <p>Your NDA signature for <strong>${title}</strong> has been approved!</p>
        
        <p>You can now access the confidential information memorandum using the link below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${shareUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View CIM Document
          </a>
        </div>
        
        <p>Thank you for your patience during the approval process.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This email contains confidential information. Please handle accordingly.
        </p>
      </div>
    `,
    text: `
      Document Access Approved
      
      Hello ${signerName},
      
      Your NDA signature for ${title} has been approved!
      
      You can now access the confidential information memorandum at: ${shareUrl}
      
      Thank you for your patience during the approval process.
    `
  });
}

async function sendOwnerApprovalNotification(
  ownerEmail: string,
  ownerName: string,
  cimTitle: string,
  signerName: string,
  signerEmail: string
): Promise<boolean> {
  return await sendEmail({
    to: ownerEmail,
    from: 'rob@cimshare.com',
    subject: `NDA Signature Awaiting Approval - ${cimTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New NDA Signature Requires Approval</h2>
        <p>Hello ${ownerName},</p>
        
        <p>A new user has signed the NDA for your CIM document: <strong>${cimTitle}</strong></p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Signer Details:</h3>
          <p><strong>Name:</strong> ${signerName}</p>
          <p><strong>Email:</strong> ${signerEmail}</p>
          <p><strong>Signed:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Status:</strong> Awaiting your approval</p>
        </div>
        
        <p>Please log in to your CIM Share dashboard to review and approve this signer's access to the document.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://cimshare.com/dashboard" 
             style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Review & Approve
          </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from your CIM sharing system.
        </p>
      </div>
    `,
    text: `
      New NDA Signature Requires Approval
      
      Hello ${ownerName},
      
      A new user has signed the NDA for your CIM document: ${cimTitle}
      
      Signer Details:
      Name: ${signerName}
      Email: ${signerEmail}
      Signed: ${new Date().toLocaleString()}
      Status: Awaiting your approval
      
      Please log in to your CIM Share dashboard to review and approve this signer's access to the document.
      
      Dashboard: https://cimshare.com/dashboard
    `
  });
}

export { sendEmail, sendNdaSignedEmail, sendPasswordResetEmail, sendApprovalEmail, sendOwnerApprovalNotification };