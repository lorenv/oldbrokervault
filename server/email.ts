import { MailService } from '@sendgrid/mail';
import { db } from './db.js';
import { eq } from 'drizzle-orm';
import { users, cimDocuments } from '@shared/schema.ts';

// Critical: Check for SENDGRID_API_KEY with detailed production debugging
let mailService: MailService | null = null;

if (!process.env.SENDGRID_API_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error("🚨 CRITICAL: SENDGRID_API_KEY environment variable not found");
    console.error("Environment:", process.env.NODE_ENV || 'unknown');
    console.error("Platform:", process.platform);
    console.error("Available env vars with SENDGRID:", Object.keys(process.env).filter(k => k.includes('SENDGRID')));
    console.error("This will cause all email functionality to fail");
    throw new Error("SENDGRID_API_KEY environment variable must be set - check deployment configuration");
  } else {
    console.warn("⚠️ SENDGRID_API_KEY not found - email functionality will be disabled in development mode");
    mailService = null;
  }
} else {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("✅ SendGrid configured successfully");
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  cc?: string[];
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
    
    // Check if SendGrid is available
    if (!mailService) {
      console.warn('⚠️ SendGrid not configured - email functionality disabled');
      return false;
    }
    
    // Additional validation for production
    if (!process.env.SENDGRID_API_KEY) {
      console.error('❌ SENDGRID_API_KEY not found in environment variables');
      return false;
    }
    
    if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
      console.error('❌ SENDGRID_API_KEY format appears invalid (should start with SG.)');
      return false;
    }
    
    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || (params.html ? params.html.replace(/<[^>]*>/g, '').trim() : ' '),
      replyTo: params.replyTo,
      html: params.html,
      attachments: params.attachments,
    };

    // Add CC recipients if provided
    if (params.cc && params.cc.length > 0) {
      emailData.cc = params.cc;
      console.log('- CC recipients:', params.cc.join(', '));
    }
    
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
  // Validate PDF content before attempting to send
  console.log('=== NDA CONFIRMATION EMAIL VALIDATION ===');
  console.log('PDF base64 length:', signedNdaBase64?.length || 0);
  console.log('PDF base64 prefix:', signedNdaBase64?.substring(0, 50) || 'EMPTY');

  if (!signedNdaBase64 || signedNdaBase64.length === 0) {
    console.error('❌ ERROR: signedNdaBase64 is empty or undefined');
    return false;
  }

  // Check if it's valid base64
  try {
    const buffer = Buffer.from(signedNdaBase64, 'base64');
    console.log('PDF buffer size:', buffer.length, 'bytes');

    // Check if it looks like a PDF (should start with %PDF)
    const pdfHeader = buffer.toString('utf8', 0, 4);
    console.log('PDF header:', pdfHeader);

    if (!pdfHeader.startsWith('%PDF')) {
      console.error('❌ ERROR: PDF content does not start with %PDF header');
      console.error('First 100 bytes:', buffer.toString('utf8', 0, 100));
      return false;
    }

    console.log('✅ PDF validation passed');
  } catch (error) {
    console.error('❌ ERROR: Invalid base64 content:', error);
    return false;
  }

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
  },
  copyMeOnEmails?: boolean
): Promise<boolean> {
  const profilePhotoHtml = ownerProfile.profilePhotoUrl 
    ? `<img src="${ownerProfile.profilePhotoUrl}" alt="Profile Photo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px;">` 
    : '';
    
  const businessLogoHtml = ownerProfile.businessLogoUrl 
    ? `<img src="${ownerProfile.businessLogoUrl}" alt="Business Logo" style="max-width: 150px; max-height: 60px; margin-bottom: 15px;">` 
    : '';

  // Build email options with optional CC
  const emailOptions: any = {
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
          <h3 style="margin-top: 0; color: #333;">Broker's Contact Information</h3>
          
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
      
      Broker's Contact Information:
      Name: ${ownerProfile.name}
      ${ownerProfile.title ? `Title: ${ownerProfile.title}` : ''}
      ${ownerProfile.businessName ? `Business: ${ownerProfile.businessName}` : ''}
      Email: ${ownerProfile.email}
      ${ownerProfile.phone ? `Phone: ${ownerProfile.phone}` : ''}
      
      Please feel free to reach out if you have any questions about the opportunity.
    `
  };

  // Add CC if copyMeOnEmails is enabled
  if (copyMeOnEmails && ownerProfile.email) {
    emailOptions.cc = ownerProfile.email;
  }

  return await sendEmail(emailOptions);
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
  // Validate PDF content before attempting to send
  console.log('=== OWNER NOTIFICATION EMAIL VALIDATION ===');
  console.log('PDF base64 length:', signedNdaBase64?.length || 0);

  if (!signedNdaBase64 || signedNdaBase64.length === 0) {
    console.error('❌ ERROR: signedNdaBase64 is empty or undefined for owner notification');
    return false;
  }

  try {
    const buffer = Buffer.from(signedNdaBase64, 'base64');
    const pdfHeader = buffer.toString('utf8', 0, 4);

    if (!pdfHeader.startsWith('%PDF')) {
      console.error('❌ ERROR: PDF content invalid for owner notification');
      return false;
    }

    console.log('✅ PDF validation passed for owner notification');
  } catch (error) {
    console.error('❌ ERROR: Invalid base64 content for owner notification:', error);
    return false;
  }

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
  console.log('PDF base64 length:', signedNdaBase64?.length || 0);

  // Send NDA confirmation email first
  console.log('📧 STEP 1: Sending NDA confirmation email to viewer...');
  const ndaConfirmationSuccess = await sendNdaConfirmationEmail(
    viewerEmail,
    viewerName || 'Valued Investor',
    cimTitle,
    signedNdaBase64
  );
  console.log('NDA confirmation email result:', ndaConfirmationSuccess ? '✅ SUCCESS' : '❌ FAILED');

  // Send CIM link email with contact information
  console.log('📧 STEP 2: Sending CIM link email to viewer...');
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
  console.log('CIM link email result:', cimLinkSuccess ? '✅ SUCCESS' : '❌ FAILED');

  // Send owner notification
  console.log('📧 STEP 3: Sending owner notification email...');
  const ownerNotificationSuccess = await sendOwnerNdaNotification(
    ownerEmail,
    ownerName,
    cimTitle,
    viewerEmail,
    viewerName || 'Unknown',
    shareLink,
    signedNdaBase64
  );
  console.log('Owner notification email result:', ownerNotificationSuccess ? '✅ SUCCESS' : '❌ FAILED');

  const allSuccess = ndaConfirmationSuccess && cimLinkSuccess && ownerNotificationSuccess;
  console.log('=== EMAIL SUMMARY ===');
  console.log('NDA Confirmation:', ndaConfirmationSuccess ? '✅' : '❌');
  console.log('CIM Link:', cimLinkSuccess ? '✅' : '❌');
  console.log('Owner Notification:', ownerNotificationSuccess ? '✅' : '❌');
  console.log('All emails successful:', allSuccess ? '✅ YES' : '❌ NO');
  console.log('=== END EMAIL DEBUG ===');
  
  return allSuccess;
}

async function sendPasswordResetEmail(
  userEmail: string,
  resetToken: string
): Promise<boolean> {
  // Use the correct production URL or Replit app URL
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : process.env.BASE_URL || 'https://your-app.replit.app';
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  return await sendEmail({
    to: userEmail,
    from: 'system@cimshare.com', // Use verified sender
    subject: 'Reset Your Broker Vault Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You recently requested to reset your password for your Broker Vault account.</p>
        
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
          This is an automated email from Broker Vault. Please do not reply to this email.
        </p>
      </div>
    `,
    text: `
      Password Reset Request
      
      You recently requested to reset your password for your Broker Vault account.
      
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
  const { title, shareSlug, userId, copyMeOnEmails } = cimDoc;

  // Fetch owner profile if not provided (we need it for the subdomain)
  let profile = ownerProfile;
  let customSubdomain: string | null = null;
  if (!profile && userId) {
    try {
      const owner = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (owner[0]) {
        customSubdomain = owner[0].customSubdomain;
        profile = {
          name: owner[0].name || `${owner[0].firstName || ''} ${owner[0].lastName || ''}`.trim(),
          email: owner[0].email,
          phone: owner[0].phoneNumber,
          title: owner[0].title,
          businessName: owner[0].businessName,
          profilePhotoUrl: owner[0].profilePhoto,
          businessLogoUrl: owner[0].businessLogo
        };
      }
    } catch (error) {
      console.error('Error fetching owner profile for approval email:', error);
    }
  }

  // Create direct share URL with access token, using custom subdomain if available
  const baseUrl = customSubdomain
    ? `https://${customSubdomain}.cimshare.com`
    : 'https://cimshare.com';
  const shareUrl = `${baseUrl}/share/${shareSlug}?token=${accessToken}`;
  
  // Use the new CIM link email function if owner profile is available
  if (profile) {
    return await sendCimLinkEmail(
      signerEmail,
      signerName,
      title,
      shareUrl,
      profile,
      copyMeOnEmails // Pass the CC flag
    );
  }
  
  // Fallback to basic approval email with generic contact info
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
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Contact Information</h3>
          <p style="color: #666; text-align: center;">
            If you have any questions about this opportunity, please contact the document owner directly.
          </p>
        </div>
        
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
      
      If you have any questions about this opportunity, please contact the document owner directly.
    `
  });
}

async function sendOwnerApprovalNotification(
  ownerEmail: string,
  ownerName: string,
  cimTitle: string,
  signerName: string,
  signerEmail: string,
  signerLocation?: string
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
          ${signerLocation ? `<p><strong>Location:</strong> ${signerLocation}</p>` : ''}
          <p><strong>Signed:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Status:</strong> Awaiting your approval</p>
        </div>
        
        <p>Please log in to your Broker Vault documents page to review and approve this signer's access to the document.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://cimshare.com/documents"
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
      ${signerLocation ? `Location: ${signerLocation}` : ''}
      Signed: ${new Date().toLocaleString()}
      Status: Awaiting your approval
      
      Please log in to your Broker Vault documents page to review and approve this signer's access to the document.

      Documents: https://cimshare.com/documents
    `
  });
}

// Send rejection email to NDA signer
async function sendRejectionEmail(
  signerEmail: string,
  signerName: string,
  cimTitle: string,
  ownerProfile?: {
    name: string;
    email: string;
    businessName?: string;
  }
): Promise<boolean> {
  const ownerName = ownerProfile?.name || 'the team';
  const businessName = ownerProfile?.businessName || 'our organization';

  return await sendEmail({
    to: signerEmail,
    from: 'system@cimshare.com',
    replyTo: ownerProfile?.email || 'system@cimshare.com',
    subject: `Application Update - ${cimTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Application Update</h2>
        <p>Hello ${signerName},</p>

        <p>Thank you for your interest in <strong>${cimTitle}</strong>.</p>

        <p>After careful review of your application, ${ownerName} has determined that this opportunity may not be the right fit at this time.</p>

        <p>We appreciate you taking the time to review the confidential information and sign the non-disclosure agreement. While this particular deal isn't a match, we encourage you to stay engaged with future opportunities from ${businessName}.</p>

        ${ownerProfile?.email ? `
        <p>If you have any questions or would like to discuss other opportunities, please feel free to reach out to ${ownerName} directly at <a href="mailto:${ownerProfile.email}">${ownerProfile.email}</a>.</p>
        ` : ''}

        <p>Thank you again for your interest.</p>

        <p>Best regards,<br>${ownerName}</p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from Broker Vault.
        </p>
      </div>
    `,
    text: `
      Application Update

      Hello ${signerName},

      Thank you for your interest in ${cimTitle}.

      After careful review of your application, ${ownerName} has determined that this opportunity may not be the right fit at this time.

      We appreciate you taking the time to review the confidential information and sign the non-disclosure agreement. While this particular deal isn't a match, we encourage you to stay engaged with future opportunities from ${businessName}.

      ${ownerProfile?.email ? `If you have any questions or would like to discuss other opportunities, please reach out to ${ownerName} directly at ${ownerProfile.email}.` : ''}

      Thank you again for your interest.

      Best regards,
      ${ownerName}
    `
  });
}

async function sendCollaborationInvitationEmail(
  inviteeEmail: string,
  inviteeName: string,
  documentTitle: string,
  inviterName: string,
  permission: 'Edit' | 'Assist',
  acceptToken: string
): Promise<boolean> {
  const baseUrl = process.env.BASE_URL || 'https://cimshare.com';
  const acceptUrl = `${baseUrl}/invitation/${acceptToken}`;

  const permissionDescription = permission === 'Edit'
    ? 'You can edit the document, manage sharing settings, and approve NDAs.'
    : 'You can manage sharing settings and approve NDAs, but cannot edit the document content.';

  return await sendEmail({
    to: inviteeEmail,
    from: 'system@cimshare.com',
    subject: `You've been invited to collaborate on "${documentTitle}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Collaboration Invitation</h2>
        <p>Hello ${inviteeName},</p>

        <p><strong>${inviterName}</strong> has invited you to collaborate on their CIM document:</p>

        <p style="font-size: 18px; font-weight: bold; color: #333; margin: 20px 0;">
          ${documentTitle}
        </p>

        <p><strong>Permission Level:</strong> ${permission}</p>
        <p style="color: #666; font-size: 14px;">${permissionDescription}</p>

        <div style="margin: 30px 0;">
          <a href="${acceptUrl}" style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Accept Invitation
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          This invitation will expire in 7 days. If you don't have a Broker Vault account, you'll be prompted to create one when accepting the invitation.
        </p>

        <p>Best regards,<br>The Broker Vault Team</p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from Broker Vault. If you received this in error, you can safely ignore it.
        </p>
      </div>
    `,
    text: `
      Collaboration Invitation

      Hello ${inviteeName},

      ${inviterName} has invited you to collaborate on their CIM document: "${documentTitle}"

      Permission Level: ${permission}
      ${permissionDescription}

      Accept this invitation by visiting:
      ${acceptUrl}

      This invitation will expire in 7 days.

      Best regards,
      The Broker Vault Team
    `
  });
}

async function sendCollaboratorRemovedEmail(
  collaboratorEmail: string,
  collaboratorName: string,
  documentTitle: string,
  removedByName: string
): Promise<boolean> {
  return await sendEmail({
    to: collaboratorEmail,
    from: 'system@cimshare.com',
    subject: `Access removed for "${documentTitle}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Collaboration Access Removed</h2>
        <p>Hello ${collaboratorName},</p>

        <p>You have been removed as a collaborator from the document:</p>

        <p style="font-size: 18px; font-weight: bold; color: #333; margin: 20px 0;">
          ${documentTitle}
        </p>

        <p>You no longer have access to this document.</p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          If you believe this was done in error, please contact ${removedByName} directly.
        </p>

        <p>Best regards,<br>The Broker Vault Team</p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from Broker Vault.
        </p>
      </div>
    `,
    text: `
      Collaboration Access Removed

      Hello ${collaboratorName},

      You have been removed as a collaborator from the document: "${documentTitle}"

      You no longer have access to this document.

      If you believe this was done in error, please contact ${removedByName} directly.

      Best regards,
      The Broker Vault Team
    `
  });
}

async function sendEditLockTakenOverEmail(
  previousEditorEmail: string,
  previousEditorName: string,
  documentTitle: string,
  newEditorName: string
): Promise<boolean> {
  return await sendEmail({
    to: previousEditorEmail,
    from: 'system@cimshare.com',
    subject: `Your editing session was interrupted on "${documentTitle}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Editing Session Interrupted</h2>
        <p>Hello ${previousEditorName},</p>

        <p><strong>${newEditorName}</strong> has taken over editing the document:</p>

        <p style="font-size: 18px; font-weight: bold; color: #333; margin: 20px 0;">
          ${documentTitle}
        </p>

        <p style="color: #d97706; font-weight: bold;">
          ⚠️ Any unsaved changes you made may have been lost.
        </p>

        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          Multiple people were trying to edit the same document at the same time. To avoid conflicts, only one person can edit at a time.
        </p>

        <p>Best regards,<br>The Broker Vault Team</p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from Broker Vault.
        </p>
      </div>
    `,
    text: `
      Editing Session Interrupted

      Hello ${previousEditorName},

      ${newEditorName} has taken over editing the document: "${documentTitle}"

      ⚠️ Any unsaved changes you made may have been lost.

      Multiple people were trying to edit the same document at the same time. To avoid conflicts, only one person can edit at a time.

      Best regards,
      The Broker Vault Team
    `
  });
}

// Send CSP violation notification to admin
async function sendCspViolationEmail(params: {
  userEmail: string;
  userName: string;
  documentId: number;
  documentTitle: string;
  htmlCode: string;
  cssCode: string;
  violations: string;
}): Promise<boolean> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 10px 10px 0 0;
          text-align: center;
        }
        .content {
          background: white;
          padding: 30px;
          border: 1px solid #e0e0e0;
          border-top: none;
          border-radius: 0 0 10px 10px;
        }
        .section {
          margin: 20px 0;
          padding: 15px;
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          border-radius: 4px;
        }
        .section h3 {
          margin-top: 0;
          color: #667eea;
        }
        .code-block {
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.5;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 10px;
          margin: 15px 0;
        }
        .info-label {
          font-weight: 600;
          color: #555;
        }
        .violations {
          background: #fff3cd;
          border: 1px solid #ffc107;
          padding: 15px;
          border-radius: 5px;
          margin: 15px 0;
        }
        .action-button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 24px;
          border-radius: 5px;
          text-decoration: none;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔒 CSP Violation Detected</h1>
        <p>A user attempted to save HTML code with non-whitelisted external domains</p>
      </div>
      <div class="content">
        <div class="section">
          <h3>User Information</h3>
          <div class="info-grid">
            <span class="info-label">User:</span>
            <span>${params.userName}</span>
            <span class="info-label">Email:</span>
            <span>${params.userEmail}</span>
            <span class="info-label">Document ID:</span>
            <span>#${params.documentId}</span>
            <span class="info-label">Document Title:</span>
            <span>${params.documentTitle}</span>
          </div>
        </div>

        <div class="violations">
          <h3>⚠️ Detected Violations</h3>
          <pre style="white-space: pre-wrap; margin: 0;">${params.violations}</pre>
        </div>

        <div class="section">
          <h3>HTML Code Submitted</h3>
          <div class="code-block">${params.htmlCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>

        ${params.cssCode ? `
        <div class="section">
          <h3>CSS Code Submitted</h3>
          <div class="code-block">${params.cssCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
        ` : ''}

        <div class="section">
          <h3>📋 Next Steps</h3>
          <ol>
            <li>Review the external domains listed above</li>
            <li>Verify the legitimacy and security of these third-party services</li>
            <li>If approved, add the domains to the CSP whitelist in <code>server/security.ts</code></li>
            <li>Reply to this email to notify the user or contact them directly</li>
          </ol>
          <p><strong>User has been notified that the support team will review their request.</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: 'support@cimshare.com',
    from: 'support@cimshare.com',
    replyTo: params.userEmail,
    subject: `CSP Violation: ${params.userName} - Document #${params.documentId}`,
    html: htmlContent,
    text: `
CSP VIOLATION DETECTED

User: ${params.userName} (${params.userEmail})
Document: #${params.documentId} - ${params.documentTitle}

VIOLATIONS:
${params.violations}

HTML CODE:
${params.htmlCode}

CSS CODE:
${params.cssCode || '(none)'}

Please review and whitelist these domains in server/security.ts if legitimate.
    `.trim()
  });
}

// E-Signature Email Functions

/**
 * Calculates whether text should be light or dark based on background color
 * Uses relative luminance formula for accessibility
 * @param hexColor - Hex color string (e.g., "#0072CE" or "0072CE")
 * @returns "white" or "black" for optimal contrast
 */
function getContrastTextColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance using sRGB formula
  // Higher values = lighter color
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Use white text for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

interface EsignEmailParams {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  senderEmail: string;
  documentTitle: string;
  message?: string;
  signingUrl: string;
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string;
    companyName?: string | null;
  };
}

async function sendEsignInvitationEmail(params: EsignEmailParams): Promise<boolean> {
  const primaryColor = params.branding?.primaryColor || '#0072CE';
  const companyName = params.branding?.companyName || 'Broker Vault';
  const headerTextColor = getContrastTextColor(primaryColor);
  const buttonTextColor = getContrastTextColor(primaryColor);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background-color: ${primaryColor}; padding: 30px; text-align: center; }
        .header h1 { color: ${headerTextColor}; margin: 0; font-size: 24px; font-weight: bold; }
        .content { padding: 30px; }
        .document-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .message-box { background: #e8f4fd; border-left: 4px solid ${primaryColor}; padding: 15px; margin: 20px 0; }
        .cta-section { text-align: center; margin: 30px 0; }
        .cta-button { display: inline-block; background-color: ${primaryColor}; color: ${buttonTextColor}; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { padding: 20px 30px; background: #f8f9fa; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${companyName}</h1>
        </div>
        <div class="content">
          <h2>You have a document to sign</h2>
          <p>Hi ${params.recipientName},</p>
          <p><strong>${params.senderName}</strong> has sent you a document to sign.</p>

          <div class="document-info">
            <p style="margin: 0;"><strong>Document:</strong> ${params.documentTitle}</p>
            <p style="margin: 10px 0 0 0;"><strong>From:</strong> ${params.senderName} (${params.senderEmail})</p>
          </div>

          ${params.message ? `
          <div class="message-box">
            <p style="margin: 0; color: #666; font-size: 14px;">Message from sender:</p>
            <p style="margin: 10px 0 0 0;">${params.message}</p>
          </div>
          ` : ''}

          <div class="cta-section">
            <a href="${params.signingUrl}" class="cta-button">Review & Sign Document</a>
          </div>

          <p style="font-size: 14px; color: #666;">
            This link will take you to a secure page where you can review the document and add your signature.
          </p>
        </div>
        <div class="footer">
          <p>This email was sent by ${companyName} on behalf of ${params.senderName}.</p>
          <p>If you have questions about this document, please reply to this email to contact the sender.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: params.recipientEmail,
    from: 'signatures@cimshare.com',
    replyTo: params.senderEmail,
    subject: `${params.senderName} sent you "${params.documentTitle}" for signature`,
    html: htmlContent,
    text: `
${params.senderName} has sent you a document to sign.

Document: ${params.documentTitle}
From: ${params.senderName} (${params.senderEmail})
${params.message ? `\nMessage: ${params.message}` : ''}

Click here to review and sign: ${params.signingUrl}

If you have questions, please reply to this email.
    `.trim()
  });
}

async function sendEsignReminderEmail(params: EsignEmailParams): Promise<boolean> {
  const primaryColor = params.branding?.primaryColor || '#0072CE';
  const companyName = params.branding?.companyName || 'Broker Vault';
  const buttonTextColor = getContrastTextColor(primaryColor);
  // Reminder header uses amber/orange - calculate contrast for that
  const reminderHeaderColor = '#f59e0b';
  const reminderHeaderTextColor = getContrastTextColor(reminderHeaderColor);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background-color: ${reminderHeaderColor}; padding: 30px; text-align: center; }
        .header h1 { color: ${reminderHeaderTextColor}; margin: 0; font-size: 20px; font-weight: bold; }
        .header p { color: ${reminderHeaderTextColor}; margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 30px; }
        .document-info { background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .cta-section { text-align: center; margin: 30px 0; }
        .cta-button { display: inline-block; background-color: ${primaryColor}; color: ${buttonTextColor}; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { padding: 20px 30px; background: #f8f9fa; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reminder: Document Awaiting Your Signature</h1>
          <p>${companyName}</p>
        </div>
        <div class="content">
          <p>Hi ${params.recipientName},</p>
          <p>This is a reminder that you have a document waiting for your signature.</p>

          <div class="document-info">
            <p style="margin: 0;"><strong>Document:</strong> ${params.documentTitle}</p>
            <p style="margin: 10px 0 0 0;"><strong>From:</strong> ${params.senderName}</p>
          </div>

          <div class="cta-section">
            <a href="${params.signingUrl}" class="cta-button">Review & Sign Now</a>
          </div>
        </div>
        <div class="footer">
          <p>If you have questions, please contact ${params.senderName} at ${params.senderEmail}.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: params.recipientEmail,
    from: 'signatures@cimshare.com',
    replyTo: params.senderEmail,
    subject: `Reminder: "${params.documentTitle}" is awaiting your signature`,
    html: htmlContent,
    text: `
Reminder: You have a document waiting for your signature.

Document: ${params.documentTitle}
From: ${params.senderName}

Click here to sign: ${params.signingUrl}
    `.trim()
  });
}

async function sendEsignCompletedEmail(params: {
  recipientEmail: string;
  recipientName: string;
  documentTitle: string;
  signerNames?: string;
  completedAt: Date;
  envelopeUrl: string;
  pdfAttachment?: {
    content: string; // base64 encoded PDF
    filename: string;
  };
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string;
    companyName?: string | null;
  };
}): Promise<boolean> {
  const primaryColor = params.branding?.primaryColor || '#0072CE';
  const companyName = params.branding?.companyName || 'Broker Vault';
  const buttonTextColor = getContrastTextColor(primaryColor);
  const hasAttachment = !!params.pdfAttachment;
  // Completed header uses green
  const completedHeaderColor = '#10b981';
  const completedHeaderTextColor = getContrastTextColor(completedHeaderColor);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background-color: ${completedHeaderColor}; padding: 30px; text-align: center; }
        .header h1 { color: ${completedHeaderTextColor}; margin: 0; font-size: 24px; font-weight: bold; }
        .header p { color: ${completedHeaderTextColor}; margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 30px; }
        .success-box { background: #d1fae5; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .attachment-notice { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .attachment-notice p { margin: 0; color: #0369a1; font-size: 14px; }
        .cta-button { display: inline-block; background-color: ${primaryColor}; color: ${buttonTextColor}; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px; }
        .footer { padding: 20px 30px; background: #f8f9fa; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Document Completed</h1>
          <p>${companyName}</p>
        </div>
        <div class="content">
          <p>Hi ${params.recipientName},</p>

          <div class="success-box">
            <p style="font-size: 18px; margin: 0;"><strong>${params.documentTitle}</strong></p>
            <p style="margin: 10px 0 0 0; color: #059669;">All parties have signed this document</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
              Completed on ${params.completedAt.toLocaleDateString('en-US', { dateStyle: 'long' })}
            </p>
          </div>

          ${hasAttachment ? `
          <div class="attachment-notice">
            <p><strong>📎 Completed document attached</strong></p>
            <p style="margin-top: 8px;">The signed PDF with Certificate of Completion is attached to this email.</p>
          </div>
          ` : ''}

          <div style="text-align: center;">
            <a href="${params.envelopeUrl}" class="cta-button">Go to Envelope</a>
          </div>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            The signed document includes a certificate of completion with an audit trail of all signature events.
          </p>
        </div>
        <div class="footer">
          <p>This is an automated message from ${companyName}'s E-Signature system.</p>
          <p>Please keep this email for your records.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailOptions: any = {
    to: params.recipientEmail,
    from: 'signatures@cimshare.com',
    subject: `Completed: "${params.documentTitle}" - All Signatures Collected`,
    html: htmlContent,
    text: `
Document Completed: ${params.documentTitle}

All parties have signed this document.
Completed on: ${params.completedAt.toLocaleDateString('en-US', { dateStyle: 'long' })}

${hasAttachment ? 'The completed signed PDF with Certificate of Completion is attached to this email.\n' : ''}
View envelope: ${params.envelopeUrl}

Please keep this email for your records.
    `.trim()
  };

  // Add PDF attachment if provided
  if (params.pdfAttachment) {
    emailOptions.attachments = [{
      content: params.pdfAttachment.content,
      filename: params.pdfAttachment.filename,
      type: 'application/pdf',
      disposition: 'attachment'
    }];
  }

  return sendEmail(emailOptions);
}

async function sendEsignDeclinedEmail(params: {
  ownerEmail: string;
  ownerName: string;
  declinedByName: string;
  declinedByEmail: string;
  documentTitle: string;
  reason?: string;
  branding?: {
    companyName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string;
  };
}): Promise<boolean> {
  const companyName = params.branding?.companyName || 'Broker Vault';
  // Declined header uses red
  const declinedHeaderColor = '#dc2626';
  const declinedHeaderTextColor = getContrastTextColor(declinedHeaderColor);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background-color: ${declinedHeaderColor}; padding: 30px; text-align: center; }
        .header h1 { color: ${declinedHeaderTextColor}; margin: 0; font-size: 24px; font-weight: bold; }
        .header p { color: ${declinedHeaderTextColor}; margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 30px; }
        .declined-box { background: #fee2e2; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .reason-box { background: #f3f4f6; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
        .footer { padding: 20px 30px; background: #f8f9fa; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Document Declined</h1>
          <p>${companyName}</p>
        </div>
        <div class="content">
          <p>Hi ${params.ownerName},</p>

          <div class="declined-box">
            <p style="margin: 0;"><strong>${params.documentTitle}</strong></p>
            <p style="margin: 10px 0 0 0;">was declined by <strong>${params.declinedByName}</strong></p>
          </div>

          ${params.reason ? `
          <div class="reason-box">
            <p style="margin: 0; color: #666; font-size: 14px;">Reason provided:</p>
            <p style="margin: 10px 0 0 0;">${params.reason}</p>
          </div>
          ` : ''}

          <p>The signing process has been cancelled and all parties have been notified.</p>
          <p>If you wish, you can create a new envelope and send it again.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from ${companyName}'s E-Signature system.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: params.ownerEmail,
    from: 'signatures@cimshare.com',
    subject: `Declined: "${params.documentTitle}" was declined by ${params.declinedByName}`,
    html: htmlContent,
    text: `
Document Declined

"${params.documentTitle}" was declined by ${params.declinedByName} (${params.declinedByEmail}).
${params.reason ? `\nReason: ${params.reason}` : ''}

The signing process has been cancelled.
    `.trim()
  });
}

async function sendEsignVoidedEmail(params: {
  recipientEmail: string;
  recipientName: string;
  documentTitle: string;
  voidedByName: string;
  reason?: string;
  branding?: {
    companyName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string;
  };
}): Promise<boolean> {
  const companyName = params.branding?.companyName || 'Broker Vault';
  // Voided header uses gray
  const voidedHeaderColor = '#6b7280';
  const voidedHeaderTextColor = getContrastTextColor(voidedHeaderColor);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background-color: ${voidedHeaderColor}; padding: 30px; text-align: center; }
        .header h1 { color: ${voidedHeaderTextColor}; margin: 0; font-size: 24px; font-weight: bold; }
        .header p { color: ${voidedHeaderTextColor}; margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 30px; }
        .voided-box { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #6b7280; }
        .reason-box { background: #f9fafb; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { padding: 20px 30px; background: #f8f9fa; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Document Voided</h1>
          <p>${companyName}</p>
        </div>
        <div class="content">
          <p>Hi ${params.recipientName},</p>

          <div class="voided-box">
            <p style="margin: 0;"><strong>${params.documentTitle}</strong></p>
            <p style="margin: 10px 0 0 0;">has been voided by <strong>${params.voidedByName}</strong></p>
          </div>

          ${params.reason ? `
          <div class="reason-box">
            <p style="margin: 0; color: #666; font-size: 14px;">Reason:</p>
            <p style="margin: 10px 0 0 0;">${params.reason}</p>
          </div>
          ` : ''}

          <p>This document is no longer valid and no further action is required from you.</p>
          <p>If you have any questions, please contact the sender directly.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from ${companyName}'s E-Signature system.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: params.recipientEmail,
    from: 'signatures@cimshare.com',
    subject: `Voided: "${params.documentTitle}" has been cancelled`,
    html: htmlContent,
    text: `
Document Voided

"${params.documentTitle}" has been voided by ${params.voidedByName}.
${params.reason ? `\nReason: ${params.reason}` : ''}

This document is no longer valid and no further action is required from you.
    `.trim()
  });
}

async function sendFirstDocumentCongratulationsEmail(params: {
  userEmail: string;
  userName: string;
  documentTitle: string;
  documentId: number;
}): Promise<boolean> {
  const { userEmail, userName, documentTitle, documentId } = params;
  const documentUrl = `https://cimshare.com/cim/${documentId}`;
  const firstName = userName.split(' ')[0] || 'there';

  return sendEmail({
    to: userEmail,
    from: 'Broker Vault <hello@cimshare.com>',
    replyTo: 'support@cimshare.com',
    subject: `Congratulations on your first CIM! - ${documentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Congratulations! 🎉</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 16px;">You've created your first CIM</p>
        </div>

        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">Hi ${firstName},</p>

          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            You've just created your first Confidential Information Memorandum: <strong>"${documentTitle}"</strong>.
            This is an exciting step in presenting your business professionally to potential buyers and investors!
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${documentUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
              View Your Document
            </a>
          </div>

          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #333; font-size: 18px;">💡 Next Steps to Maximize Your CIM</h3>

            <div style="margin: 20px 0;">
              <p style="margin: 12px 0; color: #555; font-size: 14px;">
                <strong style="color: #667eea;">🔒 Protect with NDA Settings</strong><br>
                Require potential buyers to sign an NDA before viewing your confidential business information.
                This keeps your sensitive data secure.
              </p>

              <p style="margin: 12px 0; color: #555; font-size: 14px;">
                <strong style="color: #667eea;">🔗 Configure Sharing Settings</strong><br>
                Set password protection, expiration dates, and control who can access your document.
                Track every view with detailed analytics.
              </p>

              <p style="margin: 12px 0; color: #555; font-size: 14px;">
                <strong style="color: #667eea;">✍️ Use E-Signatures</strong><br>
                Send documents for legally binding electronic signatures directly from Broker Vault.
              </p>
            </div>
          </div>

          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            We're here to help you succeed. If you have any questions or feature suggestions,
            don't hesitate to reach out!
          </p>

          <p style="font-size: 16px; color: #333; margin-top: 25px;">
            Best regards,<br>
            <strong>The Broker Vault Team</strong>
          </p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 8px 8px; border-top: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 14px; text-align: center;">
            Questions? Contact us at <a href="mailto:support@cimshare.com" style="color: #667eea;">support@cimshare.com</a>
          </p>
        </div>
      </div>
    `,
    text: `
Congratulations! 🎉

Hi ${firstName},

You've just created your first Confidential Information Memorandum: "${documentTitle}".
This is an exciting step in presenting your business professionally to potential buyers and investors!

View your document: ${documentUrl}

NEXT STEPS TO MAXIMIZE YOUR CIM:

🔒 Protect with NDA Settings
Require potential buyers to sign an NDA before viewing your confidential business information.

🔗 Configure Sharing Settings
Set password protection, expiration dates, and control who can access your document.

✍️ Use E-Signatures
Send documents for legally binding electronic signatures directly from Broker Vault.

We're here to help you succeed. If you have any questions or feature suggestions,
don't hesitate to reach out at support@cimshare.com!

Best regards,
The Broker Vault Team
    `.trim()
  });
}

// Team invitation email
async function sendTeamInviteEmail(params: {
  inviteeEmail: string;
  inviteeName: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteToken?: string; // Optional token for pending invitations (non-existing users)
}): Promise<boolean> {
  const { inviteeEmail, inviteeName, inviterName, organizationName, role, inviteToken } = params;
  const baseUrl = process.env.BASE_URL || 'https://cimshare.com';

  // If there's an invite token, user needs to create account first
  // Otherwise, they just need to log in
  const actionUrl = inviteToken
    ? `${baseUrl}/auth?invite=${inviteToken}`
    : `${baseUrl}/auth`;

  const buttonText = inviteToken ? 'Create Account & Join Team' : 'Accept Invitation';
  const actionDescription = inviteToken
    ? 'Click the button above to create your account and join the team.'
    : 'Click the button above to log in. Once signed in, you\'ll automatically have access to the team.';

  const roleDescriptions: Record<string, string> = {
    admin: 'As an Admin, you can manage team settings, invite members, and access all CRM features.',
    member: 'As a Member, you can access deals, contacts, companies, and collaborate with your team.',
    viewer: 'As a Viewer, you have read-only access to view deals, contacts, and company information.',
  };

  const roleDescription = roleDescriptions[role] || roleDescriptions.member;

  return await sendEmail({
    to: inviteeEmail,
    from: 'system@cimshare.com',
    subject: `You've been invited to join ${organizationName} on Broker Vault`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
        </div>

        <div style="padding: 30px; background-color: #fff; border: 1px solid #eee; border-top: none;">
          <p style="font-size: 16px; color: #333;">Hello ${inviteeName || 'there'},</p>

          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Broker Vault as a <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong>.
          </p>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0; color: #555; font-size: 14px;">
              ${roleDescription}
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
              ${buttonText}
            </a>
          </div>

          <p style="font-size: 14px; color: #666;">
            ${actionDescription}
          </p>

          <p style="font-size: 16px; color: #333; margin-top: 25px;">
            Best regards,<br>
            <strong>The Broker Vault Team</strong>
          </p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 8px 8px; border: 1px solid #eee; border-top: none;">
          <p style="margin: 0; color: #666; font-size: 12px; text-align: center;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
    text: `
You're Invited!

Hello ${inviteeName || 'there'},

${inviterName} has invited you to join ${organizationName} on Broker Vault as a ${role.charAt(0).toUpperCase() + role.slice(1)}.

${roleDescription}

Accept your invitation by visiting:
${actionUrl}

${actionDescription}

Best regards,
The Broker Vault Team

If you didn't expect this invitation, you can safely ignore this email.
    `.trim()
  });
}

// Mention notification email
async function sendMentionNotificationEmail(params: {
  mentionedUserEmail: string;
  mentionedUserName: string;
  mentionerName: string;
  entityType: string; // 'deal', 'contact', 'company'
  entityName: string;
  entityId: number;
  noteContent: string;
}): Promise<boolean> {
  const { mentionedUserEmail, mentionedUserName, mentionerName, entityType, entityName, entityId, noteContent } = params;
  const baseUrl = process.env.BASE_URL || 'https://cimshare.com';

  // Build the URL to the entity (handle "company" -> "companies" plural)
  const entityPlural = entityType === 'company' ? 'companies' : `${entityType}s`;
  const entityUrl = `${baseUrl}/${entityPlural}/${entityId}`;

  // Truncate note content if too long
  const truncatedNote = noteContent.length > 500
    ? noteContent.substring(0, 500) + '...'
    : noteContent;

  const entityTypeDisplay = entityType.charAt(0).toUpperCase() + entityType.slice(1);

  return await sendEmail({
    to: mentionedUserEmail,
    from: 'system@cimshare.com',
    subject: `${mentionerName} mentioned you in a note`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px 30px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">You were mentioned in a note</h1>
        </div>

        <div style="padding: 30px; background-color: #fff; border: 1px solid #eee; border-top: none;">
          <p style="font-size: 16px; color: #333;">Hi ${mentionedUserName || 'there'},</p>

          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${mentionerName}</strong> mentioned you in a note on the ${entityTypeDisplay.toLowerCase()} <strong>"${entityName}"</strong>.
          </p>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
            <p style="margin: 0; color: #555; font-size: 14px; white-space: pre-wrap; line-height: 1.6;">
              ${truncatedNote.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${entityUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 14px;">
              View ${entityTypeDisplay}
            </a>
          </div>

          <p style="font-size: 16px; color: #333; margin-top: 25px;">
            Best regards,<br>
            <strong>The Broker Vault Team</strong>
          </p>
        </div>

        <div style="background-color: #f8f9fa; padding: 15px 30px; border-radius: 0 0 8px 8px; border: 1px solid #eee; border-top: none;">
          <p style="margin: 0; color: #666; font-size: 12px; text-align: center;">
            You received this email because you were mentioned in Broker Vault.
            <a href="${baseUrl}/settings/notifications" style="color: #667eea;">Manage notification preferences</a>
          </p>
        </div>
      </div>
    `,
    text: `
You were mentioned in a note

Hi ${mentionedUserName || 'there'},

${mentionerName} mentioned you in a note on the ${entityTypeDisplay.toLowerCase()} "${entityName}".

Note content:
${truncatedNote}

View the ${entityTypeDisplay.toLowerCase()}: ${entityUrl}

Best regards,
The Broker Vault Team

You received this email because you were mentioned in Broker Vault.
    `.trim()
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
  sendOwnerApprovalNotification,
  sendRejectionEmail,
  sendCollaborationInvitationEmail,
  sendCollaboratorRemovedEmail,
  sendEditLockTakenOverEmail,
  sendCspViolationEmail,
  // E-Signature emails
  sendEsignInvitationEmail,
  sendEsignReminderEmail,
  sendEsignCompletedEmail,
  sendEsignDeclinedEmail,
  sendEsignVoidedEmail,
  // User milestone emails
  sendFirstDocumentCongratulationsEmail,
  // Team and notification emails
  sendTeamInviteEmail,
  sendMentionNotificationEmail
};