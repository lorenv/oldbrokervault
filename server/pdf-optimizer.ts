import PDFKit from 'pdfkit';
import fs from 'fs';

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
        margin: 50,
        bufferPages: true
      });
      
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Simple header styling for professional appearance
      const addHeader = () => {
        doc.fontSize(10)
           .fillColor('#666666')
           .text('CONFIDENTIAL INFORMATION MEMORANDUM', 50, 30, { align: 'center' });
      };

      const addFooter = (pageNum: number) => {
        doc.fontSize(8)
           .fillColor('#666666')
           .text(`Page ${pageNum}`, 50, doc.page.height - 30, { align: 'center' });
      };

      // Title page
      doc.fontSize(24)
         .fillColor('#1e293b')
         .text(documentTitle || 'Confidential Information Memorandum', 50, 150, { align: 'center' });
      
      doc.fontSize(12)
         .fillColor('#6b7280')
         .text('Private and Confidential', 50, 200, { align: 'center' });

      // Add simple logo if provided
      if (logoUrl && logoUrl.startsWith('data:image/')) {
        try {
          const base64Data = logoUrl.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          doc.image(imageBuffer, 50, 250, { width: 100, align: 'center' });
        } catch (error) {
          console.log("Logo processing skipped due to error");
        }
      }

      // Contact information
      if (userProfile) {
        doc.fontSize(12)
           .fillColor('#374151')
           .text('Contact Information', 50, 400, { underline: true });
        
        if (userProfile.name) {
          doc.text(`Name: ${userProfile.name}`, 50, 430);
        }
        if (userProfile.email) {
          doc.text(`Email: ${userProfile.email}`, 50, 450);
        }
        if (userProfile.phoneNumber) {
          doc.text(`Phone: ${userProfile.phoneNumber}`, 50, 470);
        }
      }

      // New page for content
      doc.addPage();
      let pageNum = 2;
      addHeader();
      addFooter(pageNum);

      // Business content sections
      if (analysis?.sections) {
        let yPosition = 80;
        
        Object.entries(analysis.sections).forEach(([sectionKey, sectionContent]: [string, any]) => {
          if (yPosition > doc.page.height - 150) {
            doc.addPage();
            pageNum++;
            addHeader();
            addFooter(pageNum);
            yPosition = 80;
          }

          // Section title
          const title = sectionContent?.title || sectionKey.replace(/([A-Z])/g, ' $1').trim();
          doc.fontSize(16)
             .fillColor('#1e293b')
             .text(title, 50, yPosition);
          yPosition += 30;

          // Section content
          if (sectionContent?.content) {
            const content = typeof sectionContent.content === 'string' 
              ? sectionContent.content 
              : JSON.stringify(sectionContent.content);
            
            // Limit content length to prevent massive PDFs
            const truncatedContent = content.length > 500 
              ? content.substring(0, 500) + '...'
              : content;

            doc.fontSize(11)
               .fillColor('#374151')
               .text(truncatedContent, 50, yPosition, { width: doc.page.width - 100 });
            
            yPosition += Math.min(truncatedContent.split('\n').length * 15, 150);
          }
          
          yPosition += 20;
        });
      }

      // Financial information if enabled
      if (financialData && Object.keys(financialData).length > 0) {
        let yPos = 80;
        if (yPos > doc.page.height - 200) {
          doc.addPage();
          pageNum++;
          addHeader();
          addFooter(pageNum);
          yPos = 80;
        }

        doc.fontSize(16)
           .fillColor('#1e293b')
           .text('Financial Information', 50, yPos);
        yPos += 30;

        Object.entries(financialData).forEach(([key, value]) => {
          if (value && yPos < doc.page.height - 100) {
            doc.fontSize(11)
               .fillColor('#374151')
               .text(`${key}: ${value}`, 50, yPos);
            yPos += 20;
          }
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}