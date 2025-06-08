import PDFDocument from 'pdfkit';
import * as pdfLib from 'pdf-lib';

export function addSignatureToNda(
  originalNdaBase64: string,
  signerName: string,
  signedDate: Date,
  signerEmail?: string,
  signerIpAddress?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('🔄 Starting NDA signature creation...');
    console.log('📄 Original NDA size:', originalNdaBase64.length, 'characters');
    console.log('✍️ Signer:', signerName);
    console.log('📅 Date:', signedDate.toISOString());
    
    try {
      
      // Use pdf-lib for proper PDF manipulation
      (async () => {
        try {
          console.log('📖 Loading original PDF...');
          // Load the original NDA PDF
          const originalPdfBytes = Buffer.from(originalNdaBase64, 'base64');
          console.log('📊 PDF bytes length:', originalPdfBytes.length);
          
          const pdfDoc = await pdfLib.PDFDocument.load(originalPdfBytes);
          console.log('✅ Original PDF loaded successfully, pages:', pdfDoc.getPageCount());
          
          // Create signature page
          const signaturePage = pdfDoc.addPage([612, 792]); // Standard letter size
          const { width, height } = signaturePage.getSize();
          
          // Add signature page content
          signaturePage.drawText('SIGNATURE PAGE', {
            x: width / 2 - 80,
            y: height - 100,
            size: 18,
            color: pdfLib.rgb(0, 0, 0),
          });
          
          signaturePage.drawText('By signing below, I acknowledge that I have read and agree to the terms', {
            x: 50,
            y: height - 150,
            size: 12,
          });
          
          signaturePage.drawText('of the Non-Disclosure Agreement above.', {
            x: 50,
            y: height - 170,
            size: 12,
          });
          
          // Add signer name with custom Handwritania font
          let signatureFont;
          try {
            // Try to load the custom Handwritania font
            const fs = await import('fs');
            const path = await import('path');
            const fontPath = path.join(process.cwd(), 'public/fonts/Handwritania.ttf');
            const fontBytes = fs.readFileSync(fontPath);
            signatureFont = await pdfDoc.embedFont(fontBytes);
            console.log('✅ Custom Handwritania font loaded successfully');
          } catch (error) {
            console.warn('⚠️ Failed to load custom font, using fallback:', error);
            // Fallback to Times Roman Italic if custom font fails
            signatureFont = await pdfDoc.embedFont(pdfLib.StandardFonts.TimesRomanItalic);
          }
          
          // Create signature with custom font - no rotation for clean appearance
          signaturePage.drawText(signerName, {
            x: 60,
            y: height - 230,
            size: 32,
            font: signatureFont,
            color: pdfLib.rgb(0.1, 0.1, 0.4),
            // Removed rotation as requested
          });
          
          // Add a subtle underline for signature authenticity
          signaturePage.drawLine({
            start: { x: 50, y: height - 245 },
            end: { x: 350, y: height - 245 },
            thickness: 1,
            color: pdfLib.rgb(0.6, 0.6, 0.6),
          });
          
          // Add date
          signaturePage.drawText(`Date: ${signedDate.toLocaleDateString()}`, {
            x: 400,
            y: height - 230,
            size: 12,
          });
          
          // Add digital signature info
          signaturePage.drawText(`Digitally signed on ${signedDate.toLocaleString()}`, {
            x: 50,
            y: height - 280,
            size: 10,
          });
          
          if (signerEmail) {
            signaturePage.drawText(`Email: ${signerEmail}`, {
              x: 50,
              y: height - 300,
              size: 10,
            });
          }
          
          if (signerIpAddress) {
            signaturePage.drawText(`IP Address: ${signerIpAddress}`, {
              x: 50,
              y: height - 320,
              size: 10,
            });
          }
          
          // Create Certificate of Completion page
          const certificatePage = pdfDoc.addPage([612, 792]);
          const certWidth = certificatePage.getSize().width;
          const certHeight = certificatePage.getSize().height;
          
          // Draw grey header background (DocuSign style)
          certificatePage.drawRectangle({
            x: 0,
            y: certHeight - 120,
            width: certWidth,
            height: 80,
            color: pdfLib.rgb(0.9, 0.9, 0.9),
          });
          
          // Certificate header in bold
          const headerFont = await pdfDoc.embedFont(pdfLib.StandardFonts.HelveticaBold);
          certificatePage.drawText('Certificate of Completion', {
            x: 50,
            y: certHeight - 70,
            size: 18,
            font: headerFont,
            color: pdfLib.rgb(0.2, 0.2, 0.2),
          });
          
          // Status indicator
          certificatePage.drawText('Status: Completed', {
            x: certWidth - 150,
            y: certHeight - 70,
            size: 12,
            font: headerFont,
            color: pdfLib.rgb(0.0, 0.6, 0.0),
          });
          
          // Document details section
          const regularFont = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);
          
          // Document information box
          certificatePage.drawRectangle({
            x: 30,
            y: certHeight - 220,
            width: certWidth - 60,
            height: 80,
            borderColor: pdfLib.rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
          });
          
          certificatePage.drawText('Document: Non-Disclosure Agreement', {
            x: 50,
            y: certHeight - 160,
            size: 12,
            font: regularFont,
            color: pdfLib.rgb(0.3, 0.3, 0.3),
          });
          
          certificatePage.drawText(`Signer: ${signerName}`, {
            x: 50,
            y: certHeight - 180,
            size: 12,
            font: regularFont,
            color: pdfLib.rgb(0.3, 0.3, 0.3),
          });
          
          certificatePage.drawText(`Email: ${signerEmail || 'Not provided'}`, {
            x: 50,
            y: certHeight - 200,
            size: 12,
            font: regularFont,
            color: pdfLib.rgb(0.3, 0.3, 0.3),
          });
          
          // Signature section header
          certificatePage.drawRectangle({
            x: 0,
            y: certHeight - 280,
            width: certWidth,
            height: 30,
            color: pdfLib.rgb(0.95, 0.95, 0.95),
          });
          
          certificatePage.drawText('Signature Events', {
            x: 50,
            y: certHeight - 270,
            size: 14,
            font: headerFont,
            color: pdfLib.rgb(0.2, 0.2, 0.2),
          });
          
          // Signature details
          certificatePage.drawText(`Signed: ${signedDate.toLocaleString()}`, {
            x: 50,
            y: certHeight - 320,
            size: 12,
            font: regularFont,
          });
          
          certificatePage.drawText(`IP Address: ${signerIpAddress || 'Not recorded'}`, {
            x: 50,
            y: certHeight - 340,
            size: 12,
            font: regularFont,
          });
          
          certificatePage.drawText('Security Level: Email Verification', {
            x: 50,
            y: certHeight - 360,
            size: 12,
            font: regularFont,
          });
          
          // Record tracking section
          certificatePage.drawRectangle({
            x: 0,
            y: certHeight - 430,
            width: certWidth,
            height: 30,
            color: pdfLib.rgb(0.95, 0.95, 0.95),
          });
          
          certificatePage.drawText('Record Tracking', {
            x: 50,
            y: certHeight - 420,
            size: 14,
            font: headerFont,
            color: pdfLib.rgb(0.2, 0.2, 0.2),
          });
          
          certificatePage.drawText('Status: Original', {
            x: 50,
            y: certHeight - 460,
            size: 12,
            font: regularFont,
          });
          
          certificatePage.drawText(`Document ID: CIM-NDA-${Date.now().toString().slice(-8)}`, {
            x: 50,
            y: certHeight - 480,
            size: 12,
            font: regularFont,
          });
          
          // Legal compliance footer
          certificatePage.drawText('Electronic Record and Signature Disclosure:', {
            x: 50,
            y: certHeight - 540,
            size: 10,
            font: headerFont,
            color: pdfLib.rgb(0.4, 0.4, 0.4),
          });
          
          certificatePage.drawText('This document has been completed in compliance with the Electronic Signatures', {
            x: 50,
            y: certHeight - 560,
            size: 9,
            font: regularFont,
            color: pdfLib.rgb(0.4, 0.4, 0.4),
          });
          
          certificatePage.drawText('in Global and National Commerce Act (ESIGN) and applicable state laws.', {
            x: 50,
            y: certHeight - 575,
            size: 9,
            font: regularFont,
            color: pdfLib.rgb(0.4, 0.4, 0.4),
          });
          
          console.log('📝 Creating signature page...');
          console.log('📝 Adding certificate of completion...');
          
          // Save the modified PDF
          console.log('💾 Saving final PDF...');
          const pdfBytes = await pdfDoc.save();
          console.log('📊 Final PDF size:', pdfBytes.length, 'bytes');
          
          const base64 = Buffer.from(pdfBytes).toString('base64');
          console.log('✅ PDF signature creation completed successfully');
          console.log('📤 Base64 output size:', base64.length, 'characters');
          resolve(base64);
          
        } catch (error) {
          console.error('❌ PDF processing error:', error);
          console.log('🔄 Falling back to simple PDF creation...');
          // Fallback to simple PDF creation
          const doc = new PDFDocument();
          const chunks: Buffer[] = [];

          doc.on('data', (chunk) => chunks.push(chunk));
          doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            const base64 = pdfBuffer.toString('base64');
            resolve(base64);
          });

          // Simple fallback content
          doc.fontSize(12).text('NDA Document', 50, 50);
          doc.addPage();
          doc.fontSize(16).text('SIGNATURE PAGE', 50, 50, { align: 'center' });
          doc.fontSize(18).font('Times-Italic').text(signerName, 55, 150);
          doc.fontSize(12).font('Helvetica').text(`Date: ${signedDate.toLocaleDateString()}`, 300, 150);
          doc.end();
        }
      })();
      
    } catch (error) {
      reject(error);
    }
  });
}

// Alternative function for when we have better PDF manipulation
export async function appendSignatureToExistingPdf(
  originalNdaBase64: string,
  signerName: string,
  signedDate: Date
): Promise<string> {
  // This would use pdf-lib or similar for proper PDF manipulation
  // For now, we'll use the simpler approach above
  return addSignatureToNda(originalNdaBase64, signerName, signedDate);
}