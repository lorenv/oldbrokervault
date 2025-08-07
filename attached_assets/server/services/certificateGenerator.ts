import PDFDocument from 'pdfkit';
import { promises as fs } from 'fs';
import path from 'path';
import type { Document, Recipient, AuditTrail } from '@shared/schema';
import { getLocationFromIP, formatLocationForCertificate } from './locationService';

interface CertificateData {
  document: Document;
  recipients: Recipient[];
  auditTrail: AuditTrail[];
  completedAt: Date;
}

export async function generateCertificateOfCompletion(data: CertificateData): Promise<string> {
  console.log('[CERTIFICATE] 🎓 Starting PDF certificate generation...');
  const { document, recipients, auditTrail, completedAt } = data;
  
  console.log(`[CERTIFICATE] Document: ${document.title} (ID: ${document.id})`);
  console.log(`[CERTIFICATE] Recipients: ${recipients.length}`);
  console.log(`[CERTIFICATE] Audit entries: ${auditTrail.length}`);
  
  // Generate certificate ID (envelope ID equivalent)
  const certificateId = generateCertificateId();
  console.log(`[CERTIFICATE] Certificate ID: ${certificateId}`);
  
  // Count signatures and initials from audit trail
  const signatureEvents = auditTrail.filter(entry => entry.action === 'signed');
  const totalSignatures = Math.max(signatureEvents.length, recipients.filter(r => r.status === 'signed').length);
  const totalInitials = auditTrail.filter(entry => entry.action === 'initialed').length;
  
  // Get document creator info
  const creator = recipients.find(r => r.role === 'sender') || recipients[0];

  // Lookup locations for all signed recipients
  console.log(`[CERTIFICATE] 📍 Looking up locations for signed recipients...`);
  const recipientsWithLocations = await Promise.all(
    recipients.filter(r => r.status === 'signed').map(async (recipient) => {
      const signedEvent = auditTrail.find(entry => 
        entry.performedBy === recipient.email && entry.action === 'signed'
      );
      
      let location = null;
      if (signedEvent?.ipAddress) {
        try {
          location = await getLocationFromIP(signedEvent.ipAddress);
        } catch (error) {
          console.warn(`[CERTIFICATE] Failed to lookup location for ${recipient.email}:`, error);
        }
      }
      
      return {
        ...recipient,
        location,
        signedEvent
      };
    })
  );
  
  console.log(`[CERTIFICATE] ✅ Location lookup completed for ${recipientsWithLocations.length} recipients`);
  
  // Generate the PDF certificate
  console.log(`[CERTIFICATE] Building PDF certificate...`);
  const certificatePdf = await buildCertificatePdf({
    certificateId,
    document,
    recipients: recipientsWithLocations,
    auditTrail,
    completedAt,
    totalSignatures,
    totalInitials,
    creator
  });
  
  // Save PDF and convert to PNG for display
  const documentId = document.id.toString();
  const uploadDir = path.join(process.cwd(), 'uploads');
  const imagesDir = path.join(uploadDir, 'images', documentId);
  
  await fs.mkdir(imagesDir, { recursive: true });
  
  // Save the PDF file
  const certificatePageNumber = document.pageCount + 1;
  const pdfPath = path.join(imagesDir, `certificate-${certificatePageNumber}.pdf`);
  await fs.writeFile(pdfPath, certificatePdf);
  console.log(`[CERTIFICATE] ✅ PDF certificate saved: ${pdfPath}`);
  
  // Create a simple, professional certificate page directly as PNG
  const certificatePath = path.join(imagesDir, `page-${certificatePageNumber}.png`);
  
  console.log(`[CERTIFICATE] 📄 Creating simple certificate page...`);
  
  // Create a clean, simple certificate using SVG then convert to PNG
  const certificateSvg = `
    <svg width="600" height="825" xmlns="http://www.w3.org/2000/svg" style="background: #f9fafb;">
      <!-- Professional grey header -->
      <rect x="0" y="0" width="600" height="120" fill="#6b7280"/>
      
      <!-- Main title -->
      <text x="300" y="50" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">Certificate of Completion</text>
      <text x="300" y="75" font-family="Arial, sans-serif" font-size="14" fill="white" text-anchor="middle">Digital Signature Verification</text>
      <text x="300" y="95" font-family="Arial, sans-serif" font-size="12" fill="white" text-anchor="middle">ID: CERT-${certificateId.substring(0, 12)}</text>
      
      <!-- Document info section -->
      <rect x="40" y="150" width="520" height="120" fill="#f3f4f6" stroke="#d1d5db" stroke-width="1" rx="8"/>
      <text x="60" y="180" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#111827">Document: ${escapeXml(document.title)}</text>
      <text x="60" y="205" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">Completed: ${completedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</text>
      <text x="60" y="225" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">Total Signatures: ${totalSignatures}</text>
      <text x="60" y="245" font-family="Arial, sans-serif" font-size="12" fill="#059669" font-weight="bold">✓ COMPLETED</text>
      
      <!-- Signature details -->
      <text x="60" y="310" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#111827">Signature Details</text>
      
      ${recipientsWithLocations.map((recipient, index) => {
        const yPos = 340 + (index * 100); // Increased spacing to 100px for better padding
        const signedEvent = recipient.signedEvent;
        const formatDateTime = (timestamp: Date | string) => {
          const date = new Date(timestamp);
          // Use UTC consistently for all certificate timestamps
          return date.toLocaleString('en-US', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
          });
        };
        return `
          <rect x="40" y="${yPos - 20}" width="520" height="90" fill="${index % 2 === 0 ? '#ffffff' : '#f9fafb'}" stroke="#d1d5db" stroke-width="1" rx="4"/>
          <text x="60" y="${yPos + 5}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#111827">${escapeXml(recipient.fullName)}</text>
          <text x="60" y="${yPos + 25}" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">${escapeXml(recipient.email)}</text>
          <text x="60" y="${yPos + 45}" font-family="Arial, sans-serif" font-size="10" fill="#9ca3af">Signed: ${signedEvent ? formatDateTime(signedEvent.timestamp) : 'N/A'}</text>
          <text x="60" y="${yPos + 65}" font-family="Arial, sans-serif" font-size="10" fill="#9ca3af">IP: ${signedEvent?.ipAddress || 'N/A'}</text>
        `;
      }).join('')}
      
      <!-- Legal notice -->
      <text x="60" y="${450 + (recipientsWithLocations.length * 100)}" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">This document was electronically signed in compliance with E-SIGN and UETA.</text>
      <text x="60" y="${470 + (recipientsWithLocations.length * 100)}" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">Each signature includes a complete audit trail for legal validity.</text>
      
      <!-- Footer -->
      <text x="300" y="800" font-family="Arial, sans-serif" font-size="9" fill="#9ca3af" text-anchor="middle">Generated ${new Date().toLocaleDateString('en-US')} | Undersigned Digital Platform</text>
    </svg>
  `;
  
  // Convert SVG to PNG using Sharp
  const sharp = (await import('sharp')).default;
  const pngBuffer = await sharp(Buffer.from(certificateSvg))
    .png({ quality: 95, compressionLevel: 4 })
    .toBuffer();
  
  await fs.writeFile(certificatePath, pngBuffer);
  console.log(`[CERTIFICATE] ✅ Simple certificate created: ${certificatePath}`);
  
  return `${documentId}/page-${certificatePageNumber}.png`;
}

function generateCertificateId(): string {
  // Generate a professional-looking certificate ID similar to DocuSign
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) result += '-';
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Helper function to escape XML/SVG special characters
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
    return c;
  });
}

async function buildCertificatePdf(params: {
  certificateId: string;
  document: Document;
  recipients: Recipient[];
  auditTrail: AuditTrail[];
  completedAt: Date;
  totalSignatures: number;
  totalInitials: number;
  creator?: Recipient;
}): Promise<Buffer> {
  const { certificateId, document, recipients, auditTrail, completedAt, totalSignatures, totalInitials, creator } = params;
  
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  };
  
  const formatDateShort = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric'
    });
  };
  
  const getClientInfo = (entry: AuditTrail) => {
    return entry.ipAddress || 'Unknown';
  };
  
  const signedRecipients = recipients.filter(r => r.status === 'signed');
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    
    // Colors
    const primaryBlue = '#2563eb';
    const darkGray = '#1f2937';
    const mediumGray = '#374151';
    const lightGray = '#6b7280';
    const green = '#16a34a';
    const lightBg = '#f8fafc';
    
    // Professional Header with gradient effect
    doc.rect(0, 0, doc.page.width, 140)
       .fillAndStroke(primaryBlue, primaryBlue);
    
    // Main title
    doc.fillColor('white')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('CERTIFICATE OF COMPLETION', 50, 50, { align: 'center' });
    
    // Subtitle
    doc.fontSize(14)
       .font('Helvetica')
       .text('Digital Signature Verification & Legal Record', 50, 85, { align: 'center' });
    
    // Certificate ID
    doc.fontSize(11)
       .text(`Certificate ID: CERT-${document.id}-${certificateId.substring(0, 8)}`, 50, 110, { align: 'center' });
    
    // Document Information Panel
    let currentY = 180;
    
    // Document info background
    doc.rect(50, currentY, doc.page.width - 100, 120)
       .fillAndStroke('#ffffff', '#e5e7eb');
    
    // Header background
    doc.rect(50, currentY, doc.page.width - 100, 35)
       .fillAndStroke(lightBg, '#e5e7eb');
    
    // Section header
    doc.fillColor(darkGray)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('Document Information', 70, currentY + 15);
    
    currentY += 50;
    
    // Document details in two columns
    doc.fillColor(mediumGray)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Document Title:', 70, currentY)
       .font('Helvetica')
       .fillColor(darkGray)
       .text(document.title, 180, currentY);
    
    doc.fillColor(mediumGray)
       .font('Helvetica-Bold')
       .text('Document ID:', 350, currentY)
       .font('Helvetica')
       .fillColor(darkGray)
       .text(`#${document.id}`, 430, currentY);
    
    currentY += 20;
    
    doc.fillColor(mediumGray)
       .font('Helvetica-Bold')
       .text('Completion Date:', 70, currentY)
       .font('Helvetica')
       .fillColor(darkGray)
       .text(formatDateShort(completedAt), 180, currentY);
    
    doc.fillColor(mediumGray)
       .font('Helvetica-Bold')
       .text('Total Signatures:', 350, currentY)
       .font('Helvetica')
       .fillColor(green)
       .text(totalSignatures.toString(), 430, currentY);
    
    currentY += 20;
    
    doc.fillColor(mediumGray)
       .font('Helvetica-Bold')
       .text('Total Pages:', 70, currentY)
       .font('Helvetica')
       .fillColor(darkGray)
       .text(document.pageCount.toString(), 180, currentY);
    
    doc.fillColor(mediumGray)
       .font('Helvetica-Bold')
       .text('Status:', 350, currentY)
       .font('Helvetica-Bold')
       .fillColor(green)
       .text('✓ COMPLETED', 430, currentY);
    
    // Signatures Section
    currentY += 60;
    
    doc.fillColor(darkGray)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('Electronic Signatures', 70, currentY);
    
    currentY += 30;
    
    // Table header
    doc.rect(50, currentY, doc.page.width - 100, 35)
       .fillAndStroke('#1e293b', '#1e293b');
    
    doc.fillColor('white')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('SIGNER INFORMATION', 70, currentY + 12)
       .text('ELECTRONIC SIGNATURE', 250, currentY + 12)
       .text('VERIFICATION', 450, currentY + 12);
    
    currentY += 35;
    
    // Signature rows
    signedRecipients.forEach((recipient, index) => {
      const signedEvent = auditTrail.find(entry => 
        entry.performedBy === recipient.email && entry.action === 'signed'
      );
      
      const rowHeight = 60;
      const bgColor = index % 2 === 0 ? lightBg : '#ffffff';
      
      // Row background
      doc.rect(50, currentY, doc.page.width - 100, rowHeight)
         .fillAndStroke(bgColor, '#e5e7eb');
      
      // Signer information
      doc.fillColor(darkGray)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(recipient.fullName, 70, currentY + 12);
      
      doc.fillColor(lightGray)
         .fontSize(10)
         .font('Helvetica')
         .text(recipient.email, 70, currentY + 28);
      
      doc.fontSize(9)
         .text(`IP: ${signedEvent ? getClientInfo(signedEvent) : 'N/A'}`, 70, currentY + 42);
      
      // Electronic signature (stylized name)
      doc.fillColor(primaryBlue)
         .fontSize(16)
         .font('Helvetica-Oblique')
         .text(recipient.fullName, 250, currentY + 20);
      
      doc.fillColor(lightGray)
         .fontSize(9)
         .font('Helvetica')
         .text('Electronic Signature', 250, currentY + 38);
      
      // Verification details
      doc.fillColor(mediumGray)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('Signed:', 450, currentY + 12);
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(signedEvent ? formatDate(signedEvent.timestamp) : 'N/A', 450, currentY + 26);
      
      doc.fillColor(green)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('✓ COMPLETED', 450, currentY + 42);
      
      currentY += rowHeight;
    });
    
    // Legal compliance section
    currentY += 30;
    
    // Check if we need a new page
    if (currentY > doc.page.height - 200) {
      doc.addPage();
      currentY = 50;
    }
    
    doc.rect(50, currentY, doc.page.width - 100, 120)
       .fillAndStroke(lightBg, '#e5e7eb');
    
    doc.fillColor(darkGray)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('Electronic Signature Legal Disclosure', 70, currentY + 20);
    
    const legalText = [
      'This document was electronically signed using legally binding electronic signatures in accordance with the Electronic Signatures',
      'in Global and National Commerce Act (E-SIGN) and the Uniform Electronic Transactions Act (UETA). Each signature includes',
      'a complete audit trail with timestamp, IP address, and user verification for maximum legal validity.',
      '',
      'This certificate serves as a permanent legal record of the electronic signature process and document completion.'
    ];
    
    doc.fillColor(mediumGray)
       .fontSize(10)
       .font('Helvetica');
    
    let textY = currentY + 50;
    legalText.forEach(line => {
      if (line === '') {
        textY += 5;
      } else {
        doc.text(line, 70, textY);
        textY += 12;
      }
    });
    
    // Security seal (simple text version)
    doc.fillColor(green)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('✓ VERIFIED & SECURE', doc.page.width - 150, currentY + 70, { align: 'center' });
    
    // Footer timestamp
    doc.fillColor('#9ca3af')
       .fontSize(8)
       .font('Helvetica')
       .text(
         `Certificate generated on ${formatDate(new Date())} | Undersigned Digital Signature Platform`,
         50,
         doc.page.height - 30,
         { align: 'center' }
       );
    
    doc.end();
  });
}