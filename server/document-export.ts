import { CimDocument } from "@shared/schema";
import { storage } from "./storage";
import { google } from "googleapis";
import * as docx from "docx";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

export { createGoogleDoc, getGoogleAuthUrl, handleGoogleCallback } from './google-auth';

// Simple helper functions to read image dimensions from file headers
function getJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    // JPEG files start with FF D8
    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;
    
    let offset = 2;
    while (offset < buffer.length) {
      // Look for SOF markers (Start of Frame)
      if (buffer[offset] === 0xFF && (buffer[offset + 1] === 0xC0 || buffer[offset + 1] === 0xC2)) {
        // SOF found, dimensions are at offset + 5 (height) and offset + 7 (width)
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      
      // Skip to next marker
      if (buffer[offset] === 0xFF) {
        const segmentLength = buffer.readUInt16BE(offset + 2);
        offset += segmentLength + 2;
      } else {
        offset++;
      }
    }
  } catch (e) {
    // Return null if parsing fails
  }
  return null;
}

function getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    // PNG files start with specific signature
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < pngSignature.length; i++) {
      if (buffer[i] !== pngSignature[i]) return null;
    }
    
    // Width and height are at bytes 16-23 (after signature + IHDR chunk header)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  } catch (e) {
    // Return null if parsing fails
  }
  return null;
}

/**
 * Generates HTML with inline styling for the CIM data
 * This function creates a formatted HTML representation suitable for copying to clipboard
 * and pasting into other applications while preserving formatting
 */
// Helper function to safely convert any value to string
function safeStringify(value: any): string {
  // Handle null or undefined
  if (value === undefined || value === null) {
    return '[NOT ANSWERED]';
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[NOT ANSWERED]';
    }
    return value.map(item => safeStringify(item)).join(', ');
  }
  
  // Handle objects
  if (typeof value === 'object') {
    // Empty object
    if (Object.keys(value).length === 0) {
      return '[NOT ANSWERED]';
    }
    
    try {
      // Try to extract meaningful content from the object
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return '[NOT ANSWERED]';
      }
      
      return entries
        .map(([key, val]) => `${key}: ${safeStringify(val)}`)
        .join(', ');
    } catch (error) {
      // Fallback if something goes wrong
      return '[NOT ANSWERED]';
    }
  }
  
  // Handle empty strings
  if (typeof value === 'string' && value.trim() === '') {
    return '[NOT ANSWERED]';
  }
  
  // Default for any other type
  const stringValue = String(value);
  
  // Check for common placeholder values
  if (stringValue === 'N/A' || 
      stringValue === 'undefined' || 
      stringValue === 'null' ||
      stringValue === 'Information not provided') {
    return '[NOT ANSWERED]';
  }
  
  return stringValue;
}

export function generateHtml(analysis: any, logoUrl?: string | null, userProfile?: any): string {
  // Start building the HTML snippet (without doctype and head tags)
  let html = `
<div style="font-family: 'Arial', sans-serif; color: #333; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 20px;">
  ${logoUrl ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${logoUrl}" alt="Business Logo" style="max-width: 200px; max-height: 100px;"></div>` : ''}
  <div style="font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 24px; color: #1a1a1a; border-bottom: 3px solid #4b5563; padding-bottom: 12px;">CONFIDENTIAL INFORMATION MEMORANDUM</div>
`;

  // Business Overview Section with Q&A style
  html += `
    <div style="margin-bottom: 30px; padding-bottom: 20px;">
      <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Business Overview</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">When was the business founded?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.story?.yearStarted)}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the business structure?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.story?.businessStructure)}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the business model?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.story?.businessModel)}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What process do customers follow to place orders?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.story?.orderProcess)}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How has the business grown over time?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.story?.growthHistory)}</td>
        </tr>
      </table>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Business Summary</h3>
      <div style="padding: 15px; background-color: #f9fafb; border-left: 4px solid #6366f1; margin-bottom: 20px;">
        <p style="color: #1f2937; margin: 0; line-height: 1.6;">${analysis.story?.businessSummary || 'No detailed business summary provided.'}</p>
      </div>
      
      ${analysis.story?.saleReason ? `
        <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Reason For Sale</h3>
        <div style="padding: 15px; background-color: #f9fafb; border-left: 4px solid #6366f1; margin-bottom: 20px;">
          <p style="color: #1f2937; margin: 0; line-height: 1.6;">${analysis.story.saleReason}</p>
        </div>
      ` : ''}
      
      <!-- Business Website Section -->
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Business Website</h3>
      <div style="padding: 15px; background-color: #f9fafb; border-left: 4px solid #6366f1; margin-bottom: 20px;">
        <p style="color: #1f2937; margin: 0; line-height: 1.6;">
          <a href="${analysis.websiteUrl || '#'}" target="_blank" style="color: #6366f1; text-decoration: none;">${analysis.websiteUrl || 'Website information not available'}</a>
        </p>
      </div>
      
      ${analysis.selectedImages && analysis.selectedImages.length > 0 ? `
        <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Business Images</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
          ${analysis.selectedImages.map((imagePath: string, index: number) => `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: #fff;">
              <img src="${imagePath}" alt="Business image ${index + 1}" style="width: 100%; height: 150px; object-fit: cover; display: block;" />
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
`;

  // Investment Highlights Section
  html += `
    <div style="margin-bottom: 30px; padding-bottom: 20px;">
      <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Investment Highlights</h2>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px;">What makes this business attractive to buyers?</h3>
`;

  if (analysis.executiveSummary?.buyerAttractions?.length || analysis.story?.keyAttractions?.length) {
    const attractions = analysis.executiveSummary?.buyerAttractions || analysis.story?.keyAttractions || [];
    html += `
      <ul style="padding-left: 20px; margin-bottom: 20px; list-style-type: disc;">
    `;
    attractions.forEach((item: string) => {
      html += `<li style="margin-bottom: 8px; color: #1f2937; padding: 4px 0;">${item}</li>\n`;
    });
    html += `</ul>`;
  } else {
    html += `<p style="color: #6b7280; font-style: italic; padding: 10px;">Information not provided.</p>`;
  }

  html += `
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">What growth opportunities exist for new ownership?</h3>
`;

  if (analysis.executiveSummary?.growthOpportunities?.length) {
    html += `
      <ul style="padding-left: 20px; margin-bottom: 20px; list-style-type: disc;">
    `;
    analysis.executiveSummary.growthOpportunities.forEach((item: string) => {
      html += `<li style="margin-bottom: 8px; color: #1f2937; padding: 4px 0;">${item}</li>\n`;
    });
    html += `</ul>`;
  } else {
    html += `<p style="color: #6b7280; font-style: italic; padding: 10px;">Information not provided.</p>`;
  }

  html += `</div>`;

  // Market Analysis Section
  html += `
    <div style="margin-bottom: 30px; padding-bottom: 20px;">
      <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Market Analysis</h2>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px;">Who is the target customer?</h3>
      <div style="padding: 15px; background-color: #f9fafb; border-left: 4px solid #6366f1; margin-bottom: 20px;">
        <p style="color: #1f2937; margin: 0; line-height: 1.6;">${analysis.marketAnalysis?.customerProfile || 'No customer profile information provided.'}</p>
      </div>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px;">What makes this business unique in the market?</h3>
`;

  if (analysis.marketAnalysis?.uniqueFeatures?.length) {
    html += `
      <ul style="padding-left: 20px; margin-bottom: 20px; list-style-type: disc;">
    `;
    analysis.marketAnalysis.uniqueFeatures.forEach((item: string) => {
      html += `<li style="margin-bottom: 8px; color: #1f2937; padding: 4px 0;">${item}</li>\n`;
    });
    html += `</ul>`;
  } else {
    html += `<p style="color: #6b7280; font-style: italic; padding: 10px;">Information not provided.</p>`;
  }

  html += `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; color: #374151; width: 50%;">Who are the key competitors?</th>
          <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; color: #374151; width: 50%;">What are the business strengths?</th>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; vertical-align: top;">
`;

  if (analysis.marketAnalysis?.competitors?.length) {
    html += `<ul style="padding-left: 20px; margin: 0; list-style-type: disc;">`;
    analysis.marketAnalysis.competitors.forEach((item: string) => {
      html += `<li style="margin-bottom: 8px; color: #1f2937;">${item}</li>\n`;
    });
    html += `</ul>`;
  } else {
    html += `<p style="color: #6b7280; font-style: italic;">Information not provided.</p>`;
  }

  html += `
          </td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; vertical-align: top;">
`;

  if (analysis.marketAnalysis?.strengths?.length) {
    html += `<ul style="padding-left: 20px; margin: 0; list-style-type: disc;">`;
    analysis.marketAnalysis.strengths.forEach((item: string) => {
      html += `<li style="margin-bottom: 8px; color: #1f2937;">${item}</li>\n`;
    });
    html += `</ul>`;
  } else {
    html += `<p style="color: #6b7280; font-style: italic;">Information not provided.</p>`;
  }

  html += `
          </td>
        </tr>
      </table>
    </div>
`;

  // Sales Section
  if (analysis.sales) {
    html += `
      <div style="margin-bottom: 30px; padding-bottom: 20px;">
        <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Sales & Revenue</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">What is the average order value?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.sales?.averageOrderValue)}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How does pricing compare to competitors?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.sales?.competitivePricing)}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What pricing model is used?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.sales?.pricingModel)}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Is there seasonality in sales?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.sales?.seasonality)}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What are the contract terms with customers?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.sales?.contractTerms)}</td>
          </tr>
        </table>
    `;

    // Sales Channels
    if (analysis.sales.channels && typeof analysis.sales.channels === 'object') {
      html += `
        <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">What sales channels are used?</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Channel</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Percentage</th>
          </tr>
      `;

      Object.entries(analysis.sales.channels).forEach(([channel, percentage]: [string, any]) => {
        html += `
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb;">${channel}</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${percentage}%</td>
          </tr>
        `;
      });

      html += `</table>`;
    }

    // Payment Methods
    if (analysis.sales.paymentMethods?.length) {
      html += `
        <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">What payment methods are accepted?</h3>
        <ul style="padding-left: 20px; margin-bottom: 20px; list-style-type: disc;">
      `;
      analysis.sales.paymentMethods.forEach((method: string) => {
        html += `<li style="margin-bottom: 6px; color: #1f2937;">${method}</li>\n`;
      });
      html += `</ul>`;
    }

    html += `</div>`;
  }

  // Operations Section
  html += `
    <div style="margin-bottom: 30px; padding-bottom: 20px;">
      <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Business Operations</h2>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px;">Customer Relationships</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">How much revenue is recurring?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.operations?.customers?.recurring)}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How would you describe your customer relationships?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.operations?.customers?.relationships)}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Is revenue concentrated among certain customers?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.operations?.customers?.concentration)}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What are the typical contract terms?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.operations?.customers?.contracts)}</td>
        </tr>
      </table>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Supply Chain</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">How many suppliers does the business work with?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.operations?.suppliers?.count)}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What are the supplier payment terms?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.operations?.suppliers?.terms)}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Is there concentration among certain suppliers?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.operations?.suppliers?.concentration)}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How easily can supplier relationships be transferred?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.operations?.suppliers?.transferability)}</td>
        </tr>
      </table>
    </div>
`;

  // Inventory & Assets Section
  if (analysis.inventory || analysis.assets) {
    html += `
      <div style="margin-bottom: 30px; padding-bottom: 20px;">
        <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Inventory & Assets</h2>
    `;

    if (analysis.assets) {
      html += `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">What is the approximate value of equipment?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.assets?.equipmentValue)}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Where is the business located?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.assets?.location)}</td>
          </tr>
        </table>
      `;

      if (analysis.assets.equipmentDetails) {
        html += `
          <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px;">What equipment is included in the sale?</h3>
          <div style="padding: 15px; background-color: #f9fafb; border-left: 4px solid #6366f1; margin-bottom: 20px;">
            <p style="color: #1f2937; margin: 0; line-height: 1.6;">${analysis.assets.equipmentDetails}</p>
          </div>
        `;
      }

      if (analysis.assets.inventoryDetails) {
        html += `
          <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">What inventory is included in the sale?</h3>
          <div style="padding: 15px; background-color: #f9fafb; border-left: 4px solid #6366f1; margin-bottom: 20px;">
            <p style="color: #1f2937; margin: 0; line-height: 1.6;">${analysis.assets.inventoryDetails}</p>
          </div>
        `;
      }

      if (analysis.assets.digitalAssets?.length) {
        html += `
          <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">What digital assets are included?</h3>
          <ul style="padding-left: 20px; margin-bottom: 20px; list-style-type: disc;">
        `;
        analysis.assets.digitalAssets.forEach((asset: string) => {
          html += `<li style="margin-bottom: 6px; color: #1f2937;">${asset}</li>\n`;
        });
        html += `</ul>`;
      }
    }

    if (analysis.inventory) {
      html += `
        <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Inventory Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">What is the typical lead time for inventory?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.inventory.leadTime)}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Where is inventory sourced from?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.inventory.sourcing)}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How and where is inventory stored?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.inventory.storage)}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the approximate value of inventory?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.inventory.value)}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How many SKUs does the business maintain?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.inventory.skuCount)}</td>
          </tr>
        </table>
      `;

      if (analysis.inventory.topProducts?.length) {
        html += `
          <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">What are the top-selling products?</h3>
          <ul style="padding-left: 20px; margin-bottom: 20px; list-style-type: disc;">
        `;
        analysis.inventory.topProducts.forEach((product: string) => {
          html += `<li style="margin-bottom: 6px; color: #1f2937;">${product}</li>\n`;
        });
        html += `</ul>`;
      }
    }

    html += `</div>`;
  }

  // Team Structure Section
  html += `
    <div style="margin-bottom: 30px; padding-bottom: 20px;">
      <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Team Structure</h2>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px;">Ownership & Management</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">Owner's Role:</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.team?.ownerResponsibilities)}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Required Hours:</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.team?.ownerHours)}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Management Structure:</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.team?.management)}</td>
        </tr>
      </table>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Employee Overview</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">Total Employees:</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.team?.employeeCount)}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Contractors:</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.team?.contractorCount)}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Turnover Rate:</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${safeStringify(analysis.team?.turnover)}</td>
        </tr>
      </table>
`;

  if (analysis.team?.employeeSummary) {
    html += `
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Employee Overview</h3>
      <div style="padding: 15px; background-color: #f9fafb; border-left: 4px solid #6366f1; margin-bottom: 20px;">
        <p style="color: #1f2937; margin: 0; line-height: 1.6;">${analysis.team.employeeSummary}</p>
      </div>
    `;
  }

  // Key Team Members
  if (analysis.team?.keyEmployees?.length > 0) {
    html += `
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Key Team Members</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600; color: #374151;">Role/Position</th>
        </tr>
    `;
    
    // Format each key employee
    analysis.team.keyEmployees.forEach((employee: any, index: number) => {
      html += `
        <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">
      `;
      
      if (typeof employee === 'string') {
        html += employee;
      } else if (typeof employee === 'object') {
        // Extract relevant properties from employee object
        const parts = [];
        if (employee.role) parts.push(`<strong>Role:</strong> ${employee.role}`);
        if (employee.name) parts.push(`<strong>Name:</strong> ${employee.name}`);
        if (employee.tenure) parts.push(`<strong>Tenure:</strong> ${employee.tenure}`);
        if (employee.background) parts.push(`<strong>Background:</strong> ${employee.background}`);
        
        // If no properties were found, provide a fallback format
        if (parts.length === 0) {
          html += Object.entries(employee)
            .map(([key, val]) => `<strong>${key}:</strong> ${val}`)
            .join('<br>');
        } else {
          html += parts.join('<br>');
        }
      } else {
        html += String(employee);
      }
      
      html += `
          </td>
        </tr>
      `;
    });
    
    html += `</table>`;
  }

  html += `</div>`;

  // Facilities Section
  html += `
    <div style="margin-bottom: 30px; padding-bottom: 20px;">
      <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Facilities</h2>
      
      <div class="facility-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div style="padding: 15px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; font-weight: 600; color: #4b5563;">Ownership Status</h3>
          <p style="margin: 0; color: #1f2937;">${safeStringify(analysis.facility?.ownership)}</p>
        </div>
        
        <div style="padding: 15px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; font-weight: 600; color: #4b5563;">Size</h3>
          <p style="margin: 0; color: #1f2937;">${safeStringify(analysis.facility?.size)}</p>
        </div>
        
        <div style="padding: 15px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; font-weight: 600; color: #4b5563;">Monthly Cost</h3>
          <p style="margin: 0; color: #1f2937;">${safeStringify(analysis.facility?.cost)}</p>
        </div>
        
        <div style="padding: 15px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; font-weight: 600; color: #4b5563;">Lease Details</h3>
          <p style="margin: 0; color: #1f2937;">${safeStringify(analysis.facility?.leaseDetails)}</p>
        </div>
      </div>
    </div>
  </div>
`;

  // Add contact footer if user profile is provided
  if (userProfile) {
    html += `
    <div style="margin-top: 50px; padding-top: 30px; border-top: 2px solid #e5e7eb; text-align: center;">
      ${userProfile.profilePhoto ? `<div style="margin-bottom: 20px;"><img src="${userProfile.profilePhoto}" alt="Profile Photo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;"></div>` : ''}
      ${userProfile.name ? `<h3 style="margin: 10px 0; font-size: 18px; font-weight: 600; color: #1f2937;">${userProfile.name}</h3>` : ''}
      ${userProfile.title ? `<p style="margin: 5px 0; font-size: 14px; color: #6b7280;">${userProfile.title}</p>` : ''}
      ${userProfile.phoneNumber ? `<p style="margin: 5px 0; font-size: 14px; color: #1f2937;">Phone: ${userProfile.phoneNumber}</p>` : ''}
      ${userProfile.email ? `<p style="margin: 5px 0; font-size: 14px; color: #1f2937;">Email: ${userProfile.email}</p>` : ''}
      ${userProfile.businessName ? `<p style="margin: 15px 0 10px 0; font-size: 16px; font-weight: 600; color: #1f2937;">${userProfile.businessName}</p>` : ''}
      ${userProfile.businessLogo ? `<div style="margin-top: 15px;"><img src="${userProfile.businessLogo}" alt="Business Logo" style="max-width: 150px; max-height: 60px; object-fit: contain;"></div>` : ''}
    </div>`;
  }

  return html;
}

/**
 * Formats CIM analysis data as plain text
 * This function creates a formatted text representation of the CIM data
 * suitable for storing in a custom field or text dump
 */
export function formatTextContent(analysis: any, userProfile?: any): string {
  const sections: string[] = [];

  // Business Story
  if (analysis.story) {
    sections.push('# BUSINESS OVERVIEW');
    
    if (analysis.story.businessSummary) {
      sections.push(analysis.story.businessSummary);
    }
    
    sections.push('## Business History');
    const storyDetails = [
      analysis.story.yearStarted ? `Year Started: ${analysis.story.yearStarted}` : `Year Started: [NOT ANSWERED]`,
      analysis.story.businessIdea ? `Business Idea: ${analysis.story.businessIdea}` : `Business Idea: [NOT ANSWERED]`,
      analysis.story.businessModel ? `Business Model: ${analysis.story.businessModel}` : `Business Model: [NOT ANSWERED]`,
      analysis.story.orderProcess ? `Order Process: ${analysis.story.orderProcess}` : `Order Process: [NOT ANSWERED]`,
      analysis.story.growthHistory ? `Growth History: ${analysis.story.growthHistory}` : `Growth History: [NOT ANSWERED]`,
      analysis.story.businessStructure ? `Business Structure: ${analysis.story.businessStructure}` : `Business Structure: [NOT ANSWERED]`
    ].join('\n\n');
    sections.push(storyDetails);
    
    if (analysis.story.keyAttractions && analysis.story.keyAttractions.length) {
      sections.push('## Key Business Attractions');
      sections.push(analysis.story.keyAttractions.map((item: string) => `- ${item}`).join('\n'));
    }
    
    if (analysis.story.saleReason) {
      sections.push('## Reason For Sale');
      sections.push(analysis.story.saleReason);
    }
  }

  // Executive Summary
  if (analysis.executiveSummary) {
    sections.push('# EXECUTIVE SUMMARY');
    
    if (analysis.executiveSummary.buyerAttractions && analysis.executiveSummary.buyerAttractions.length) {
      sections.push('## Buyer Attractions');
      sections.push(analysis.executiveSummary.buyerAttractions.map((item: string) => `- ${item}`).join('\n'));
    }
    
    if (analysis.executiveSummary.growthOpportunities && analysis.executiveSummary.growthOpportunities.length) {
      sections.push('## Growth Opportunities');
      sections.push(analysis.executiveSummary.growthOpportunities.map((item: string) => `- ${item}`).join('\n'));
    }
  }

  // Assets
  if (analysis.assets) {
    sections.push('# ASSETS');
    
    const assetDetails = [
      analysis.assets.location ? `Location: ${analysis.assets.location}` : `Location: [NOT ANSWERED]`,
      analysis.assets.equipmentValue ? `Equipment Value: ${analysis.assets.equipmentValue}` : `Equipment Value: [NOT ANSWERED]`,
      analysis.assets.equipmentDetails ? `Equipment Details: ${analysis.assets.equipmentDetails}` : `Equipment Details: [NOT ANSWERED]`,
      analysis.assets.inventoryDetails ? `Inventory Details: ${analysis.assets.inventoryDetails}` : `Inventory Details: [NOT ANSWERED]`
    ].join('\n\n');
    sections.push(assetDetails);
    
    if (analysis.assets.digitalAssets && analysis.assets.digitalAssets.length) {
      sections.push('## Digital Assets');
      sections.push(analysis.assets.digitalAssets.map((item: string) => `- ${item}`).join('\n'));
    }
  }

  // Market Analysis
  if (analysis.marketAnalysis) {
    sections.push('# MARKET ANALYSIS');
    
    if (analysis.marketAnalysis.uniqueFeatures && analysis.marketAnalysis.uniqueFeatures.length) {
      sections.push('## Unique Features');
      sections.push(analysis.marketAnalysis.uniqueFeatures.map((item: string) => `- ${item}`).join('\n'));
    }
    
    if (analysis.marketAnalysis.customerProfile) {
      sections.push('## Customer Profile');
      sections.push(analysis.marketAnalysis.customerProfile);
    }
    
    if (analysis.marketAnalysis.competitors && analysis.marketAnalysis.competitors.length) {
      sections.push('## Competitors');
      sections.push(analysis.marketAnalysis.competitors.map((item: string) => `- ${item}`).join('\n'));
    }
    
    if (analysis.marketAnalysis.strengths && analysis.marketAnalysis.strengths.length) {
      sections.push('## Business Strengths');
      sections.push(analysis.marketAnalysis.strengths.map((item: string) => `- ${item}`).join('\n'));
    }
  }

  // Operations
  if (analysis.operations) {
    sections.push('# OPERATIONS');
    
    if (analysis.operations.suppliers) {
      sections.push('## Suppliers');
      const suppliersDetails = [
        analysis.operations.suppliers.count ? `Count: ${analysis.operations.suppliers.count}` : `Count: [NOT ANSWERED]`,
        analysis.operations.suppliers.transferability ? `Transferability: ${analysis.operations.suppliers.transferability}` : `Transferability: [NOT ANSWERED]`,
        analysis.operations.suppliers.concentration ? `Concentration: ${analysis.operations.suppliers.concentration}` : `Concentration: [NOT ANSWERED]`,
        analysis.operations.suppliers.terms ? `Terms: ${analysis.operations.suppliers.terms}` : `Terms: [NOT ANSWERED]`,
        analysis.operations.suppliers.replaceability ? `Replaceability: ${analysis.operations.suppliers.replaceability}` : `Replaceability: [NOT ANSWERED]`
      ].join('\n');
      sections.push(suppliersDetails);
    }
    
    if (analysis.operations.customers) {
      sections.push('## Customers');
      const customersDetails = [
        analysis.operations.customers.recurring ? `Recurring: ${analysis.operations.customers.recurring}` : `Recurring: [NOT ANSWERED]`,
        analysis.operations.customers.relationships ? `Relationships: ${analysis.operations.customers.relationships}` : `Relationships: [NOT ANSWERED]`,
        analysis.operations.customers.concentration ? `Concentration: ${analysis.operations.customers.concentration}` : `Concentration: [NOT ANSWERED]`,
        analysis.operations.customers.contracts ? `Contracts: ${analysis.operations.customers.contracts}` : `Contracts: [NOT ANSWERED]`,
        analysis.operations.customers.replaceability ? `Replaceability: ${analysis.operations.customers.replaceability}` : `Replaceability: [NOT ANSWERED]`
      ].join('\n');
      sections.push(customersDetails);
    }
  }

  // Team
  if (analysis.team) {
    sections.push('# TEAM');
    
    const teamDetails = [
      analysis.team.ownerResponsibilities ? `Owner Responsibilities: ${analysis.team.ownerResponsibilities}` : `Owner Responsibilities: [NOT ANSWERED]`,
      analysis.team.ownerHours ? `Owner Hours: ${analysis.team.ownerHours}` : `Owner Hours: [NOT ANSWERED]`,
      analysis.team.employeeSummary ? `Employee Summary: ${analysis.team.employeeSummary}` : `Employee Summary: [NOT ANSWERED]`,
      analysis.team.employeeCount ? `Employee Count: ${analysis.team.employeeCount}` : `Employee Count: [NOT ANSWERED]`,
      analysis.team.contractorCount ? `Contractor Count: ${analysis.team.contractorCount}` : `Contractor Count: [NOT ANSWERED]`,
      analysis.team.turnover ? `Turnover: ${analysis.team.turnover}` : `Turnover: [NOT ANSWERED]`,
      analysis.team.hiring ? `Hiring: ${analysis.team.hiring}` : `Hiring: [NOT ANSWERED]`,
      analysis.team.retention ? `Retention: ${analysis.team.retention}` : `Retention: [NOT ANSWERED]`,
      analysis.team.organization ? `Organization: ${analysis.team.organization}` : `Organization: [NOT ANSWERED]`,
      analysis.team.management ? `Management: ${analysis.team.management}` : `Management: [NOT ANSWERED]`
    ].join('\n\n');
    sections.push(teamDetails);
    
    if (analysis.team.keyEmployees && analysis.team.keyEmployees.length) {
      sections.push('## Key Employees');
      
      // Format each employee entry, handling both string and object formats
      const formattedEmployees = analysis.team.keyEmployees.map((employee: any) => {
        if (typeof employee === 'string') {
          return `- ${employee}`;
        } else if (typeof employee === 'object') {
          // Extract relevant properties from employee object
          const parts = [];
          if (employee.name) parts.push(`Name: ${employee.name}`);
          if (employee.role) parts.push(`Role: ${employee.role}`);
          if (employee.background) parts.push(`Background: ${employee.background}`);
          if (employee.tenure) parts.push(`Tenure: ${employee.tenure}`);
          
          // If no properties were found, provide a fallback format
          if (parts.length === 0) {
            return `- ${Object.entries(employee)
              .map(([key, val]) => `${key}: ${val}`)
              .join(', ')}`;
          }
          
          return `- ${parts.join(', ')}`;
        }
        return `- ${String(employee)}`;
      });
      
      sections.push(formattedEmployees.join('\n'));
    }
  }

  // Facility
  if (analysis.facility) {
    sections.push('# FACILITY');
    
    const facilityDetails = [
      analysis.facility.ownership ? `Ownership: ${analysis.facility.ownership}` : `Ownership: [NOT ANSWERED]`,
      analysis.facility.size ? `Size: ${analysis.facility.size}` : `Size: [NOT ANSWERED]`,
      analysis.facility.cost ? `Cost: ${analysis.facility.cost}` : `Cost: [NOT ANSWERED]`,
      analysis.facility.leaseDetails ? `Lease Details: ${analysis.facility.leaseDetails}` : `Lease Details: [NOT ANSWERED]`
    ].join('\n');
    sections.push(facilityDetails);
  }

  // Add contact footer if user profile is provided
  if (userProfile) {
    const contactFooter = generateContactFooter(userProfile);
    if (contactFooter) {
      sections.push(contactFooter);
    }
  }

  return sections.join('\n\n');
}

function generateContactFooter(userProfile: any): string {
  if (!userProfile) return '';
  
  const parts = [];
  
  // Add horizontal line
  parts.push('---');
  parts.push('');
  
  // Add profile information centered
  if (userProfile.profilePhoto) {
    parts.push(`![Profile Photo](${userProfile.profilePhoto})`);
  }
  
  if (userProfile.name) {
    parts.push(`**${userProfile.name}**`);
  }
  
  if (userProfile.title) {
    parts.push(userProfile.title);
  }
  
  if (userProfile.phoneNumber) {
    parts.push(`Phone: ${userProfile.phoneNumber}`);
  }
  
  if (userProfile.email) {
    parts.push(`Email: ${userProfile.email}`);
  }
  
  if (userProfile.businessName) {
    parts.push(`**${userProfile.businessName}**`);
  }
  
  if (userProfile.businessLogo) {
    parts.push(`![Business Logo](${userProfile.businessLogo})`);
  }
  
  return parts.join('\n');
}

export async function generateWordDocument(analysis: any, logoUrl?: string | null, websiteUrl?: string, selectedImages?: string[], userProfile?: any): Promise<Buffer> {
  // Create paragraphs for the document
  const paragraphs: docx.Paragraph[] = [];
  
  // Add logo image if available
  console.log("Logo processing - logoUrl received:", logoUrl);
  if (logoUrl) {
    try {
      // Fix logo path - read from file system instead of fetching as URL
      let logoPath = logoUrl;
      if (logoUrl.startsWith('/logos/')) {
        logoPath = `public${logoUrl}`;
      }
      
      const fs = await import('fs');
      console.log("Checking logo path:", logoPath);
      if (fs.existsSync(logoPath)) {
        console.log("Logo file exists, reading buffer...");
        const logoBuffer = fs.readFileSync(logoPath);
        
        console.log(`Adding logo as-is without dimension calculations: ${logoPath}`);
        
        // Add the logo to the document without any dimension manipulation
        paragraphs.push(
          new docx.Paragraph({
            children: [
              new docx.ImageRun({
                data: logoBuffer,
                transformation: {
                  width: 200,
                  height: 100,
                },
                type: logoPath.toLowerCase().endsWith('.png') ? "png" : "jpg"
              })
            ],
            alignment: docx.AlignmentType.CENTER,
            spacing: { after: 200 }
          })
        );
      }
    } catch (error) {
      console.error("Error adding logo to Word document:", error);
      // Continue without logo if there's an error
    }
  }
  
  // Add title
  paragraphs.push(
    new docx.Paragraph({
      text: "CONFIDENTIAL INFORMATION MEMORANDUM",
      heading: docx.HeadingLevel.HEADING_1,
      alignment: docx.AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );
  
  // BUSINESS OVERVIEW SECTION
  paragraphs.push(
    new docx.Paragraph({
      text: "BUSINESS OVERVIEW",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    })
  );
  
  // Business details in regular paragraphs
  paragraphs.push(
    new docx.Paragraph({
      text: `Founded: ${safeStringify(analysis.story?.yearStarted)}`,
      spacing: { before: 200 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Structure: ${safeStringify(analysis.story?.businessStructure)}`,
      spacing: { before: 100 }
    })
  );
  
  // Business summary
  paragraphs.push(
    new docx.Paragraph({
      text: "Business Description",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: safeStringify(analysis.story?.businessSummary || analysis.story?.businessModel),
      spacing: { before: 100, after: 200 }
    })
  );

  // Business Website section
  if (websiteUrl) {
    paragraphs.push(
      new docx.Paragraph({
        text: "Business Website",
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      })
    );
    
    paragraphs.push(
      new docx.Paragraph({
        text: websiteUrl,
        spacing: { before: 100, after: 200 }
      })
    );
  }

  // Selected Images section
  if (selectedImages && selectedImages.length > 0) {
    paragraphs.push(
      new docx.Paragraph({
        text: "Business Images",
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      })
    );
    
    // Add each image to the document - ULTRA SIMPLE VERSION
    for (const imagePath of selectedImages) {
      const fs = await import('fs');
      const path = await import('path');
      
      // Convert relative path to absolute path from project root
      let relativePath = imagePath;
      if (imagePath.startsWith('/images/')) {
        relativePath = `public${imagePath}`;
      } else if (imagePath.startsWith('/')) {
        relativePath = imagePath.substring(1);
      }
      const fullImagePath = path.resolve(process.cwd(), relativePath);
      
      if (fs.existsSync(fullImagePath)) {
        const imageBuffer = fs.readFileSync(fullImagePath);
        
        // Get actual image dimensions using a simple approach
        let actualWidth = 400;  // fallback
        let actualHeight = 300; // fallback
        
        try {
          // Try to read dimensions from the buffer using basic file header parsing
          if (fullImagePath.toLowerCase().endsWith('.jpg') || fullImagePath.toLowerCase().endsWith('.jpeg')) {
            // Simple JPEG dimension reading
            const jpegSize = getJpegDimensions(imageBuffer);
            if (jpegSize) {
              actualWidth = jpegSize.width;
              actualHeight = jpegSize.height;
            }
          } else if (fullImagePath.toLowerCase().endsWith('.png')) {
            // Simple PNG dimension reading
            const pngSize = getPngDimensions(imageBuffer);
            if (pngSize) {
              actualWidth = pngSize.width;
              actualHeight = pngSize.height;
            }
          }
          
          // Scale down if too large while maintaining aspect ratio
          const maxWidth = 350; // Smaller size for business images
          if (actualWidth > maxWidth) {
            const ratio = maxWidth / actualWidth;
            actualWidth = maxWidth;
            actualHeight = Math.round(actualHeight * ratio);
          }
          
          console.log(`Adding image with actual dimensions: ${imagePath} (${actualWidth}x${actualHeight})`);
        } catch (e) {
          console.log(`Using fallback dimensions for ${imagePath}: ${actualWidth}x${actualHeight}`);
        }
        
        // Determine image type from file extension
        const imageType = fullImagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
        
        paragraphs.push(
          new docx.Paragraph({
            children: [
              new docx.ImageRun({
                data: imageBuffer,
                transformation: {
                  width: actualWidth,
                  height: actualHeight,
                },
                type: imageType
              }),
            ],
            alignment: docx.AlignmentType.CENTER,
            spacing: { before: 200, after: 200 }
          })
        );
      }
    }
  }
  
  // INVESTMENT HIGHLIGHTS
  paragraphs.push(
    new docx.Paragraph({
      text: "INVESTMENT HIGHLIGHTS",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    })
  );
  
  // Key Attractions
  paragraphs.push(
    new docx.Paragraph({
      text: "Key Attractions",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    })
  );
  
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
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: "Target Market",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: safeStringify(analysis.marketAnalysis?.customerProfile),
      spacing: { before: 100, after: 200 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: "Competitive Landscape",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: "Competitors",
      heading: docx.HeadingLevel.HEADING_3,
      spacing: { before: 100, after: 100 }
    })
  );
  
  // Add bullet points for competitors
  if (analysis.marketAnalysis?.competitors?.length) {
    analysis.marketAnalysis.competitors.forEach((item: any) => {
      paragraphs.push(
        new docx.Paragraph({
          text: safeStringify(item),
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
    analysis.marketAnalysis.strengths.forEach((item: any) => {
      paragraphs.push(
        new docx.Paragraph({
          text: safeStringify(item),
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
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: "Customer Relationships",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    })
  );
  
  if (analysis.operations?.customers?.recurring && !String(analysis.operations?.customers?.recurring).includes('[NOT MENTIONED]')) {
    paragraphs.push(
      new docx.Paragraph({
        text: `Recurring Revenue: ${safeStringify(analysis.operations?.customers?.recurring)}`,
        spacing: { before: 100 }
      })
    );
  }
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Customer Base: ${safeStringify(analysis.operations?.customers?.relationships)}`,
      spacing: { before: 100 }
    })
  );
  
  if (analysis.operations?.customers?.concentration && !String(analysis.operations?.customers?.concentration).includes('[NOT MENTIONED]')) {
    paragraphs.push(
      new docx.Paragraph({
        text: `Revenue Concentration: ${safeStringify(analysis.operations?.customers?.concentration)}`,
        spacing: { before: 100 }
      })
    );
  }
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Contract Terms: ${safeStringify(analysis.operations?.customers?.contracts)}`,
      spacing: { before: 100, after: 200 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: "Supply Chain",
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Number of Suppliers: ${safeStringify(analysis.operations?.suppliers?.count)}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Supplier Terms: ${safeStringify(analysis.operations?.suppliers?.terms)}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Concentration: ${safeStringify(analysis.operations?.suppliers?.concentration)}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Transferability: ${safeStringify(analysis.operations?.suppliers?.transferability)}`,
      spacing: { before: 100, after: 200 }
    })
  );
  
  // TEAM STRUCTURE
  paragraphs.push(
    new docx.Paragraph({
      text: "TEAM STRUCTURE",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Owner Responsibilities: ${safeStringify(analysis.team?.ownerResponsibilities)}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Required Hours: ${safeStringify(analysis.team?.ownerHours)}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Management Structure: ${analysis.team?.management ? safeStringify(analysis.team.management) : "[NOT ANSWERED]"}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Team Size: ${analysis.team?.employeeCount ? safeStringify(analysis.team.employeeCount) : "[NOT ANSWERED]"}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Turnover Rate: ${analysis.team?.turnover ? safeStringify(analysis.team.turnover) : "[NOT ANSWERED]"}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Retention: ${analysis.team?.retention ? safeStringify(analysis.team.retention) : "[NOT ANSWERED]"}`,
      spacing: { before: 100, after: 200 }
    })
  );
  
  // Add Key Team Members section if available
  if (analysis.team?.keyEmployees?.length > 0) {
    // Add section heading
    paragraphs.push(
      new docx.Paragraph({
        text: "Key Team Members",
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      })
    );
    
    // Add each team member as a bullet point
    analysis.team.keyEmployees.forEach((employee: any) => {
      let employeeText;
      
      if (typeof employee === 'string') {
        employeeText = safeStringify(employee);
      } else if (typeof employee === 'object' && employee !== null) {
        // Extract relevant properties from employee object
        const parts = [];
        if (employee.name) parts.push(`Name: ${safeStringify(employee.name)}`);
        if (employee.role) parts.push(`Role: ${safeStringify(employee.role)}`);
        if (employee.background) parts.push(`Background: ${safeStringify(employee.background)}`);
        if (employee.tenure) parts.push(`Tenure: ${safeStringify(employee.tenure)}`);
        
        // If no properties were found, provide a fallback format
        if (parts.length === 0) {
          try {
            employeeText = Object.entries(employee)
              .map(([key, val]) => `${key}: ${safeStringify(val)}`)
              .join(', ');
          } catch (error) {
            employeeText = "[Employee Information]";
          }
        } else {
          employeeText = parts.join(', ');
        }
      } else {
        employeeText = safeStringify(employee);
      }
      
      paragraphs.push(
        new docx.Paragraph({
          text: employeeText,
          bullet: {
            level: 0
          },
          spacing: { before: 50 }
        })
      );
    });
  }
  
  // Continue with FACILITIES section
  paragraphs.push(
    // FACILITIES
    new docx.Paragraph({
      text: "FACILITIES",
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Ownership Status: ${safeStringify(analysis.facility?.ownership)}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Size: ${safeStringify(analysis.facility?.size)}`,
      spacing: { before: 100 }
    })
  );
  
  paragraphs.push(
    new docx.Paragraph({
      text: `Monthly Cost: ${safeStringify(analysis.facility?.cost)}`,
      spacing: { before: 100 }
    })
  );
  
  // Add lease details if available
  if (analysis.facility?.leaseDetails) {
    paragraphs.push(
      new docx.Paragraph({
        text: `Lease Details: ${safeStringify(analysis.facility.leaseDetails)}`,
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

export async function generatePDF(analysis: any, docTitle?: string, logoUrl?: string | null, websiteUrl?: string, selectedImages?: string[]): Promise<Buffer> {
  console.log("Starting enhanced PDF generation...");
  
  return new Promise(async (resolve, reject) => {
    try {
      // Validate analysis object to prevent errors
      if (!analysis || typeof analysis !== 'object') {
        console.error("Invalid analysis object provided to PDF generator");
        throw new Error("Invalid analysis data");
      }
      
      // Create a PDF document with expanded options for better handling of content
      const doc = new PDFDocument({
        size: 'letter',
        margin: 50,
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: docTitle || 'Confidential Information Memorandum',
          Author: 'CIM Generator'
        }
      });
      
      // Collect PDF data in buffers
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      
      doc.on('end', () => {
        console.log("PDF document finalized successfully");
        resolve(Buffer.concat(chunks));
      });
      
      doc.on('error', (err) => {
        console.error("Error in PDF document generation:", err);
        reject(err);
      });
      
      // TITLE PAGE
      
      // Skip logo on title page - will be in dedicated section
      
      // Add main title
      doc.fontSize(22)
         .text('CONFIDENTIAL INFORMATION MEMORANDUM', {
           align: 'center'
         });
      
      doc.moveDown(2);
      
      // Add business name/title - use document title if provided, otherwise extract from analysis
      let businessTitle = docTitle || safeStringify(analysis.story?.businessSummary) || 'Business Information Memorandum';
      console.log("Using title for PDF:", businessTitle);
      // If too long, get first sentence
      if (businessTitle.length > 100) {
        const firstSentence = businessTitle.split(/\.(\s|$)/)[0];
        if (firstSentence && firstSentence.length > 20) {
          businessTitle = firstSentence + '.';
        } else {
          businessTitle = businessTitle.substring(0, 100) + '...';
        }
      }
      
      doc.fontSize(16)
         .text(businessTitle, {
           align: 'center'
         });
      
      // Add a separator line
      doc.moveDown(2);
      doc.moveTo(50, doc.y)
         .lineTo(doc.page.width - 50, doc.y)
         .stroke();
      
      doc.moveDown(2);
      doc.fontSize(10)
         .text('CONFIDENTIAL', {
           align: 'center'
         })
         .moveDown(0.5)
         .text('This document contains confidential information.', {
           align: 'center'
         });
      
      // Add logo under the document title on first page
      if (logoUrl) {
        try {
          console.log("Adding logo to PDF title page:", logoUrl);
          // Fix logo path - add public prefix if needed
          let logoPath = logoUrl;
          if (logoUrl.startsWith('/logos/')) {
            logoPath = `public${logoUrl}`;
          }
          
          const path = await import('path');
          logoPath = path.resolve(process.cwd(), logoPath);
          
          // Check if file exists before trying to add it
          const fs = await import('fs');
          if (fs.existsSync(logoPath)) {
            // Add some space after the title
            doc.moveDown(2);
            
            // Add logo centered under the title
            const pageWidth = doc.page.width;
            const logoWidth = 200;
            const xPosition = (pageWidth - logoWidth) / 2;
            
            doc.image(logoPath, xPosition, doc.y, {
              fit: [logoWidth, 120]
            });
            doc.moveDown(2);
          }
        } catch (logoError) {
          console.error("Failed to add logo to PDF title page:", logoError);
        }
      }

      // BUSINESS IMAGES PAGE - At the beginning after title page
      if (selectedImages && selectedImages.length > 0) {
        doc.addPage();
        
        // Add section title
        doc.fontSize(16).text("BUSINESS IMAGES", { align: 'center', underline: true });
        doc.moveDown(2);
        
        // Add each image to the PDF with explicit positioning to prevent overlap
        let currentY = doc.y;
        
        for (let i = 0; i < selectedImages.length; i++) {
          const imagePath = selectedImages[i];
          try {
            const fs = await import('fs');
            const path = await import('path');
            
            // Convert relative path to absolute path from project root
            let relativePath = imagePath;
            if (imagePath.startsWith('/images/')) {
              relativePath = `public${imagePath}`;
            } else if (imagePath.startsWith('/')) {
              relativePath = imagePath.substring(1);
            }
            const fullImagePath = path.resolve(process.cwd(), relativePath);
            
            if (fs.existsSync(fullImagePath)) {
              // Calculate image height and check if we need a new page
              const imageHeight = 200; // Fixed height for consistent spacing
              const spacingAfter = 40; // Space after each image
              
              // Check if image will fit on current page
              if (currentY + imageHeight + spacingAfter > doc.page.height - 100) {
                doc.addPage();
                currentY = 50; // Reset to top of new page with margin
              }
              
              // Position image explicitly with fixed coordinates
              const pageWidth = doc.page.width;
              const imageWidth = 350;
              const xPosition = (pageWidth - imageWidth) / 2; // Center horizontally
              
              doc.image(fullImagePath, xPosition, currentY, {
                fit: [imageWidth, imageHeight]
              });
              
              // Update current Y position for next image
              currentY += imageHeight + spacingAfter;
              
              // Move doc position to match our tracking
              doc.y = currentY;
            }
          } catch (imageError) {
            console.error(`Failed to add image ${imagePath} to PDF:`, imageError);
          }
        }
      }

      // Skip table of contents section
      
      // CONTENT PAGES
      
      // BUSINESS OVERVIEW
      doc.addPage();
      
      // If logo is available, add a small version to the top right corner of each page
      if (logoUrl) {
        try {
          doc.image(logoUrl, doc.page.width - 150, 30, {
            fit: [100, 50],
            align: 'right'
          });
        } catch (error) {
          console.error("Failed to add page header logo:", error);
        }
      }
      
      doc.fontSize(16)
         .text('BUSINESS OVERVIEW', {
           underline: true
         });
      
      doc.moveDown(1);
      doc.fontSize(12);
      
      // Business basics
      if (analysis.story) {
        doc.text(`Founded: ${safeStringify(analysis.story.yearStarted)}`);
        doc.text(`Structure: ${safeStringify(analysis.story.businessStructure)}`);
        
        doc.moveDown(1);
        if (analysis.story.businessSummary) {
          doc.text("Business Description:", {
            continued: false
          });
          doc.moveDown(0.5);
          
          // Format with explicit width and enable automatic page breaks
          const text = safeStringify(analysis.story.businessSummary);
          
          // Use continueOnNewPage option
          doc.text(text, {
            width: doc.page.width - 100,
            align: 'left',
            lineGap: 5,
            continued: false
          });
          
          // Check if the content was cut off and add it on a new page if needed
          doc.moveDown(1);
        }
      }

      // Business Website section
      if (websiteUrl) {
        doc.moveDown(1);
        doc.fontSize(14).text("Business Website:", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(websiteUrl);
        doc.moveDown(1);
      }


      
      // MARKET SECTION - check if we need a new page
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
        if (logoUrl) {
          try {
            doc.image(logoUrl, doc.page.width - 150, 30, {
              fit: [100, 50],
              align: 'right'
            });
          } catch (error) {
            console.error("Failed to add page header logo:", error);
          }
        }
      } else {
        doc.moveDown(2);
      }
      
      doc.fontSize(16)
         .text('MARKET POSITION', {
           underline: true
         });
      
      doc.moveDown(1);
      doc.fontSize(12);
      
      if (analysis.marketAnalysis) {
        if (analysis.marketAnalysis.customerProfile) {
          doc.text("Target Market:");
          doc.moveDown(0.5);
          doc.text(safeStringify(analysis.marketAnalysis.customerProfile), {
            width: doc.page.width - 100
          });
          doc.moveDown(1);
        }
        
        if (analysis.marketAnalysis.competitors && analysis.marketAnalysis.competitors.length) {
          doc.text("Competitors:");
          doc.moveDown(0.5);
          analysis.marketAnalysis.competitors.forEach((competitor: string) => {
            doc.text(`• ${safeStringify(competitor)}`, {
              width: doc.page.width - 120
            });
          });
          doc.moveDown(1);
        }
        
        if (analysis.marketAnalysis.strengths && analysis.marketAnalysis.strengths.length) {
          doc.text("Business Strengths:");
          doc.moveDown(0.5);
          analysis.marketAnalysis.strengths.forEach((strength: string) => {
            doc.text(`• ${safeStringify(strength)}`, {
              width: doc.page.width - 120
            });
          });
        }
      }
      
      // OPERATIONS SECTION - check if we need a new page
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
        if (logoUrl) {
          try {
            doc.image(logoUrl, doc.page.width - 150, 30, {
              fit: [100, 50],
              align: 'right'
            });
          } catch (error) {
            console.error("Failed to add page header logo:", error);
          }
        }
      } else {
        doc.moveDown(2);
      }
      
      doc.fontSize(16)
         .text('OPERATIONS', {
           underline: true
         });
      
      doc.moveDown(1);
      doc.fontSize(12);
      
      if (analysis.operations) {
        // Customer details
        if (analysis.operations.customers) {
          doc.text("Customer Relationships:");
          doc.moveDown(0.5);
          const customers = analysis.operations.customers;
          // Only include recurring revenue if it's not [NOT MENTIONED]
          if (customers.recurring && !String(customers.recurring).includes('[NOT MENTIONED]')) {
            doc.text(`Recurring Revenue: ${safeStringify(customers.recurring)}`, {
              width: doc.page.width - 100
            });
          }
          doc.text(`Customer Base: ${safeStringify(customers.relationships)}`, {
            width: doc.page.width - 100
          });
          // Only include concentration if it's not [NOT MENTIONED]
          if (customers.concentration && !String(customers.concentration).includes('[NOT MENTIONED]')) {
            doc.text(`Revenue Concentration: ${safeStringify(customers.concentration)}`, {
              width: doc.page.width - 100
            });
          }
          doc.moveDown(1);
        }
        
        // Supplier details
        if (analysis.operations.suppliers) {
          doc.text("Supply Chain:");
          doc.moveDown(0.5);
          const suppliers = analysis.operations.suppliers;
          doc.text(`Number of Suppliers: ${safeStringify(suppliers.count)}`, {
            width: doc.page.width - 100
          });
          doc.text(`Supplier Terms: ${safeStringify(suppliers.terms)}`, {
            width: doc.page.width - 100
          });
          doc.text(`Supplier Concentration: ${safeStringify(suppliers.concentration)}`, {
            width: doc.page.width - 100
          });
          doc.text(`Supplier Transferability: ${safeStringify(suppliers.transferability)}`, {
            width: doc.page.width - 100
          });
        }
      }
      
      // TEAM STRUCTURE SECTION - always start on a new page
      doc.addPage();
      if (logoUrl) {
        try {
          doc.image(logoUrl, doc.page.width - 150, 30, {
            fit: [100, 50],
            align: 'right'
          });
        } catch (error) {
          console.error("Failed to add page header logo:", error);
        }
      }
      
      doc.fontSize(16)
         .text('TEAM STRUCTURE', {
           underline: true
         });
         
      doc.moveDown(1);
      doc.fontSize(12);
      
      if (analysis.team) {
        doc.text(`Owner Responsibilities: ${safeStringify(analysis.team.ownerResponsibilities)}`, {
          width: doc.page.width - 100
        });
        doc.text(`Owner Hours per Week: ${safeStringify(analysis.team.ownerHours)}`, {
          width: doc.page.width - 100
        });
        doc.moveDown(1);
        doc.text(`Total Employees: ${safeStringify(analysis.team.employeeCount)}`, {
          width: doc.page.width - 100
        });
        
        if (analysis.team.keyEmployees && analysis.team.keyEmployees.length > 0) {
          doc.moveDown(1);
          doc.text("Key Team Members:");
          doc.moveDown(0.5);
          
          analysis.team.keyEmployees.forEach((employee: any) => {
            if (typeof employee === 'string') {
              doc.text(`• ${safeStringify(employee)}`, {
                width: doc.page.width - 120
              });
            } else if (typeof employee === 'object' && employee !== null) {
              const parts = [];
              if (employee.role) parts.push(`Role: ${safeStringify(employee.role)}`);
              if (employee.tenure) parts.push(`Tenure: ${safeStringify(employee.tenure)}`);
              
              doc.text(`• ${parts.length > 0 ? parts.join(', ') : 'Employee info not provided'}`, {
                width: doc.page.width - 120
              });
            } else {
              doc.text(`• ${safeStringify(employee)}`, {
                width: doc.page.width - 120
              });
            }
          });
        }
      }
      
      // FACILITIES SECTION
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
        if (logoUrl) {
          try {
            doc.image(logoUrl, doc.page.width - 150, 30, {
              fit: [100, 50],
              align: 'right'
            });
          } catch (error) {
            console.error("Failed to add page header logo:", error);
          }
        }
      } else {
        doc.moveDown(2);
      }
      
      doc.fontSize(16)
         .text('FACILITIES', {
           underline: true
         });
         
      doc.moveDown(1);
      doc.fontSize(12);
      
      if (analysis.facility) {
        doc.text(`Ownership Status: ${safeStringify(analysis.facility.ownership)}`, {
          width: doc.page.width - 100
        });
        doc.text(`Size: ${safeStringify(analysis.facility.size)}`, {
          width: doc.page.width - 100
        });
        doc.text(`Monthly Cost: ${safeStringify(analysis.facility.cost)}`, {
          width: doc.page.width - 100
        });
        
        if (analysis.facility.leaseDetails) {
          doc.text(`Lease Details: ${safeStringify(analysis.facility.leaseDetails)}`, {
            width: doc.page.width - 100
          });
        }
      }
      
      // MARKETING SECTION - only add if it exists in the analysis
      if (analysis.marketing && 
         (analysis.marketing.strategies?.length > 0 || 
          analysis.marketing.paidAdvertising?.channels?.length > 0 || 
          analysis.marketing.emailMarketing?.listSize)) {
          
        if (doc.y > doc.page.height - 200) {
          doc.addPage();
          if (logoUrl) {
            try {
              doc.image(logoUrl, doc.page.width - 150, 30, {
                fit: [100, 50],
                align: 'right'
              });
            } catch (error) {
              console.error("Failed to add page header logo:", error);
            }
          }
        } else {
          doc.moveDown(2);
        }
        
        doc.fontSize(16)
           .text('MARKETING', {
             underline: true
           });
           
        doc.moveDown(1);
        doc.fontSize(12);
        
        if (analysis.marketing.strategies?.length > 0) {
          doc.text('Marketing Strategies:');
          doc.moveDown(0.5);
          analysis.marketing.strategies.forEach((strategy: string) => {
            doc.text(`• ${safeStringify(strategy)}`, {
              width: doc.page.width - 120
            });
          });
          doc.moveDown(1);
        }
        
        if (analysis.marketing.paidAdvertising?.channels?.length > 0) {
          doc.text('Paid Advertising Channels:');
          doc.moveDown(0.5);
          analysis.marketing.paidAdvertising.channels.forEach((channel: string) => {
            doc.text(`• ${safeStringify(channel)}`, {
              width: doc.page.width - 120
            });
          });
          
          if (analysis.marketing.paidAdvertising.effectiveness) {
            doc.moveDown(0.5);
            doc.text(`Effectiveness: ${safeStringify(analysis.marketing.paidAdvertising.effectiveness)}`, {
              width: doc.page.width - 100
            });
          }
          doc.moveDown(1);
        }
        
        if (analysis.marketing.emailMarketing?.listSize) {
          doc.text(`Email Marketing: List Size of ${safeStringify(analysis.marketing.emailMarketing.listSize)}`, {
            width: doc.page.width - 100
          });
          
          if (analysis.marketing.emailMarketing.usage) {
            doc.text(`Usage: ${safeStringify(analysis.marketing.emailMarketing.usage)}`, {
              width: doc.page.width - 100
            });
          }
        }
      }
      
      // Skip page numbering
      
      console.log("Finalizing PDF document generation...");
      // Fix for blank pages: Ensure all content is properly rendered before ending the document
      // End the document without adding any blank pages at the end
      doc.end();
      
    } catch (error: any) {
      console.error("PDF generation failed:", error.message || error);
      
      // Create a basic error PDF as fallback
      try {
        const errorDoc = new PDFDocument({ autoFirstPage: true });
        const errorChunks: Buffer[] = [];
        
        errorDoc.on('data', (chunk) => {
          errorChunks.push(Buffer.from(chunk));
        });
        
        errorDoc.on('end', () => {
          console.log("Generated error fallback PDF");
          resolve(Buffer.concat(errorChunks));
        });
        
        // Add error information to the PDF
        errorDoc.fontSize(16)
               .text('Error Generating Complete PDF', { align: 'center' })
               .moveDown(1)
               .fontSize(12)
               .text('There was an error generating the complete PDF document.', { align: 'center' })
               .moveDown(1)
               .text('Please try one of the other export formats instead.', { align: 'center' })
               .moveDown(2)
               .fontSize(10)
               .text(`Error details: ${error.message || 'Unknown error'}`, { align: 'center' });
        
        errorDoc.end();
      } catch (fallbackError) {
        console.error("Even fallback PDF failed:", fallbackError);
        reject(new Error("PDF generation failed completely. Please try another export format."));
      }
    }
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
  formattedContent += `${title}\n\n`;
  
  // Business Overview Section
  formattedContent += `BUSINESS OVERVIEW\n==================\n`;
  formattedContent += `Founded: ${safeStringify(analysis.story?.yearStarted)}\n`;
  formattedContent += `Structure: ${safeStringify(analysis.story?.businessStructure)}\n\n`;
  
  // Business Summary
  formattedContent += `${safeStringify(analysis.story?.businessSummary || analysis.story?.businessModel)}\n\n`;
  
  // Executive Summary Section
  formattedContent += `INVESTMENT HIGHLIGHTS\n===================\n`;
  formattedContent += `Key Attractions:\n`;
  if (analysis.executiveSummary?.buyerAttractions?.length) {
    analysis.executiveSummary.buyerAttractions.forEach((item: string) => {
      formattedContent += `• ${safeStringify(item)}\n`;
    });
  }
  
  formattedContent += `\nGrowth Opportunities:\n`;
  if (analysis.executiveSummary?.growthOpportunities?.length) {
    analysis.executiveSummary.growthOpportunities.forEach((item: string) => {
      formattedContent += `• ${safeStringify(item)}\n`;
    });
  }
  
  // Market Position
  formattedContent += `\nMARKET POSITION\n=============\n`;
  formattedContent += `Target Market: ${safeStringify(analysis.marketAnalysis?.customerProfile)}\n\n`;
  
  formattedContent += `Competitors:\n`;
  if (analysis.marketAnalysis?.competitors?.length) {
    analysis.marketAnalysis.competitors.forEach((item: string) => {
      formattedContent += `• ${safeStringify(item)}\n`;
    });
  }
  
  formattedContent += `\nBusiness Strengths:\n`;
  if (analysis.marketAnalysis?.strengths?.length) {
    analysis.marketAnalysis.strengths.forEach((item: string) => {
      formattedContent += `• ${safeStringify(item)}\n`;
    });
  }
  
  // Operations Section
  formattedContent += `\nOPERATIONS\n=========\n`;
  formattedContent += `Customer Relationships:\n`;
  // Only include recurring revenue if it's not [NOT MENTIONED]
  if (analysis.operations?.customers?.recurring && 
      !String(analysis.operations?.customers?.recurring).includes('[NOT MENTIONED]')) {
    formattedContent += `• Recurring Revenue: ${safeStringify(analysis.operations?.customers?.recurring)}\n`;
  }
  formattedContent += `• Customer Base: ${safeStringify(analysis.operations?.customers?.relationships)}\n`;
  // Only include concentration if it's not [NOT MENTIONED]
  if (analysis.operations?.customers?.concentration && 
      !String(analysis.operations?.customers?.concentration).includes('[NOT MENTIONED]')) {
    formattedContent += `• Revenue Concentration: ${safeStringify(analysis.operations?.customers?.concentration)}\n`;
  }
  formattedContent += `• Contract Terms: ${safeStringify(analysis.operations?.customers?.contracts)}\n\n`;
  
  formattedContent += `Supply Chain:\n`;
  formattedContent += `• Number of Suppliers: ${safeStringify(analysis.operations?.suppliers?.count)}\n`;
  formattedContent += `• Supplier Terms: ${safeStringify(analysis.operations?.suppliers?.terms)}\n`;
  formattedContent += `• Concentration: ${safeStringify(analysis.operations?.suppliers?.concentration)}\n`;
  formattedContent += `• Transferability: ${safeStringify(analysis.operations?.suppliers?.transferability)}\n\n`;
  
  // Team Structure
  formattedContent += `TEAM STRUCTURE\n=============\n`;
  formattedContent += `• Owner Responsibilities: ${safeStringify(analysis.team?.ownerResponsibilities)}\n`;
  formattedContent += `• Required Hours: ${safeStringify(analysis.team?.ownerHours)}\n`;
  formattedContent += `• Management Structure: ${safeStringify(analysis.team?.management)}\n`;
  formattedContent += `• Team Size: ${safeStringify(analysis.team?.employeeCount)}\n`;
  formattedContent += `• Turnover Rate: ${safeStringify(analysis.team?.turnover)}\n`;
  formattedContent += `• Retention: ${safeStringify(analysis.team?.retention)}\n`;
  
  // Add Key Team Members if available
  if (analysis.team?.keyEmployees?.length > 0) {
    formattedContent += `\nKey Team Members:\n`;
    
    // Format each employee based on its type
    analysis.team.keyEmployees.forEach((employee: any) => {
      if (typeof employee === 'string') {
        formattedContent += `• ${safeStringify(employee)}\n`;
      } else if (typeof employee === 'object' && employee !== null) {
        // Extract relevant properties from employee object
        const parts = [];
        if (employee.name) parts.push(`Name: ${safeStringify(employee.name)}`);
        if (employee.role) parts.push(`Role: ${safeStringify(employee.role)}`);
        if (employee.background) parts.push(`Background: ${safeStringify(employee.background)}`);
        if (employee.tenure) parts.push(`Tenure: ${safeStringify(employee.tenure)}`);
        
        // If no properties were found, provide a fallback format
        if (parts.length === 0) {
          try {
            formattedContent += `• ${Object.entries(employee)
              .map(([key, val]) => `${key}: ${safeStringify(val)}`)
              .join(', ')}\n`;
          } catch (error) {
            formattedContent += `• Employee information (could not format details)\n`;
          }
        } else {
          formattedContent += `• ${parts.join(', ')}\n`;
        }
      } else {
        formattedContent += `• ${safeStringify(employee)}\n`;
      }
    });
  }
  
  formattedContent += `\n`;
  
  // Facilities
  formattedContent += `FACILITIES\n=========\n`;
  formattedContent += `• Ownership Status: ${safeStringify(analysis.facility?.ownership)}\n`;
  formattedContent += `• Size: ${safeStringify(analysis.facility?.size)}\n`;
  formattedContent += `• Monthly Cost: ${safeStringify(analysis.facility?.cost)}\n`;
  if (analysis.facility?.leaseDetails) {
    formattedContent += `• Lease Details: ${safeStringify(analysis.facility.leaseDetails)}\n`;
  }

  // Create a new Google Doc
  const fileMetadata = {
    name: `CIM - ${title}`,
    mimeType: 'application/vnd.google-apps.document'
  };

  try {
    // Create the file with better formatting for Google Docs
    const file = await drive.files.create({
      requestBody: {
        name: title || 'Confidential Information Memorandum',
        mimeType: 'application/vnd.google-apps.document'
      },
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
