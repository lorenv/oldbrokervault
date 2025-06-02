import { CimDocument } from "@shared/schema";
import { storage } from "./storage";
import { google } from "googleapis";
import * as docx from "docx";
import PDFDocument from "pdfkit";
import { Readable } from "stream";
import path from 'path';
import fs from 'fs';

// Helper function to resolve image paths correctly
function resolveImagePath(imagePath: string): string {
  if (!imagePath) return '';
  return imagePath.startsWith('/') 
    ? path.resolve(process.cwd(), 'public' + imagePath)
    : imagePath;
}

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
    // PNG files start with 8-byte signature
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (!buffer.subarray(0, 8).equals(pngSignature)) return null;
    
    // IHDR chunk starts at byte 8, dimensions are at bytes 16-19 (width) and 20-23 (height)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  } catch (e) {
    // Return null if parsing fails
  }
  return null;
}

// Helper function to safely stringify any value
function safeStringify(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function generateHtml(analysis: any, logoUrl?: string | null, userProfile?: any, websiteUrl?: string, selectedImages?: string[], financialData?: any, financialFiles?: any[]): string {
  const title = 'CONFIDENTIAL INFORMATION MEMORANDUM';
  
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            margin: 0; 
            padding: 20px; 
            background-color: #f8f9fa;
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            padding: 40px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
            text-align: center; 
            margin-bottom: 40px; 
            border-bottom: 3px solid #2563eb; 
            padding-bottom: 20px;
        }
        .logo { 
            max-width: 200px; 
            max-height: 100px; 
            margin-bottom: 20px;
        }
        h1 { 
            color: #2563eb; 
            font-size: 28px; 
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        h2 { 
            color: #1e40af; 
            border-bottom: 2px solid #ddd; 
            padding-bottom: 8px; 
            margin-top: 30px;
        }
        h3 { 
            color: #374151; 
            margin-top: 25px;
        }
        .section { 
            margin: 25px 0; 
        }
        .highlight { 
            background-color: #e0f2fe; 
            padding: 15px; 
            border-left: 4px solid #2563eb; 
            margin: 15px 0;
        }
        .two-column { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 20px; 
            margin: 20px 0;
        }
        .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .business-image {
            width: 100%;
            max-width: 300px;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .contact-footer {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 30px;
        }
        .profile-photo {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            margin: 0 auto 15px;
            display: block;
            border: 3px solid #2563eb;
        }
        ul { 
            padding-left: 20px; 
        }
        li { 
            margin: 8px 0; 
        }
        .financial-section {
            background-color: #f0f9ff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .financial-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin: 15px 0;
        }
        .financial-card {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }
        .financial-title {
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 8px;
        }
        @media print {
            body { background-color: white; }
            .container { box-shadow: none; padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">`;

  if (logoUrl) {
    html += `<img src="${logoUrl}" alt="Company Logo" class="logo">`;
  }

  html += `
            <h1>${title}</h1>
        </div>
`;

  // Business Overview Section
  if (analysis.story) {
    html += `
        <div class="section">
            <h2>BUSINESS OVERVIEW</h2>
            <div class="highlight">
                ${analysis.story.businessSummary ? `<p><strong>Business Summary:</strong> ${safeStringify(analysis.story.businessSummary)}</p>` : ''}
            </div>
`;

    if (analysis.story.businessModel) {
      html += `<p><strong>Business Model:</strong> ${safeStringify(analysis.story.businessModel)}</p>`;
    }
    
    if (analysis.story.yearStarted) {
      html += `<p><strong>Year Started:</strong> ${safeStringify(analysis.story.yearStarted)}</p>`;
    }
    
    if (analysis.story.businessStructure) {
      html += `<p><strong>Business Structure:</strong> ${safeStringify(analysis.story.businessStructure)}</p>`;
    }

    if (analysis.story.keyAttractions && analysis.story.keyAttractions.length > 0) {
      html += `
            <h3>Key Attractions</h3>
            <ul>`;
      analysis.story.keyAttractions.forEach((attraction: string) => {
        html += `<li>${safeStringify(attraction)}</li>`;
      });
      html += `</ul>`;
    }

    html += `</div>`;
  }

  // Executive Summary
  if (analysis.executiveSummary) {
    html += `
        <div class="section">
            <h2>EXECUTIVE SUMMARY</h2>`;
    
    if (analysis.executiveSummary.buyerAttractions && analysis.executiveSummary.buyerAttractions.length > 0) {
      html += `
            <h3>Buyer Attractions</h3>
            <ul>`;
      analysis.executiveSummary.buyerAttractions.forEach((attraction: string) => {
        html += `<li>${safeStringify(attraction)}</li>`;
      });
      html += `</ul>`;
    }

    if (analysis.executiveSummary.growthOpportunities && analysis.executiveSummary.growthOpportunities.length > 0) {
      html += `
            <h3>Growth Opportunities</h3>
            <ul>`;
      analysis.executiveSummary.growthOpportunities.forEach((opportunity: string) => {
        html += `<li>${safeStringify(opportunity)}</li>`;
      });
      html += `</ul>`;
    }

    html += `</div>`;
  }

  // Market Analysis
  if (analysis.marketAnalysis) {
    html += `
        <div class="section">
            <h2>MARKET ANALYSIS</h2>`;

    if (analysis.marketAnalysis.uniqueFeatures && analysis.marketAnalysis.uniqueFeatures.length > 0) {
      html += `
            <h3>Unique Features & Competitive Advantages</h3>
            <ul>`;
      analysis.marketAnalysis.uniqueFeatures.forEach((feature: string) => {
        html += `<li>${safeStringify(feature)}</li>`;
      });
      html += `</ul>`;
    }

    if (analysis.marketAnalysis.customerProfile) {
      html += `<p><strong>Customer Profile:</strong> ${safeStringify(analysis.marketAnalysis.customerProfile)}</p>`;
    }

    if (analysis.marketAnalysis.competitors && analysis.marketAnalysis.competitors.length > 0) {
      html += `
            <h3>Competitive Landscape</h3>
            <ul>`;
      analysis.marketAnalysis.competitors.forEach((competitor: string) => {
        html += `<li>${safeStringify(competitor)}</li>`;
      });
      html += `</ul>`;
    }

    html += `</div>`;
  }

  // Financial Information
  if (financialData && Object.keys(financialData).length > 0) {
    html += `
        <div class="section financial-section">
            <h2>FINANCIAL INFORMATION</h2>
            <div class="financial-grid">`;

    Object.entries(financialData).forEach(([key, value]: [string, any]) => {
      if (value && typeof value === 'object' && value.value !== undefined) {
        html += `
                <div class="financial-card">
                    <div class="financial-title">${value.title || key}</div>
                    <div>${safeStringify(value.value)}</div>
                    ${value.description ? `<div style="font-size: 0.9em; color: #6b7280; margin-top: 5px;">${safeStringify(value.description)}</div>` : ''}
                </div>`;
      }
    });

    html += `
            </div>
        </div>`;
  }

  // Operations
  if (analysis.operations) {
    html += `
        <div class="section">
            <h2>OPERATIONS</h2>
            <div class="two-column">`;

    if (analysis.operations.suppliers) {
      html += `
                <div>
                    <h3>Supplier Information</h3>
                    ${analysis.operations.suppliers.count ? `<p><strong>Supplier Count:</strong> ${safeStringify(analysis.operations.suppliers.count)}</p>` : ''}
                    ${analysis.operations.suppliers.concentration ? `<p><strong>Concentration:</strong> ${safeStringify(analysis.operations.suppliers.concentration)}</p>` : ''}
                    ${analysis.operations.suppliers.terms ? `<p><strong>Terms:</strong> ${safeStringify(analysis.operations.suppliers.terms)}</p>` : ''}
                </div>`;
    }

    if (analysis.operations.customers) {
      html += `
                <div>
                    <h3>Customer Information</h3>
                    ${analysis.operations.customers.recurring ? `<p><strong>Recurring Customers:</strong> ${safeStringify(analysis.operations.customers.recurring)}</p>` : ''}
                    ${analysis.operations.customers.concentration ? `<p><strong>Concentration:</strong> ${safeStringify(analysis.operations.customers.concentration)}</p>` : ''}
                    ${analysis.operations.customers.relationships ? `<p><strong>Relationships:</strong> ${safeStringify(analysis.operations.customers.relationships)}</p>` : ''}
                </div>`;
    }

    html += `
            </div>
        </div>`;
  }

  // Sales & Marketing
  if (analysis.sales || analysis.marketing) {
    html += `
        <div class="section">
            <h2>SALES & MARKETING</h2>`;

    if (analysis.sales) {
      if (analysis.sales.channels && typeof analysis.sales.channels === 'object') {
        html += `
            <h3>Sales Channels</h3>
            <ul>`;
        Object.entries(analysis.sales.channels).forEach(([channel, percentage]: [string, any]) => {
          html += `<li><strong>${channel}:</strong> ${safeStringify(percentage)}%</li>`;
        });
        html += `</ul>`;
      }

      if (analysis.sales.averageOrderValue) {
        html += `<p><strong>Average Order Value:</strong> ${safeStringify(analysis.sales.averageOrderValue)}</p>`;
      }

      if (analysis.sales.seasonality) {
        html += `<p><strong>Seasonality:</strong> ${safeStringify(analysis.sales.seasonality)}</p>`;
      }
    }

    if (analysis.marketing) {
      if (analysis.marketing.strategies && analysis.marketing.strategies.length > 0) {
        html += `
            <h3>Marketing Strategies</h3>
            <ul>`;
        analysis.marketing.strategies.forEach((strategy: string) => {
          html += `<li>${safeStringify(strategy)}</li>`;
        });
        html += `</ul>`;
      }

      if (analysis.marketing.emailMarketing) {
        html += `<p><strong>Email Marketing:</strong> ${safeStringify(analysis.marketing.emailMarketing.listSize)} list size, ${safeStringify(analysis.marketing.emailMarketing.usage)}</p>`;
      }
    }

    html += `</div>`;
  }

  // Team Structure
  if (analysis.team) {
    html += `
        <div class="section">
            <h2>TEAM STRUCTURE</h2>`;

    if (analysis.team.employeeSummary) {
      html += `<p><strong>Employee Summary:</strong> ${safeStringify(analysis.team.employeeSummary)}</p>`;
    }

    if (analysis.team.ownerResponsibilities) {
      html += `<p><strong>Owner Responsibilities:</strong> ${safeStringify(analysis.team.ownerResponsibilities)}</p>`;
    }

    if (analysis.team.ownerHours) {
      html += `<p><strong>Owner Hours:</strong> ${safeStringify(analysis.team.ownerHours)}</p>`;
    }

    if (analysis.team.keyEmployees && analysis.team.keyEmployees.length > 0) {
      html += `
            <h3>Key Employees</h3>
            <ul>`;
      analysis.team.keyEmployees.forEach((employee: string) => {
        html += `<li>${safeStringify(employee)}</li>`;
      });
      html += `</ul>`;
    }

    html += `</div>`;
  }

  // Assets & Facility
  if (analysis.assets || analysis.facility) {
    html += `
        <div class="section">
            <h2>ASSETS & FACILITY</h2>`;

    if (analysis.assets) {
      if (analysis.assets.location) {
        html += `<p><strong>Location:</strong> ${safeStringify(analysis.assets.location)}</p>`;
      }

      if (analysis.assets.equipmentValue) {
        html += `<p><strong>Equipment Value:</strong> ${safeStringify(analysis.assets.equipmentValue)}</p>`;
      }

      if (analysis.assets.digitalAssets && analysis.assets.digitalAssets.length > 0) {
        html += `
            <h3>Digital Assets</h3>
            <ul>`;
        analysis.assets.digitalAssets.forEach((asset: string) => {
          html += `<li>${safeStringify(asset)}</li>`;
        });
        html += `</ul>`;
      }
    }

    if (analysis.facility) {
      html += `<h3>Facility Details</h3>`;
      if (analysis.facility.ownership) {
        html += `<p><strong>Ownership:</strong> ${safeStringify(analysis.facility.ownership)}</p>`;
      }
      if (analysis.facility.size) {
        html += `<p><strong>Size:</strong> ${safeStringify(analysis.facility.size)}</p>`;
      }
      if (analysis.facility.cost) {
        html += `<p><strong>Cost:</strong> ${safeStringify(analysis.facility.cost)}</p>`;
      }
    }

    html += `</div>`;
  }

  // Selected Business Images
  if (selectedImages && selectedImages.length > 0) {
    html += `
        <div class="section">
            <h2>BUSINESS IMAGES</h2>
            <div class="image-grid">`;
    
    selectedImages.forEach(imagePath => {
      html += `<img src="${imagePath}" alt="Business Image" class="business-image">`;
    });
    
    html += `
            </div>
        </div>`;
  }

  // Contact Information Footer
  if (userProfile) {
    html += generateContactFooter(userProfile);
  }

  html += `
    </div>
</body>
</html>`;

  return html;
}

export function formatTextContent(analysis: any, userProfile?: any): string {
  let content = 'CONFIDENTIAL INFORMATION MEMORANDUM\n\n';

  // Business Overview
  if (analysis.story) {
    content += '# BUSINESS OVERVIEW\n\n';
    
    if (analysis.story.businessSummary) {
      content += `Business Summary: ${safeStringify(analysis.story.businessSummary)}\n\n`;
    }
    
    if (analysis.story.businessModel) {
      content += `Business Model: ${safeStringify(analysis.story.businessModel)}\n\n`;
    }
    
    if (analysis.story.yearStarted) {
      content += `Year Started: ${safeStringify(analysis.story.yearStarted)}\n\n`;
    }
    
    if (analysis.story.businessStructure) {
      content += `Business Structure: ${safeStringify(analysis.story.businessStructure)}\n\n`;
    }

    if (analysis.story.keyAttractions && analysis.story.keyAttractions.length > 0) {
      content += 'Key Attractions:\n';
      analysis.story.keyAttractions.forEach((attraction: string) => {
        content += `- ${safeStringify(attraction)}\n`;
      });
      content += '\n';
    }
  }

  // Executive Summary
  if (analysis.executiveSummary) {
    content += '# EXECUTIVE SUMMARY\n\n';
    
    if (analysis.executiveSummary.buyerAttractions && analysis.executiveSummary.buyerAttractions.length > 0) {
      content += 'Buyer Attractions:\n';
      analysis.executiveSummary.buyerAttractions.forEach((attraction: string) => {
        content += `- ${safeStringify(attraction)}\n`;
      });
      content += '\n';
    }

    if (analysis.executiveSummary.growthOpportunities && analysis.executiveSummary.growthOpportunities.length > 0) {
      content += 'Growth Opportunities:\n';
      analysis.executiveSummary.growthOpportunities.forEach((opportunity: string) => {
        content += `- ${safeStringify(opportunity)}\n`;
      });
      content += '\n';
    }
  }

  // Market Analysis
  if (analysis.marketAnalysis) {
    content += '# MARKET ANALYSIS\n\n';

    if (analysis.marketAnalysis.uniqueFeatures && analysis.marketAnalysis.uniqueFeatures.length > 0) {
      content += 'Unique Features & Competitive Advantages:\n';
      analysis.marketAnalysis.uniqueFeatures.forEach((feature: string) => {
        content += `- ${safeStringify(feature)}\n`;
      });
      content += '\n';
    }

    if (analysis.marketAnalysis.customerProfile) {
      content += `Customer Profile: ${safeStringify(analysis.marketAnalysis.customerProfile)}\n\n`;
    }

    if (analysis.marketAnalysis.competitors && analysis.marketAnalysis.competitors.length > 0) {
      content += 'Competitive Landscape:\n';
      analysis.marketAnalysis.competitors.forEach((competitor: string) => {
        content += `- ${safeStringify(competitor)}\n`;
      });
      content += '\n';
    }
  }

  // Operations
  if (analysis.operations) {
    content += '# OPERATIONS\n\n';

    if (analysis.operations.suppliers) {
      content += 'Supplier Information:\n';
      if (analysis.operations.suppliers.count) {
        content += `- Count: ${safeStringify(analysis.operations.suppliers.count)}\n`;
      }
      if (analysis.operations.suppliers.concentration) {
        content += `- Concentration: ${safeStringify(analysis.operations.suppliers.concentration)}\n`;
      }
      if (analysis.operations.suppliers.terms) {
        content += `- Terms: ${safeStringify(analysis.operations.suppliers.terms)}\n`;
      }
      content += '\n';
    }

    if (analysis.operations.customers) {
      content += 'Customer Information:\n';
      if (analysis.operations.customers.recurring) {
        content += `- Recurring: ${safeStringify(analysis.operations.customers.recurring)}\n`;
      }
      if (analysis.operations.customers.concentration) {
        content += `- Concentration: ${safeStringify(analysis.operations.customers.concentration)}\n`;
      }
      if (analysis.operations.customers.relationships) {
        content += `- Relationships: ${safeStringify(analysis.operations.customers.relationships)}\n`;
      }
      content += '\n';
    }
  }

  // Sales & Marketing
  if (analysis.sales || analysis.marketing) {
    content += '# SALES & MARKETING\n\n';

    if (analysis.sales) {
      if (analysis.sales.channels && typeof analysis.sales.channels === 'object') {
        content += 'Sales Channels:\n';
        Object.entries(analysis.sales.channels).forEach(([channel, percentage]: [string, any]) => {
          content += `- ${channel}: ${safeStringify(percentage)}%\n`;
        });
        content += '\n';
      }

      if (analysis.sales.averageOrderValue) {
        content += `Average Order Value: ${safeStringify(analysis.sales.averageOrderValue)}\n\n`;
      }

      if (analysis.sales.seasonality) {
        content += `Seasonality: ${safeStringify(analysis.sales.seasonality)}\n\n`;
      }
    }

    if (analysis.marketing) {
      if (analysis.marketing.strategies && analysis.marketing.strategies.length > 0) {
        content += 'Marketing Strategies:\n';
        analysis.marketing.strategies.forEach((strategy: string) => {
          content += `- ${safeStringify(strategy)}\n`;
        });
        content += '\n';
      }

      if (analysis.marketing.emailMarketing) {
        content += `Email Marketing: ${safeStringify(analysis.marketing.emailMarketing.listSize)} list size, ${safeStringify(analysis.marketing.emailMarketing.usage)}\n\n`;
      }
    }
  }

  // Team Structure
  if (analysis.team) {
    content += '# TEAM STRUCTURE\n\n';

    if (analysis.team.employeeSummary) {
      content += `Employee Summary: ${safeStringify(analysis.team.employeeSummary)}\n\n`;
    }

    if (analysis.team.ownerResponsibilities) {
      content += `Owner Responsibilities: ${safeStringify(analysis.team.ownerResponsibilities)}\n\n`;
    }

    if (analysis.team.ownerHours) {
      content += `Owner Hours: ${safeStringify(analysis.team.ownerHours)}\n\n`;
    }

    if (analysis.team.keyEmployees && analysis.team.keyEmployees.length > 0) {
      content += 'Key Employees:\n';
      analysis.team.keyEmployees.forEach((employee: string) => {
        content += `- ${safeStringify(employee)}\n`;
      });
      content += '\n';
    }
  }

  // Assets & Facility
  if (analysis.assets || analysis.facility) {
    content += '# ASSETS & FACILITY\n\n';

    if (analysis.assets) {
      if (analysis.assets.location) {
        content += `Location: ${safeStringify(analysis.assets.location)}\n\n`;
      }

      if (analysis.assets.equipmentValue) {
        content += `Equipment Value: ${safeStringify(analysis.assets.equipmentValue)}\n\n`;
      }

      if (analysis.assets.digitalAssets && analysis.assets.digitalAssets.length > 0) {
        content += 'Digital Assets:\n';
        analysis.assets.digitalAssets.forEach((asset: string) => {
          content += `- ${safeStringify(asset)}\n`;
        });
        content += '\n';
      }
    }

    if (analysis.facility) {
      content += 'Facility Details:\n';
      if (analysis.facility.ownership) {
        content += `- Ownership: ${safeStringify(analysis.facility.ownership)}\n`;
      }
      if (analysis.facility.size) {
        content += `- Size: ${safeStringify(analysis.facility.size)}\n`;
      }
      if (analysis.facility.cost) {
        content += `- Cost: ${safeStringify(analysis.facility.cost)}\n`;
      }
      content += '\n';
    }
  }

  // Contact Information
  if (userProfile) {
    content += '# CONTACT INFORMATION\n\n';
    if (userProfile.name) {
      content += `${userProfile.name}\n`;
    }
    if (userProfile.title) {
      content += `${userProfile.title}\n`;
    }
    if (userProfile.phoneNumber) {
      content += `Phone: ${userProfile.phoneNumber}\n`;
    }
    if (userProfile.email) {
      content += `Email: ${userProfile.email}\n`;
    }
    if (userProfile.company) {
      content += `Company: ${userProfile.company}\n`;
    }
  }

  return content;
}

function generateContactFooter(userProfile: any): string {
  return `
        <div class="contact-footer">
            <h2>CONTACT INFORMATION</h2>
            ${userProfile.profilePhoto ? `<img src="${userProfile.profilePhoto}" alt="Profile Photo" class="profile-photo">` : ''}
            ${userProfile.name ? `<p><strong>${userProfile.name}</strong></p>` : ''}
            ${userProfile.title ? `<p>${userProfile.title}</p>` : ''}
            ${userProfile.phoneNumber ? `<p>Phone: ${userProfile.phoneNumber}</p>` : ''}
            ${userProfile.email ? `<p>Email: ${userProfile.email}</p>` : ''}
            ${userProfile.company ? `<p>Company: ${userProfile.company}</p>` : ''}
        </div>`;
}

export async function generateWordDocument(analysis: any, logoUrl?: string | null, websiteUrl?: string, selectedImages?: string[], userProfile?: any, financialData?: any): Promise<Buffer> {
  const sections: docx.ISectionOptions[] = [];
  const paragraphs: docx.Paragraph[] = [];

  // Title page
  paragraphs.push(
    new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: "CONFIDENTIAL INFORMATION MEMORANDUM",
          bold: true,
          size: 32,
          color: "2563EB"
        })
      ],
      alignment: docx.AlignmentType.CENTER,
      spacing: { before: 400, after: 400 }
    })
  );

  // Add logo if available
  if (logoUrl) {
    try {
      const logoPath = resolveImagePath(logoUrl);
      if (fs.existsSync(logoPath)) {
        paragraphs.push(
          new docx.Paragraph({
            children: [
              new docx.ImageRun({
                data: fs.readFileSync(logoPath),
                transformation: {
                  width: 200,
                  height: 100
                }
              })
            ],
            alignment: docx.AlignmentType.CENTER,
            spacing: { before: 200, after: 200 }
          })
        );
      }
    } catch (error) {
      console.error("Failed to add logo to Word document:", error);
    }
  }

  // Business Overview Section
  if (analysis.story) {
    paragraphs.push(
      new docx.Paragraph({
        text: "BUSINESS OVERVIEW",
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    if (analysis.story.businessSummary) {
      paragraphs.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: "Business Summary: ",
              bold: true
            }),
            new docx.TextRun({
              text: safeStringify(analysis.story.businessSummary)
            })
          ],
          spacing: { before: 100, after: 100 }
        })
      );
    }

    if (analysis.story.businessModel) {
      paragraphs.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: "Business Model: ",
              bold: true
            }),
            new docx.TextRun({
              text: safeStringify(analysis.story.businessModel)
            })
          ],
          spacing: { before: 100, after: 100 }
        })
      );
    }

    if (analysis.story.yearStarted) {
      paragraphs.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: "Year Started: ",
              bold: true
            }),
            new docx.TextRun({
              text: safeStringify(analysis.story.yearStarted)
            })
          ],
          spacing: { before: 100, after: 100 }
        })
      );
    }

    if (analysis.story.keyAttractions && analysis.story.keyAttractions.length > 0) {
      paragraphs.push(
        new docx.Paragraph({
          text: "Key Attractions:",
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );

      analysis.story.keyAttractions.forEach((attraction: string) => {
        paragraphs.push(
          new docx.Paragraph({
            text: `• ${safeStringify(attraction)}`,
            spacing: { before: 50 }
          })
        );
      });
    }
  }

  // Add other sections following the same pattern...
  // (Executive Summary, Market Analysis, Operations, etc.)

  // Contact information header
  paragraphs.push(
    new docx.Paragraph({
      text: "Contact Information",
      heading: docx.HeadingLevel.HEADING_2,
      alignment: docx.AlignmentType.CENTER,
      spacing: { before: 100, after: 200 }
    })
  );

  // Add profile photo if available
  if (userProfile?.profilePhoto) {
    try {
      const profilePhotoPath = resolveImagePath(userProfile.profilePhoto);
      if (fs.existsSync(profilePhotoPath)) {
        paragraphs.push(
          new docx.Paragraph({
            children: [
              new docx.ImageRun({
                data: fs.readFileSync(profilePhotoPath),
                transformation: {
                  width: 120,
                  height: 120
                }
              })
            ],
            alignment: docx.AlignmentType.CENTER,
            spacing: { before: 100, after: 100 }
          })
        );
      }
    } catch (error) {
      console.error("Failed to add profile photo to Word document:", error);
    }
  }

  if (userProfile?.name) {
    paragraphs.push(
      new docx.Paragraph({
        text: userProfile.name,
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 100 }
      })
    );
  }

  if (userProfile?.title) {
    paragraphs.push(
      new docx.Paragraph({
        text: userProfile.title,
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 50 }
      })
    );
  }

  if (userProfile?.phoneNumber) {
    paragraphs.push(
      new docx.Paragraph({
        text: `Phone: ${userProfile.phoneNumber}`,
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 50 }
      })
    );
  }

  if (userProfile?.email) {
    paragraphs.push(
      new docx.Paragraph({
        text: `Email: ${userProfile.email}`,
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 50 }
      })
    );
  }

  // Create the document
  const doc = new docx.Document({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  });

  return await docx.Packer.toBuffer(doc);
}

export async function generatePDF(analysis: any, logoUrl?: string | null, websiteUrl?: string, selectedImages?: string[], userProfile?: any, financialData?: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
    doc.on('error', reject);

    try {
      // Title page
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#2563eb')
         .text('CONFIDENTIAL INFORMATION MEMORANDUM', { align: 'center' });
      
      doc.moveDown(2);

      // Add logo if available
      if (logoUrl) {
        try {
          const logoPath = resolveImagePath(logoUrl);
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, doc.page.width - 150, 30, {
              fit: [100, 50],
              align: 'right'
            });
          }
        } catch (error) {
          console.error("Failed to add logo to PDF:", error);
        }
      }

      // Business Overview Section
      if (analysis.story) {
        doc.addPage();
        
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('BUSINESS OVERVIEW')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);

        if (analysis.story.businessSummary) {
          doc.font('Helvetica-Bold').text('Business Summary: ', { continued: true });
          doc.font('Helvetica').text(safeStringify(analysis.story.businessSummary));
          doc.moveDown(0.5);
        }

        if (analysis.story.businessModel) {
          doc.font('Helvetica-Bold').text('Business Model: ', { continued: true });
          doc.font('Helvetica').text(safeStringify(analysis.story.businessModel));
          doc.moveDown(0.5);
        }

        if (analysis.story.yearStarted) {
          doc.font('Helvetica-Bold').text('Year Started: ', { continued: true });
          doc.font('Helvetica').text(safeStringify(analysis.story.yearStarted));
          doc.moveDown(0.5);
        }

        if (analysis.story.keyAttractions && analysis.story.keyAttractions.length > 0) {
          doc.moveDown(1);
          doc.font('Helvetica-Bold').text('Key Attractions:');
          analysis.story.keyAttractions.forEach((attraction: string) => {
            doc.font('Helvetica').text(`• ${safeStringify(attraction)}`, { indent: 20 });
          });
        }
      }

      // Market Analysis Section
      if (analysis.marketAnalysis) {
        doc.addPage();
        
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('MARKET ANALYSIS')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);

        if (analysis.marketAnalysis.uniqueFeatures && analysis.marketAnalysis.uniqueFeatures.length > 0) {
          doc.font('Helvetica-Bold').text('Unique Features & Competitive Advantages:');
          analysis.marketAnalysis.uniqueFeatures.forEach((feature: string) => {
            doc.font('Helvetica').text(`• ${safeStringify(feature)}`, { indent: 20 });
          });
          doc.moveDown(1);
        }

        if (analysis.marketAnalysis.customerProfile) {
          doc.font('Helvetica-Bold').text('Customer Profile: ', { continued: true });
          doc.font('Helvetica').text(safeStringify(analysis.marketAnalysis.customerProfile));
          doc.moveDown(0.5);
        }
      }

      // Financial Information
      if (financialData && Object.keys(financialData).length > 0) {
        doc.addPage();
        
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('FINANCIAL INFORMATION')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);

        Object.entries(financialData).forEach(([key, value]: [string, any]) => {
          if (value && typeof value === 'object' && value.value !== undefined) {
            doc.font('Helvetica-Bold').text(`${value.title || key}: `, { continued: true });
            doc.font('Helvetica').text(safeStringify(value.value));
            if (value.description) {
              doc.fontSize(10).text(safeStringify(value.description), { indent: 20 });
              doc.fontSize(12);
            }
            doc.moveDown(0.5);
          }
        });
      }

      // Contact Information
      if (userProfile) {
        doc.moveDown(3);
        
        // Add a horizontal line
        doc.moveTo(50, doc.y)
           .lineTo(doc.page.width - 50, doc.y)
           .stroke();
        
        doc.moveDown(1);
        
        // Contact Information header
        doc.fontSize(14)
           .text('Contact Information', { align: 'center' });
        
        doc.moveDown(1);
        
        // Add profile photo if available
        if (userProfile.profilePhoto) {
          try {
            const profilePhotoPath = resolveImagePath(userProfile.profilePhoto);
            if (fs.existsSync(profilePhotoPath)) {
              const centerX = doc.page.width / 2 - 60; // Center the 120px wide image
              doc.image(profilePhotoPath, centerX, doc.y, {
                fit: [120, 120]
              });
              doc.moveDown(8); // Move down to account for image height
            }
          } catch (error) {
            console.error("Failed to add profile photo to PDF:", error);
          }
        }
        
        if (userProfile.name) {
          doc.fontSize(12)
             .text(userProfile.name, { align: 'center' });
        }
        
        if (userProfile.title) {
          doc.text(userProfile.title, { align: 'center' });
        }
        
        if (userProfile.phoneNumber) {
          doc.text(`Phone: ${userProfile.phoneNumber}`, { align: 'center' });
        }
        
        if (userProfile.email) {
          doc.text(`Email: ${userProfile.email}`, { align: 'center' });
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function exportToGoogleDocs(analysis: any, title: string): Promise<string> {
  // This is a placeholder - the actual implementation is in google-auth.ts
  throw new Error("Google Docs export not implemented in this file");
}