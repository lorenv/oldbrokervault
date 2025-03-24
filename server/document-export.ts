import { CimDocument } from "@shared/schema";
import { storage } from "./storage";
import { google } from "googleapis";
import * as docx from "docx";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

export async function generateWordDocument(analysis: any): Promise<Buffer> {
  const doc = new docx.Document({
    sections: [{
      properties: {},
      children: [
        new docx.Paragraph({
          text: "CONFIDENTIAL INFORMATION MEMORANDUM",
          heading: docx.HeadingLevel.HEADING_1,
          spacing: { after: 400 }
        }),
        // Business Overview Section
        new docx.Paragraph({
          text: "BUSINESS OVERVIEW",
          heading: docx.HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }),
        new docx.Paragraph({
          text: `Founded: ${analysis.story.yearStarted}`,
          spacing: { before: 200 }
        }),
        new docx.Paragraph({
          text: `Structure: ${analysis.story.businessStructure}`,
          spacing: { before: 100 }
        }),
        new docx.Paragraph({
          text: analysis.story.businessSummary,
          spacing: { before: 200 }
        }),
        // Market Position Section
        new docx.Paragraph({
          text: "MARKET POSITION",
          heading: docx.HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }),
        new docx.Paragraph({
          text: analysis.marketAnalysis.customerProfile,
          spacing: { before: 200 }
        }),
        // Operations Section
        new docx.Paragraph({
          text: "OPERATIONS",
          heading: docx.HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }),
        new docx.Paragraph({
          text: `Customer Base: ${analysis.operations.customers.relationships}`,
          spacing: { before: 200 }
        }),
        new docx.Paragraph({
          text: `Revenue Concentration: ${analysis.operations.customers.concentration}`,
          spacing: { before: 100 }
        })
      ]
    }]
  });

  return await docx.Packer.toBuffer(doc);
}

export async function generatePDF(analysis: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    // Add content to PDF
    doc.fontSize(24).text('CONFIDENTIAL INFORMATION MEMORANDUM', { align: 'center' });
    doc.moveDown(2);

    // Business Overview
    doc.fontSize(20).text('BUSINESS OVERVIEW');
    doc.moveDown();
    doc.fontSize(12).text(`Founded: ${analysis.story.yearStarted}`);
    doc.text(`Structure: ${analysis.story.businessStructure}`);
    doc.moveDown();
    doc.text(analysis.story.businessSummary);
    doc.moveDown(2);

    // Market Position
    doc.fontSize(20).text('MARKET POSITION');
    doc.moveDown();
    doc.fontSize(12).text(analysis.marketAnalysis.customerProfile);
    doc.moveDown(2);

    // Operations
    doc.fontSize(20).text('OPERATIONS');
    doc.moveDown();
    doc.fontSize(12).text(`Customer Base: ${analysis.operations.customers.relationships}`);
    doc.text(`Revenue Concentration: ${analysis.operations.customers.concentration}`);

    doc.end();
  });
}

export async function exportToGoogleDocs(analysis: any, title: string): Promise<string> {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!),
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });

  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  // Create a new Google Doc
  const fileMetadata = {
    name: `CIM - ${title}`,
    mimeType: 'application/vnd.google-apps.document'
  };

  const content = `
CONFIDENTIAL INFORMATION MEMORANDUM

BUSINESS OVERVIEW
Founded: ${analysis.story.yearStarted}
Structure: ${analysis.story.businessStructure}

${analysis.story.businessSummary}

MARKET POSITION
${analysis.marketAnalysis.customerProfile}

OPERATIONS
Customer Base: ${analysis.operations.customers.relationships}
Revenue Concentration: ${analysis.operations.customers.concentration}
  `.trim();

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: 'text/plain',
      body: Readable.from([content])
    }
  });

  return `https://docs.google.com/document/d/${file.data.id}/edit`;
}
