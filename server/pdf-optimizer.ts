import PDFKit from 'pdfkit';

export async function generateOptimizedPDF(
  analysis: any, 
  logoUrl?: string | null, 
  websiteUrl?: string, 
  selectedImages?: string[], 
  userProfile?: any, 
  financialData?: any, 
  financialFiles?: any[], 
  baseUrl?: string, 
  documentTitle?: string, 
  customSections?: any[], 
  coverImageUrl?: string | null, 
  coverImagePosition?: string | null, 
  documentId?: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFKit({ 
        size: 'A4',
        margin: 50
      });
      
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Title page - minimal content for speed
      doc.fontSize(24)
         .text(documentTitle || 'Confidential Information Memorandum', { align: 'center' });
      
      doc.moveDown(2);
      doc.fontSize(12)
         .text('Private and Confidential', { align: 'center' });

      // Contact information
      if (userProfile) {
        doc.moveDown(3);
        doc.fontSize(14)
           .text('Contact Information', { underline: true });
        
        doc.moveDown(0.5);
        doc.fontSize(11);
        
        if (userProfile.name) {
          doc.text(`Name: ${userProfile.name}`);
        }
        if (userProfile.email) {
          doc.text(`Email: ${userProfile.email}`);
        }
        if (userProfile.phoneNumber) {
          doc.text(`Phone: ${userProfile.phoneNumber}`);
        }
      }

      // Business overview - simplified content
      if (analysis?.sections) {
        doc.addPage();
        doc.fontSize(18)
           .text('Business Overview', { underline: true });
        
        doc.moveDown(1);
        doc.fontSize(11);
        
        // Only process first 3 sections to keep PDF lean
        const sectionEntries = Object.entries(analysis.sections).slice(0, 3);
        
        sectionEntries.forEach(([sectionKey, sectionContent]: [string, any]) => {
          const title = sectionContent?.title || sectionKey.replace(/([A-Z])/g, ' $1').trim();
          
          doc.fontSize(14)
             .text(title, { underline: true });
          
          doc.moveDown(0.3);
          doc.fontSize(11);
          
          if (sectionContent?.content) {
            const content = typeof sectionContent.content === 'string' 
              ? sectionContent.content 
              : String(sectionContent.content);
            
            // Limit to 300 characters per section
            const shortContent = content.length > 300 
              ? content.substring(0, 300) + '...'
              : content;
            
            doc.text(shortContent);
          }
          
          doc.moveDown(1);
        });
      }

      // Financial summary - if enabled
      if (financialData?.enabled) {
        doc.addPage();
        doc.fontSize(18)
           .text('Financial Summary', { underline: true });
        
        doc.moveDown(1);
        doc.fontSize(11);
        
        if (financialData.askingPrice) {
          doc.text(`Asking Price: ${financialData.askingPrice}`);
        }
        if (financialData.revenue) {
          doc.text(`Revenue: ${financialData.revenue}`);
        }
        if (financialData.ebitda) {
          doc.text(`EBITDA: ${financialData.ebitda}`);
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}