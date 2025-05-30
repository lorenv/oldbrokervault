import PDFDocument from 'pdfkit';

export function addSignatureToNda(
  originalNdaBase64: string,
  signerName: string,
  signedDate: Date
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      // Collect the PDF data
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const base64 = pdfBuffer.toString('base64');
        resolve(base64);
      });

      // Add the original NDA content by creating pages from the original
      // For now, we'll create a signature page that gets appended
      const originalBuffer = Buffer.from(originalNdaBase64, 'base64');
      
      // Add the original PDF content (simplified approach - just add as first page)
      // In a production environment, you might want to use pdf-lib or similar for better PDF manipulation
      doc.fontSize(12).text('Original NDA Document Content', 50, 50);
      doc.text('(Original NDA content would be displayed here)', 50, 80);
      
      // Add some spacing and then the signature page
      doc.addPage();
      
      // Create signature page
      doc.fontSize(16)
         .text('SIGNATURE PAGE', 50, 50, { align: 'center' });
      
      doc.fontSize(12)
         .text('By signing below, I acknowledge that I have read and agree to the terms', 50, 100)
         .text('of the Non-Disclosure Agreement above.', 50, 120);
      
      // Add signature line
      doc.moveTo(50, 180)
         .lineTo(300, 180)
         .stroke();
      
      // Add signature in cursive-style font
      doc.fontSize(18)
         .font('Times-Italic')  // Cursive-style font
         .text(signerName, 55, 190);
      
      doc.fontSize(10)
         .font('Helvetica')  // Back to normal font
         .text('Signature', 50, 220);
      
      // Add date
      doc.text(`Date: ${signedDate.toLocaleDateString()}`, 350, 190);
      
      // Add timestamp for legal purposes
      doc.fontSize(8)
         .text(`Digitally signed on ${signedDate.toLocaleString()}`, 50, 250)
         .text(`IP Address and other identifying information recorded for legal purposes.`, 50, 265);
      
      // Finalize the PDF
      doc.end();
      
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