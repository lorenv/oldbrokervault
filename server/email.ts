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
    console.log('=== SENDGRID EMAIL ATTEMPT ===');
    console.log('- To:', params.to);
    console.log('- From:', params.from);
    console.log('- Subject:', params.subject);
    console.log('- Has attachments:', !!params.attachments?.length);
    console.log('- API Key configured:', !!process.env.SENDGRID_API_KEY);
    console.log('- API Key length:', process.env.SENDGRID_API_KEY?.length || 0);
    console.log('- Environment:', process.env.NODE_ENV || 'unknown');
    console.log('- Platform:', process.platform);
    
    // Additional validation for production
    if (!process.env.SENDGRID_API_KEY) {
      console.error('❌ SENDGRID_API_KEY not found in environment variables');
      return false;
    }
    
    if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
      console.error('❌ SENDGRID_API_KEY format appears invalid (should start with SG.)');
      return false;
    }
    
    const emailData = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      replyTo: params.replyTo,
      html: params.html,
      attachments: params.attachments,
    };
    
    console.log('Sending email with data:', {
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
      hasText: !!emailData.text,
      hasHtml: !!emailData.html,
      hasReplyTo: !!emailData.replyTo,
      attachmentCount: emailData.attachments?.length || 0
    });
    
    const result = await mailService.send(emailData);
    
    console.log('✅ Email sent successfully to:', params.to);
    console.log('SendGrid response status:', result[0]?.statusCode);
    console.log('SendGrid response headers:', result[0]?.headers);
    console.log('=== END SENDGRID SUCCESS ===');
    return true;
  } catch (error: any) {
    console.error('❌ SendGrid email error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error type:', typeof error);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack?.substring(0, 500));
    
    // Critical production environment debugging
    console.error('=== PRODUCTION DEBUG INFO ===');
    console.error('- SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
    console.error('- SENDGRID_API_KEY length:', process.env.SENDGRID_API_KEY?.length || 0);
    console.error('- SENDGRID_API_KEY starts with SG:', process.env.SENDGRID_API_KEY?.startsWith('SG.') || false);
    console.error('- NODE_ENV:', process.env.NODE_ENV);
    console.error('- Platform:', process.platform);
    console.error('- Process version:', process.version);
    console.error('- Sendgrid module available:', typeof mailService);
    console.error('- All env vars with SENDGRID:', Object.keys(process.env).filter(k => k.includes('SENDGRID')));
    console.error('=== END PRODUCTION DEBUG ===');
    
    if (error.response) {
      console.error('SendGrid response status:', error.response.status);
      console.error('SendGrid response body:', error.response.body);
      if (error.response.body && error.response.body.errors) {
        console.error('SendGrid errors:', error.response.body.errors);
      }
    }
    
    // Additional debugging for production deployment issues
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('❌ Network connectivity issue - production environment may lack internet access');
    }
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      console.error('❌ API Key authentication failed - environment variable missing or invalid in production');
    }
    
    if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      console.error('❌ SendGrid account permissions issue - check sender verification');
    }
    
    if (!process.env.SENDGRID_API_KEY) {
      console.error('🚨 CRITICAL: SENDGRID_API_KEY environment variable is completely missing in production');
    }
    
    console.error('=== END SENDGRID ERROR ===');
    return false;
  }
}

// Send NDA confirmation email with attachment (separate from CIM link)
async function sendNdaConfirmationEmail(
  viewerEmail: string,
  viewerName: string,
  cimTitle: string,
  signedNdaBase64: string
): Promise<boolean> {
  const attachment = {
    content: signedNdaBase64,
    filename: `signed-nda-${cimTitle.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
    type: 'application/pdf',
    disposition: 'attachment'
  };

  return await sendEmail({
    to: viewerEmail,
    from: 'system@cimshare.com',
    replyTo: 'system@cimshare.com', // Keep generic for NDA confirmation
    subject: `NDA Confirmation - ${cimTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>NDA Successfully Signed</h2>
        <p>Hello ${viewerName},</p>
        
        <p>Thank you for signing the Non-Disclosure Agreement for <strong>${cimTitle}</strong>.</p>
        
        <p>Your signed NDA has been recorded and a copy is attached to this email for your records.</p>
        
        <p>You will receive a separate email with access to the confidential information memorandum shortly.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This email contains confidential information. Please handle accordingly.
        </p>
      </div>
    `,
    text: `
      NDA Successfully Signed
      
      Hello ${viewerName},
      
      Thank you for signing the Non-Disclosure Agreement for ${cimTitle}.
      
      Your signed NDA has been recorded and a copy is attached to this email for your records.
      
      You will receive a separate email with access to the confidential information memorandum shortly.
    `,
    attachments: [attachment]
  });
}

// Send CIM link email with complete contact information
async function sendCimLinkEmail(
  viewerEmail: string,
  viewerName: string,
  cimTitle: string,
  shareLink: string,
  ownerProfile: {
    name: string;
    email: string;
    phone?: string;
    title?: string;
    businessName?: string;
    profilePhotoUrl?: string;
    businessLogoUrl?: string;
  }
): Promise<boolean> {
  const profilePhotoHtml = ownerProfile.profilePhotoUrl 
    ? `<img src="${ownerProfile.profilePhotoUrl}" alt="Profile Photo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px;">` 
    : '';
    
  const businessLogoHtml = ownerProfile.businessLogoUrl 
    ? `<img src="${ownerProfile.businessLogoUrl}" alt="Business Logo" style="max-width: 150px; max-height: 60px; margin-bottom: 15px;">` 
    : '';

  return await sendEmail({
    to: viewerEmail,
    from: 'system@cimshare.com',
    replyTo: ownerProfile.email,
    subject: `Access to ${cimTitle} - CIM Document`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Access to Confidential Information Memorandum</h2>
        <p>Hello ${viewerName},</p>
        
        <p>You now have access to the confidential information memorandum for <strong>${cimTitle}</strong>.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${shareLink}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View CIM Document
          </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Your Contact Information</h3>
          
          <div style="text-align: center; margin-bottom: 20px;">
            ${profilePhotoHtml}
            ${businessLogoHtml}
          </div>
          
          <div style="text-align: center;">
            <h4 style="margin: 10px 0; font-size: 18px; color: #333;">${ownerProfile.name}</h4>
            ${ownerProfile.title ? `<p style="margin: 5px 0; color: #666; font-style: italic;">${ownerProfile.title}</p>` : ''}
            ${ownerProfile.businessName ? `<p style="margin: 5px 0; color: #666; font-weight: bold;">${ownerProfile.businessName}</p>` : ''}
            
            <div style="margin-top: 15px;">
              <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${ownerProfile.email}">${ownerProfile.email}</a></p>
              ${ownerProfile.phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:${ownerProfile.phone}">${ownerProfile.phone}</a></p>` : ''}
            </div>
          </div>
        </div>
        
        <p style="color: #666; text-align: center;">
          Please feel free to reach out if you have any questions about the opportunity.
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This email contains confidential information. Please handle accordingly.
        </p>
      </div>
    `,
    text: `
      Access to Confidential Information Memorandum
      
      Hello ${viewerName},
      
      You now have access to the confidential information memorandum for ${cimTitle}.
      
      View CIM Document: ${shareLink}
      
      Your Contact Information:
      Name: ${ownerProfile.name}
      ${ownerProfile.title ? `Title: ${ownerProfile.title}` : ''}
      ${ownerProfile.businessName ? `Business: ${ownerProfile.businessName}` : ''}
      Email: ${ownerProfile.email}
      ${ownerProfile.phone ? `Phone: ${ownerProfile.phone}` : ''}
      
      Please feel free to reach out if you have any questions about the opportunity.
    `
  });
}

// Send owner notification email (unchanged)
async function sendOwnerNdaNotification(
  ownerEmail: string,
  ownerName: string,
  cimTitle: string,
  viewerEmail: string,
  viewerName: string,
  shareLink: string,
  signedNdaBase64: string
): Promise<boolean> {
  const attachment = {
    content: signedNdaBase64,
    filename: `signed-nda-${cimTitle.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
    type: 'application/pdf',
    disposition: 'attachment'
  };

  return await sendEmail({
    to: ownerEmail,
    from: 'system@cimshare.com',
    subject: `NDA Signed by ${viewerEmail} - ${cimTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>NDA Signature Notification</h2>
        <p>Hello ${ownerName},</p>
        
        <p>A new user has signed the NDA for your CIM document: <strong>${cimTitle}</strong></p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Signer Details:</h3>
          <p><strong>Name:</strong> ${viewerName}</p>
          <p><strong>Email:</strong> ${viewerEmail}</p>
          <p><strong>Signed:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Share Link:</strong> <a href="${shareLink}">${shareLink}</a></p>
        </div>
        
        <p>A copy of the signed NDA is attached to this email.</p>
        <p>The signer will receive separate emails with NDA confirmation and CIM access.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from your CIM sharing system.
        </p>
      </div>
    `,
    text: `
      NDA Signature Notification
      
      Hello ${ownerName},
      
      A new user has signed the NDA for your CIM document: ${cimTitle}
      
      Signer Details:
      Name: ${viewerName}
      Email: ${viewerEmail}
      Signed: ${new Date().toLocaleString()}
      Share Link: ${shareLink}
      
      A copy of the signed NDA is attached to this email.
      The signer will receive separate emails with NDA confirmation and CIM access.
    `,
    attachments: [attachment]
  });
}

// Legacy function - now calls separate email functions
async function sendNdaSignedEmail(
  viewerEmail: string,
  ownerEmail: string,
  ownerName: string,
  cimTitle: string,
  shareLink: string,
  signedNdaBase64: string,
  viewerName?: string,
  ownerProfile?: any
): Promise<boolean> {
  console.log('=== EMAIL SENDING DEBUG ===');
  console.log('Viewer email:', viewerEmail);
  console.log('Owner email:', ownerEmail);
  console.log('CIM title:', cimTitle);
  console.log('Share link:', shareLink);
  console.log('Signed NDA size:', signedNdaBase64?.length || 0);
  
  // Send NDA confirmation email first
  console.log('Sending NDA confirmation email...');
  const ndaConfirmationSuccess = await sendNdaConfirmationEmail(
    viewerEmail,
    viewerName || 'Valued Investor',
    cimTitle,
    signedNdaBase64
  );
  console.log('NDA confirmation email result:', ndaConfirmationSuccess);

  // Send CIM link email with contact information
  console.log('Sending CIM link email...');
  const cimLinkSuccess = await sendCimLinkEmail(
    viewerEmail,
    viewerName || 'Valued Investor',
    cimTitle,
    shareLink,
    ownerProfile || {
      name: ownerName,
      email: ownerEmail
    }
  );
  console.log('CIM link email result:', cimLinkSuccess);

  // Send owner notification
  console.log('Sending owner notification email...');
  const ownerNotificationSuccess = await sendOwnerNdaNotification(
    ownerEmail,
    ownerName,
    cimTitle,
    viewerEmail,
    viewerName || 'Unknown',
    shareLink,
    signedNdaBase64
  );
  console.log('Owner notification email result:', ownerNotificationSuccess);
  
  const allSuccess = ndaConfirmationSuccess && cimLinkSuccess && ownerNotificationSuccess;
  console.log('All emails sent successfully:', allSuccess);
  console.log('=== END EMAIL DEBUG ===');
  
  return allSuccess;
}

async function sendPasswordResetEmail(
  userEmail: string,
  resetToken: string
): Promise<boolean> {
  const resetLink = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

  return await sendEmail({
    to: userEmail,
    from: 'system@cimshare.com', // Use verified sender
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
  cimDoc: any,
  ownerProfile?: any
): Promise<boolean> {
  const { signerEmail, signerName, accessToken } = signature;
  const { title, shareSlug } = cimDoc;
  
  // Create direct share URL with access token
  const shareUrl = `https://cimshare.com/share/${shareSlug}?token=${accessToken}`;
  
  // Use the new CIM link email function if owner profile is provided
  if (ownerProfile) {
    return await sendCimLinkEmail(
      signerEmail,
      signerName,
      title,
      shareUrl,
      ownerProfile
    );
  }
  
  // Fallback to basic approval email
  return await sendEmail({
    to: signerEmail,
    from: 'system@cimshare.com',
    replyTo: 'system@cimshare.com',
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
    from: 'system@cimshare.com',
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

export { 
  sendEmail, 
  sendNdaSignedEmail, 
  sendNdaConfirmationEmail,
  sendCimLinkEmail,
  sendOwnerNdaNotification,
  sendPasswordResetEmail, 
  sendApprovalEmail, 
  sendOwnerApprovalNotification 
};