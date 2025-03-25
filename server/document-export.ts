import { CimDocument } from "@shared/schema";
import { storage } from "./storage";
import { google } from "googleapis";
import * as docx from "docx";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

export { createGoogleDoc, getGoogleAuthUrl, handleGoogleCallback } from './google-auth';

export async function generateWordDocument(analysis: any): Promise<Buffer> {
  // Create paragraphs for the document
  const paragraphs: docx.Paragraph[] = [
    new docx.Paragraph({
      text: "CONFIDENTIAL INFORMATION MEMORANDUM",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { after: 400 }
    }),
    
    // BUSINESS OVERVIEW SECTION
    new docx.Paragraph({
      text: "BUSINESS OVERVIEW",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }),
    
    // Business details in regular paragraphs
    new docx.Paragraph({
      text: `Founded: ${analysis.story?.yearStarted || 'N/A'}`,
      spacing: { before: 200 }
    }),
    new docx.Paragraph({
      text: `Structure: ${analysis.story?.businessStructure || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    // Business summary
    new docx.Paragraph({
      text: "Business Description",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),
    new docx.Paragraph({
      text: analysis.story?.businessSummary || analysis.story?.businessModel || 'No business description provided.',
      spacing: { before: 100, after: 200 }
    }),
    
    // INVESTMENT HIGHLIGHTS
    new docx.Paragraph({
      text: "INVESTMENT HIGHLIGHTS",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }),
    
    // Key Attractions
    new docx.Paragraph({
      text: "Key Attractions",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    })
  ];
  
  // Add bullet points for key attractions
  if (analysis.executiveSummary?.buyerAttractions?.length) {
    analysis.executiveSummary.buyerAttractions.forEach((item: string) => {
      paragraphs.push(
        new docx.Paragraph({
          text: item,
          bullet: {
            level: 0
          },
          spacing: { before: 100 }
        })
      );
    });
  }
  
  // Growth Opportunities
  paragraphs.push(
    new docx.Paragraph({
      text: "Growth Opportunities",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    })
  );
  
  // Add bullet points for growth opportunities
  if (analysis.executiveSummary?.growthOpportunities?.length) {
    analysis.executiveSummary.growthOpportunities.forEach((item: string) => {
      paragraphs.push(
        new docx.Paragraph({
          text: item,
          bullet: {
            level: 0
          },
          spacing: { before: 100 }
        })
      );
    });
  }
  
  // MARKET POSITION
  paragraphs.push(
    new docx.Paragraph({
      text: "MARKET POSITION",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }),
    
    new docx.Paragraph({
      text: "Target Market",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),
    
    new docx.Paragraph({
      text: analysis.marketAnalysis?.customerProfile || 'No target market information provided.',
      spacing: { before: 100, after: 200 }
    }),
    
    new docx.Paragraph({
      text: "Competitive Landscape",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),
    
    new docx.Paragraph({
      text: "Competitors",
      heading: docx.HeadingLevel.HEADING_3,
      spacing: { before: 100, after: 100 }
    })
  );
  
  // Add bullet points for competitors
  if (analysis.marketAnalysis?.competitors?.length) {
    analysis.marketAnalysis.competitors.forEach((item: string) => {
      paragraphs.push(
        new docx.Paragraph({
          text: item,
          bullet: {
            level: 0
          },
          spacing: { before: 50 }
        })
      );
    });
  }
  
  // Business Strengths
  paragraphs.push(
    new docx.Paragraph({
      text: "Business Strengths",
      heading: docx.HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 }
    })
  );
  
  // Add bullet points for strengths
  if (analysis.marketAnalysis?.strengths?.length) {
    analysis.marketAnalysis.strengths.forEach((item: string) => {
      paragraphs.push(
        new docx.Paragraph({
          text: item,
          bullet: {
            level: 0
          },
          spacing: { before: 50 }
        })
      );
    });
  }
  
  // OPERATIONS
  paragraphs.push(
    new docx.Paragraph({
      text: "OPERATIONS",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }),
    
    new docx.Paragraph({
      text: "Customer Relationships",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),
    
    new docx.Paragraph({
      text: `Recurring Revenue: ${analysis.operations?.customers?.recurring || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Customer Base: ${analysis.operations?.customers?.relationships || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Revenue Concentration: ${analysis.operations?.customers?.concentration || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Contract Terms: ${analysis.operations?.customers?.contracts || 'N/A'}`,
      spacing: { before: 100, after: 200 }
    }),
    
    new docx.Paragraph({
      text: "Supply Chain",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),
    
    new docx.Paragraph({
      text: `Number of Suppliers: ${analysis.operations?.suppliers?.count || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Supplier Terms: ${analysis.operations?.suppliers?.terms || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Concentration: ${analysis.operations?.suppliers?.concentration || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Transferability: ${analysis.operations?.suppliers?.transferability || 'N/A'}`,
      spacing: { before: 100, after: 200 }
    }),
    
    // TEAM STRUCTURE
    new docx.Paragraph({
      text: "TEAM STRUCTURE",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }),
    
    new docx.Paragraph({
      text: `Owner Responsibilities: ${analysis.team?.ownerResponsibilities || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Required Hours: ${analysis.team?.ownerHours || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Management Structure: ${analysis.team?.management || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Team Size: ${analysis.team?.employeeCount || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Turnover Rate: ${analysis.team?.turnover || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Retention: ${analysis.team?.retention || 'N/A'}`,
      spacing: { before: 100, after: 200 }
    }),
    
    // FACILITIES
    new docx.Paragraph({
      text: "FACILITIES",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }),
    
    new docx.Paragraph({
      text: `Ownership Status: ${analysis.facility?.ownership || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Size: ${analysis.facility?.size || 'N/A'}`,
      spacing: { before: 100 }
    }),
    
    new docx.Paragraph({
      text: `Monthly Cost: ${analysis.facility?.cost || 'N/A'}`,
      spacing: { before: 100 }
    })
  );
  
  // Add lease details if available
  if (analysis.facility?.leaseDetails) {
    paragraphs.push(
      new docx.Paragraph({
        text: `Lease Details: ${analysis.facility.leaseDetails}`,
        spacing: { before: 100 }
      })
    );
  }
  
  // Create the document with all paragraphs
  const doc = new docx.Document({
    sections: [{
      properties: {},
      children: paragraphs
    }]
  });

  return await docx.Packer.toBuffer(doc);
}

export async function generatePDF(analysis: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margins: {
        top: 50,
        bottom: 50,
        left: 72,
        right: 72
      }
    });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
    doc.on('error', reject);

    // Title Page
    doc.fontSize(24)
      .text('CONFIDENTIAL INFORMATION MEMORANDUM', {
        align: 'center'
      });
    
    doc.moveDown(2);
    doc.fontSize(16)
      .text(`${analysis.story?.businessSummary || 'Business Information Memorandum'}`, {
        align: 'center'
      });
    
    doc.moveDown(4);
    // Add a separator line
    doc.moveTo(72, doc.y)
      .lineTo(doc.page.width - 72, doc.y)
      .stroke();
    
    doc.moveDown(4);
    doc.fontSize(10)
      .text('CONFIDENTIAL', {
        align: 'center',
        oblique: true
      })
      .moveDown(0.5)
      .text('This document contains confidential information. It is provided to you for informational purposes only.', {
        align: 'center'
      });

    // Start a new page for the content
    doc.addPage();

    // BUSINESS OVERVIEW SECTION
    doc.fontSize(18).text('BUSINESS OVERVIEW', { 
      underline: true 
    });
    doc.moveDown();
    
    doc.fontSize(12);
    doc.text(`Founded: ${analysis.story?.yearStarted || 'N/A'}`);
    doc.text(`Structure: ${analysis.story?.businessStructure || 'N/A'}`);
    doc.moveDown();
    
    doc.fontSize(14).text('Business Description', { 
      underline: true 
    });
    doc.moveDown(0.5);
    doc.fontSize(12).text(analysis.story?.businessSummary || analysis.story?.businessModel || 'No business description provided.');
    doc.moveDown(2);

    // INVESTMENT HIGHLIGHTS SECTION
    doc.fontSize(18).text('INVESTMENT HIGHLIGHTS', { 
      underline: true 
    });
    doc.moveDown();
    
    doc.fontSize(14).text('Key Attractions');
    doc.moveDown(0.5);
    
    // Add bullet points for key attractions
    if (analysis.executiveSummary?.buyerAttractions?.length) {
      analysis.executiveSummary.buyerAttractions.forEach((item: string) => {
        doc.fontSize(12).text(`• ${item}`);
      });
    }
    doc.moveDown();
    
    doc.fontSize(14).text('Growth Opportunities');
    doc.moveDown(0.5);
    
    // Add bullet points for growth opportunities
    if (analysis.executiveSummary?.growthOpportunities?.length) {
      analysis.executiveSummary.growthOpportunities.forEach((item: string) => {
        doc.fontSize(12).text(`• ${item}`);
      });
    }
    doc.moveDown(2);

    // MARKET POSITION SECTION
    doc.fontSize(18).text('MARKET POSITION', { 
      underline: true 
    });
    doc.moveDown();
    
    doc.fontSize(14).text('Target Market');
    doc.moveDown(0.5);
    doc.fontSize(12).text(analysis.marketAnalysis?.customerProfile || 'No target market information provided.');
    doc.moveDown();
    
    doc.fontSize(14).text('Competitive Landscape');
    doc.moveDown(0.5);
    doc.fontSize(12).text('Competitors:');
    
    // Add bullet points for competitors
    if (analysis.marketAnalysis?.competitors?.length) {
      analysis.marketAnalysis.competitors.forEach((item: string) => {
        doc.text(`• ${item}`);
      });
    }
    doc.moveDown();
    
    doc.text('Business Strengths:');
    if (analysis.marketAnalysis?.strengths?.length) {
      analysis.marketAnalysis.strengths.forEach((item: string) => {
        doc.text(`• ${item}`);
      });
    }
    doc.moveDown(2);

    // OPERATIONS SECTION
    doc.fontSize(18).text('OPERATIONS', { 
      underline: true 
    });
    doc.moveDown();
    
    doc.fontSize(14).text('Customer Relationships');
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Recurring Revenue: ${analysis.operations?.customers?.recurring || 'N/A'}`);
    doc.text(`Customer Base: ${analysis.operations?.customers?.relationships || 'N/A'}`);
    doc.text(`Revenue Concentration: ${analysis.operations?.customers?.concentration || 'N/A'}`);
    doc.text(`Contract Terms: ${analysis.operations?.customers?.contracts || 'N/A'}`);
    doc.moveDown();
    
    doc.fontSize(14).text('Supply Chain');
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Number of Suppliers: ${analysis.operations?.suppliers?.count || 'N/A'}`);
    doc.text(`Supplier Terms: ${analysis.operations?.suppliers?.terms || 'N/A'}`);
    doc.text(`Concentration: ${analysis.operations?.suppliers?.concentration || 'N/A'}`);
    doc.text(`Transferability: ${analysis.operations?.suppliers?.transferability || 'N/A'}`);
    doc.moveDown(2);

    // Check if we need to add a new page to avoid overflow
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    // TEAM STRUCTURE SECTION
    doc.fontSize(18).text('TEAM STRUCTURE', { 
      underline: true 
    });
    doc.moveDown();
    
    doc.fontSize(12);
    doc.text(`Owner Responsibilities: ${analysis.team?.ownerResponsibilities || 'N/A'}`);
    doc.text(`Required Hours: ${analysis.team?.ownerHours || 'N/A'}`);
    doc.text(`Management Structure: ${analysis.team?.management || 'N/A'}`);
    doc.text(`Team Size: ${analysis.team?.employeeCount || 'N/A'}`);
    doc.text(`Turnover Rate: ${analysis.team?.turnover || 'N/A'}`);
    doc.text(`Retention: ${analysis.team?.retention || 'N/A'}`);
    doc.moveDown(2);

    // FACILITIES SECTION
    doc.fontSize(18).text('FACILITIES', { 
      underline: true 
    });
    doc.moveDown();
    
    doc.fontSize(12);
    doc.text(`Ownership Status: ${analysis.facility?.ownership || 'N/A'}`);
    doc.text(`Size: ${analysis.facility?.size || 'N/A'}`);
    doc.text(`Monthly Cost: ${analysis.facility?.cost || 'N/A'}`);
    if (analysis.facility?.leaseDetails) {
      doc.text(`Lease Details: ${analysis.facility.leaseDetails}`);
    }

    // Footer on each page
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      
      // Skip the title page footer
      if (i === 0) continue;
      
      // Add page number and footer text
      const footerY = doc.page.height - 50;
      doc.fontSize(8)
        .text(
          `Page ${i} of ${totalPages - 1} | CONFIDENTIAL`,
          72,
          footerY,
          { align: 'center' }
        );
    }

    doc.end();
  });
}

export async function exportToGoogleDocs(analysis: any, title: string): Promise<string> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
    throw new Error('Google Service Account credentials not found');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });

  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  // Format the content as a structured document for a CIM
  let formattedContent = `CONFIDENTIAL INFORMATION MEMORANDUM\n\n`;
  
  // Business Overview Section
  formattedContent += `BUSINESS OVERVIEW\n==================\n`;
  formattedContent += `Founded: ${analysis.story?.yearStarted || 'N/A'}\n`;
  formattedContent += `Structure: ${analysis.story?.businessStructure || 'N/A'}\n\n`;
  
  // Business Summary
  formattedContent += `${analysis.story?.businessSummary || analysis.story?.businessModel || 'N/A'}\n\n`;
  
  // Executive Summary Section
  formattedContent += `INVESTMENT HIGHLIGHTS\n===================\n`;
  formattedContent += `Key Attractions:\n`;
  if (analysis.executiveSummary?.buyerAttractions?.length) {
    analysis.executiveSummary.buyerAttractions.forEach((item: string) => {
      formattedContent += `• ${item}\n`;
    });
  }
  
  formattedContent += `\nGrowth Opportunities:\n`;
  if (analysis.executiveSummary?.growthOpportunities?.length) {
    analysis.executiveSummary.growthOpportunities.forEach((item: string) => {
      formattedContent += `• ${item}\n`;
    });
  }
  
  // Market Position
  formattedContent += `\nMARKET POSITION\n=============\n`;
  formattedContent += `Target Market: ${analysis.marketAnalysis?.customerProfile || 'N/A'}\n\n`;
  
  formattedContent += `Competitors:\n`;
  if (analysis.marketAnalysis?.competitors?.length) {
    analysis.marketAnalysis.competitors.forEach((item: string) => {
      formattedContent += `• ${item}\n`;
    });
  }
  
  formattedContent += `\nBusiness Strengths:\n`;
  if (analysis.marketAnalysis?.strengths?.length) {
    analysis.marketAnalysis.strengths.forEach((item: string) => {
      formattedContent += `• ${item}\n`;
    });
  }
  
  // Operations Section
  formattedContent += `\nOPERATIONS\n=========\n`;
  formattedContent += `Customer Relationships:\n`;
  formattedContent += `• Recurring Revenue: ${analysis.operations?.customers?.recurring || 'N/A'}\n`;
  formattedContent += `• Customer Base: ${analysis.operations?.customers?.relationships || 'N/A'}\n`;
  formattedContent += `• Revenue Concentration: ${analysis.operations?.customers?.concentration || 'N/A'}\n`;
  formattedContent += `• Contract Terms: ${analysis.operations?.customers?.contracts || 'N/A'}\n\n`;
  
  formattedContent += `Supply Chain:\n`;
  formattedContent += `• Number of Suppliers: ${analysis.operations?.suppliers?.count || 'N/A'}\n`;
  formattedContent += `• Supplier Terms: ${analysis.operations?.suppliers?.terms || 'N/A'}\n`;
  formattedContent += `• Concentration: ${analysis.operations?.suppliers?.concentration || 'N/A'}\n`;
  formattedContent += `• Transferability: ${analysis.operations?.suppliers?.transferability || 'N/A'}\n\n`;
  
  // Team Structure
  formattedContent += `TEAM STRUCTURE\n=============\n`;
  formattedContent += `• Owner Responsibilities: ${analysis.team?.ownerResponsibilities || 'N/A'}\n`;
  formattedContent += `• Required Hours: ${analysis.team?.ownerHours || 'N/A'}\n`;
  formattedContent += `• Management Structure: ${analysis.team?.management || 'N/A'}\n`;
  formattedContent += `• Team Size: ${analysis.team?.employeeCount || 'N/A'}\n`;
  formattedContent += `• Turnover Rate: ${analysis.team?.turnover || 'N/A'}\n`;
  formattedContent += `• Retention: ${analysis.team?.retention || 'N/A'}\n\n`;
  
  // Facilities
  formattedContent += `FACILITIES\n=========\n`;
  formattedContent += `• Ownership Status: ${analysis.facility?.ownership || 'N/A'}\n`;
  formattedContent += `• Size: ${analysis.facility?.size || 'N/A'}\n`;
  formattedContent += `• Monthly Cost: ${analysis.facility?.cost || 'N/A'}\n`;
  if (analysis.facility?.leaseDetails) {
    formattedContent += `• Lease Details: ${analysis.facility.leaseDetails}\n`;
  }

  // Create a new Google Doc
  const fileMetadata = {
    name: `CIM - ${title}`,
    mimeType: 'application/vnd.google-apps.document'
  };

  try {
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: 'text/plain',
        body: Readable.from([formattedContent])
      }
    });

    if (!file.data.id) {
      throw new Error('Failed to create Google Doc');
    }

    return `https://docs.google.com/document/d/${file.data.id}/edit`;
  } catch (error) {
    console.error('Error creating Google Doc with service account:', error);
    throw new Error('Failed to create Google Doc with service account');
  }
}
