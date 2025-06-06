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
  const title = analysis.title || 'CONFIDENTIAL INFORMATION MEMORANDUM';
  
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
  if ((financialData && financialData.enabled) || (analysis.financials)) {
    html += `
        <div class="section financial-section">
            <h2>FINANCIAL INFORMATION</h2>
            <div class="financial-grid">`;

    // Include CIM document financial fields if enabled and included
    if (financialData && financialData.enabled) {
      if (financialData.askingPriceIncluded && financialData.askingPrice) {
        html += `
                <div class="financial-card">
                    <div class="financial-title">Asking Price</div>
                    <div style="font-size: 1.2em; font-weight: bold; color: #059669;">${safeStringify(financialData.askingPrice)}</div>
                </div>`;
      }
      if (financialData.revenueIncluded && financialData.revenue) {
        html += `
                <div class="financial-card">
                    <div class="financial-title">Annual Revenue</div>
                    <div style="font-size: 1.2em; font-weight: bold; color: #2563eb;">${safeStringify(financialData.revenue)}</div>
                </div>`;
      }
      if (financialData.ebitdaIncluded && financialData.ebitda) {
        html += `
                <div class="financial-card">
                    <div class="financial-title">EBITDA</div>
                    <div style="font-size: 1.2em; font-weight: bold; color: #7c3aed;">${safeStringify(financialData.ebitda)}</div>
                </div>`;
      }
    }

    // Include analysis financial data if available
    if (analysis.financials) {
      if (analysis.financials.revenue) {
        if (analysis.financials.revenue.total) {
          html += `
                <div class="financial-card">
                    <div class="financial-title">Total Revenue</div>
                    <div>${safeStringify(analysis.financials.revenue.total)}</div>
                </div>`;
        }
        if (analysis.financials.revenue.breakdown && typeof analysis.financials.revenue.breakdown === 'object') {
          Object.entries(analysis.financials.revenue.breakdown).forEach(([source, amount]: [string, any]) => {
            html += `
                <div class="financial-card">
                    <div class="financial-title">${source} Revenue</div>
                    <div>${safeStringify(amount)}</div>
                </div>`;
          });
        }
      }
      if (analysis.financials.customerMetrics) {
        if (analysis.financials.customerMetrics.averageOrderValue) {
          html += `
                <div class="financial-card">
                    <div class="financial-title">Average Order Value</div>
                    <div>${safeStringify(analysis.financials.customerMetrics.averageOrderValue)}</div>
                </div>`;
        }
        if (analysis.financials.customerMetrics.recurring) {
          html += `
                <div class="financial-card">
                    <div class="financial-title">Recurring Revenue</div>
                    <div>${safeStringify(analysis.financials.customerMetrics.recurring)}</div>
                </div>`;
        }
      }
    }

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

      if (analysis.sales.competitivePricing) {
        html += `<p><strong>Competitive Pricing:</strong> ${safeStringify(analysis.sales.competitivePricing)}</p>`;
      }

      if (analysis.sales.pricingModel) {
        html += `<p><strong>Pricing Model:</strong> ${safeStringify(analysis.sales.pricingModel)}</p>`;
      }

      if (analysis.sales.contractTerms) {
        html += `<p><strong>Contract Terms:</strong> ${safeStringify(analysis.sales.contractTerms)}</p>`;
      }

      if (analysis.sales.paymentMethods && analysis.sales.paymentMethods.length > 0) {
        html += `
            <h3>Payment Methods</h3>
            <ul>`;
        analysis.sales.paymentMethods.forEach((method: string) => {
          html += `<li>${safeStringify(method)}</li>`;
        });
        html += `</ul>`;
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

      if (analysis.marketing.clientAcquisition) {
        html += `<p><strong>Client Acquisition:</strong> ${safeStringify(analysis.marketing.clientAcquisition)}</p>`;
      }

      if (analysis.marketing.seoEfforts) {
        html += `<p><strong>SEO Efforts:</strong> ${safeStringify(analysis.marketing.seoEfforts)}</p>`;
      }

      if (analysis.marketing.paidAdvertising) {
        html += `<h3>Paid Advertising</h3>`;
        if (analysis.marketing.paidAdvertising.channels && analysis.marketing.paidAdvertising.channels.length > 0) {
          html += `
            <p><strong>Channels:</strong></p>
            <ul>`;
          analysis.marketing.paidAdvertising.channels.forEach((channel: string) => {
            html += `<li>${safeStringify(channel)}</li>`;
          });
          html += `</ul>`;
        }
        if (analysis.marketing.paidAdvertising.effectiveness) {
          html += `<p><strong>Effectiveness:</strong> ${safeStringify(analysis.marketing.paidAdvertising.effectiveness)}</p>`;
        }
      }

      if (analysis.marketing.emailMarketing) {
        html += `<h3>Email Marketing</h3>`;
        if (analysis.marketing.emailMarketing.listSize) {
          html += `<p><strong>List Size:</strong> ${safeStringify(analysis.marketing.emailMarketing.listSize)}</p>`;
        }
        if (analysis.marketing.emailMarketing.usage) {
          html += `<p><strong>Usage:</strong> ${safeStringify(analysis.marketing.emailMarketing.usage)}</p>`;
        }
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

    if (analysis.team.employeeCount) {
      html += `<p><strong>Total Employees:</strong> ${safeStringify(analysis.team.employeeCount)}</p>`;
    }

    if (analysis.team.contractorCount) {
      html += `<p><strong>Contractors:</strong> ${safeStringify(analysis.team.contractorCount)}</p>`;
    }

    if (analysis.team.ownerResponsibilities) {
      html += `<p><strong>Owner Responsibilities:</strong> ${safeStringify(analysis.team.ownerResponsibilities)}</p>`;
    }

    if (analysis.team.ownerHours) {
      html += `<p><strong>Owner Hours:</strong> ${safeStringify(analysis.team.ownerHours)}</p>`;
    }

    if (analysis.team.turnover) {
      html += `<p><strong>Employee Turnover:</strong> ${safeStringify(analysis.team.turnover)}</p>`;
    }

    if (analysis.team.hiring) {
      html += `<p><strong>Hiring Process:</strong> ${safeStringify(analysis.team.hiring)}</p>`;
    }

    if (analysis.team.retention) {
      html += `<p><strong>Retention:</strong> ${safeStringify(analysis.team.retention)}</p>`;
    }

    if (analysis.team.organization) {
      html += `<p><strong>Organization:</strong> ${safeStringify(analysis.team.organization)}</p>`;
    }

    if (analysis.team.management) {
      html += `<p><strong>Management Structure:</strong> ${safeStringify(analysis.team.management)}</p>`;
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

  // Inventory
  if (analysis.inventory) {
    html += `
        <div class="section">
            <h2>INVENTORY MANAGEMENT</h2>`;

    if (analysis.inventory.value) {
      html += `<p><strong>Inventory Value:</strong> ${safeStringify(analysis.inventory.value)}</p>`;
    }

    if (analysis.inventory.skuCount) {
      html += `<p><strong>SKU Count:</strong> ${safeStringify(analysis.inventory.skuCount)}</p>`;
    }

    if (analysis.inventory.leadTime) {
      html += `<p><strong>Lead Time:</strong> ${safeStringify(analysis.inventory.leadTime)}</p>`;
    }

    if (analysis.inventory.sourcing) {
      html += `<p><strong>Sourcing:</strong> ${safeStringify(analysis.inventory.sourcing)}</p>`;
    }

    if (analysis.inventory.storage) {
      html += `<p><strong>Storage:</strong> ${safeStringify(analysis.inventory.storage)}</p>`;
    }

    if (analysis.inventory.topProducts && analysis.inventory.topProducts.length > 0) {
      html += `
            <h3>Top Products</h3>
            <ul>`;
      analysis.inventory.topProducts.forEach((product: string) => {
        html += `<li>${safeStringify(product)}</li>`;
      });
      html += `</ul>`;
    }

    html += `</div>`;
  }

  // Ownership Structure
  if (analysis.ownership) {
    html += `
        <div class="section">
            <h2>OWNERSHIP STRUCTURE</h2>`;

    if (analysis.ownership.owners && analysis.ownership.owners.length > 0) {
      html += `
            <h3>Ownership Breakdown</h3>
            <div class="two-column">`;
      analysis.ownership.owners.forEach((owner: any) => {
        html += `
                <div class="highlight">
                    <p><strong>${safeStringify(owner.name)}</strong></p>
                    <p>Ownership: ${safeStringify(owner.percentage)}</p>
                    <p>Background: ${safeStringify(owner.background)}</p>
                </div>`;
      });
      html += `</div>`;
    }

    if (analysis.ownership.intellectualProperty && analysis.ownership.intellectualProperty.length > 0) {
      html += `
            <h3>Intellectual Property</h3>
            <ul>`;
      analysis.ownership.intellectualProperty.forEach((ip: string) => {
        html += `<li>${safeStringify(ip)}</li>`;
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

      if (analysis.assets.equipmentDetails) {
        html += `<p><strong>Equipment Details:</strong> ${safeStringify(analysis.assets.equipmentDetails)}</p>`;
      }

      if (analysis.assets.inventoryDetails) {
        html += `<p><strong>Inventory Details:</strong> ${safeStringify(analysis.assets.inventoryDetails)}</p>`;
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
      if (analysis.facility.leaseDetails) {
        html += `<p><strong>Lease Details:</strong> ${safeStringify(analysis.facility.leaseDetails)}</p>`;
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

  // Executive Summary
  if (analysis.executiveSummary) {
    paragraphs.push(
      new docx.Paragraph({
        text: "EXECUTIVE SUMMARY",
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    if (analysis.executiveSummary.buyerAttractions && analysis.executiveSummary.buyerAttractions.length > 0) {
      paragraphs.push(
        new docx.Paragraph({
          text: "Buyer Attractions:",
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );

      analysis.executiveSummary.buyerAttractions.forEach((attraction: string) => {
        paragraphs.push(
          new docx.Paragraph({
            text: `• ${safeStringify(attraction)}`,
            spacing: { before: 50 }
          })
        );
      });
    }

    if (analysis.executiveSummary.growthOpportunities && analysis.executiveSummary.growthOpportunities.length > 0) {
      paragraphs.push(
        new docx.Paragraph({
          text: "Growth Opportunities:",
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );

      analysis.executiveSummary.growthOpportunities.forEach((opportunity: string) => {
        paragraphs.push(
          new docx.Paragraph({
            text: `• ${safeStringify(opportunity)}`,
            spacing: { before: 50 }
          })
        );
      });
    }
  }

  // Financial Information
  if ((financialData && financialData.enabled) || analysis.financials) {
    paragraphs.push(
      new docx.Paragraph({
        text: "FINANCIAL INFORMATION",
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    if (financialData && financialData.enabled) {
      if (financialData.askingPriceIncluded && financialData.askingPrice) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Asking Price: ${safeStringify(financialData.askingPrice)}`,
            spacing: { before: 100, after: 50 }
          })
        );
      }
      if (financialData.revenueIncluded && financialData.revenue) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Annual Revenue: ${safeStringify(financialData.revenue)}`,
            spacing: { before: 50, after: 50 }
          })
        );
      }
      if (financialData.ebitdaIncluded && financialData.ebitda) {
        paragraphs.push(
          new docx.Paragraph({
            text: `EBITDA: ${safeStringify(financialData.ebitda)}`,
            spacing: { before: 50, after: 50 }
          })
        );
      }
    }
  }

  // Market Analysis
  if (analysis.marketAnalysis) {
    paragraphs.push(
      new docx.Paragraph({
        text: "MARKET ANALYSIS",
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    if (analysis.marketAnalysis.uniqueFeatures && analysis.marketAnalysis.uniqueFeatures.length > 0) {
      paragraphs.push(
        new docx.Paragraph({
          text: "Unique Features & Competitive Advantages:",
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );

      analysis.marketAnalysis.uniqueFeatures.forEach((feature: string) => {
        paragraphs.push(
          new docx.Paragraph({
            text: `• ${safeStringify(feature)}`,
            spacing: { before: 50 }
          })
        );
      });
    }

    if (analysis.marketAnalysis.customerProfile) {
      paragraphs.push(
        new docx.Paragraph({
          text: `Customer Profile: ${safeStringify(analysis.marketAnalysis.customerProfile)}`,
          spacing: { before: 100, after: 50 }
        })
      );
    }

    if (analysis.marketAnalysis.competitors && analysis.marketAnalysis.competitors.length > 0) {
      paragraphs.push(
        new docx.Paragraph({
          text: "Competitive Landscape:",
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );

      analysis.marketAnalysis.competitors.forEach((competitor: string) => {
        paragraphs.push(
          new docx.Paragraph({
            text: `• ${safeStringify(competitor)}`,
            spacing: { before: 50 }
          })
        );
      });
    }
  }

  // Operations
  if (analysis.operations) {
    paragraphs.push(
      new docx.Paragraph({
        text: "OPERATIONS",
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    if (analysis.operations.suppliers) {
      paragraphs.push(
        new docx.Paragraph({
          text: "Supplier Information:",
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );

      if (analysis.operations.suppliers.count) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Supplier Count: ${safeStringify(analysis.operations.suppliers.count)}`,
            spacing: { before: 50 }
          })
        );
      }
      if (analysis.operations.suppliers.concentration) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Concentration: ${safeStringify(analysis.operations.suppliers.concentration)}`,
            spacing: { before: 50 }
          })
        );
      }
    }

    if (analysis.operations.customers) {
      paragraphs.push(
        new docx.Paragraph({
          text: "Customer Information:",
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );

      if (analysis.operations.customers.recurring) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Recurring Customers: ${safeStringify(analysis.operations.customers.recurring)}`,
            spacing: { before: 50 }
          })
        );
      }
      if (analysis.operations.customers.concentration) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Concentration: ${safeStringify(analysis.operations.customers.concentration)}`,
            spacing: { before: 50 }
          })
        );
      }
    }
  }

  // Sales & Marketing
  if (analysis.sales || analysis.marketing) {
    paragraphs.push(
      new docx.Paragraph({
        text: "SALES & MARKETING",
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    if (analysis.sales) {
      if (analysis.sales.averageOrderValue) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Average Order Value: ${safeStringify(analysis.sales.averageOrderValue)}`,
            spacing: { before: 100, after: 50 }
          })
        );
      }
      if (analysis.sales.seasonality) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Seasonality: ${safeStringify(analysis.sales.seasonality)}`,
            spacing: { before: 50, after: 50 }
          })
        );
      }
    }

    if (analysis.marketing && analysis.marketing.strategies && analysis.marketing.strategies.length > 0) {
      paragraphs.push(
        new docx.Paragraph({
          text: "Marketing Strategies:",
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );

      analysis.marketing.strategies.forEach((strategy: string) => {
        paragraphs.push(
          new docx.Paragraph({
            text: `• ${safeStringify(strategy)}`,
            spacing: { before: 50 }
          })
        );
      });
    }
  }

  // Team Structure
  if (analysis.team) {
    paragraphs.push(
      new docx.Paragraph({
        text: "TEAM STRUCTURE",
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    if (analysis.team.employeeSummary) {
      paragraphs.push(
        new docx.Paragraph({
          text: `Employee Summary: ${safeStringify(analysis.team.employeeSummary)}`,
          spacing: { before: 100, after: 50 }
        })
      );
    }
    if (analysis.team.ownerResponsibilities) {
      paragraphs.push(
        new docx.Paragraph({
          text: `Owner Responsibilities: ${safeStringify(analysis.team.ownerResponsibilities)}`,
          spacing: { before: 50, after: 50 }
        })
      );
    }
    if (analysis.team.ownerHours) {
      paragraphs.push(
        new docx.Paragraph({
          text: `Owner Hours: ${safeStringify(analysis.team.ownerHours)}`,
          spacing: { before: 50, after: 50 }
        })
      );
    }
  }

  // Assets & Facility
  if (analysis.assets || analysis.facility) {
    paragraphs.push(
      new docx.Paragraph({
        text: "ASSETS & FACILITY",
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    if (analysis.assets) {
      if (analysis.assets.location) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Location: ${safeStringify(analysis.assets.location)}`,
            spacing: { before: 100, after: 50 }
          })
        );
      }
      if (analysis.assets.equipmentValue) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Equipment Value: ${safeStringify(analysis.assets.equipmentValue)}`,
            spacing: { before: 50, after: 50 }
          })
        );
      }
    }

    if (analysis.facility) {
      if (analysis.facility.ownership) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Facility Ownership: ${safeStringify(analysis.facility.ownership)}`,
            spacing: { before: 50, after: 50 }
          })
        );
      }
      if (analysis.facility.size) {
        paragraphs.push(
          new docx.Paragraph({
            text: `Facility Size: ${safeStringify(analysis.facility.size)}`,
            spacing: { before: 50, after: 50 }
          })
        );
      }
    }
  }

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

export async function generatePDF(analysis: any, logoUrl?: string | null, websiteUrl?: string, selectedImages?: string[], userProfile?: any, financialData?: any, financialFiles?: any[], baseUrl?: string, documentTitle?: string, customSections?: any[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
    doc.on('error', reject);

    try {
      // Debug logging for PDF generation
      console.log("=== PDF Generation Debug ===");
      console.log("User Profile received:", JSON.stringify(userProfile, null, 2));
      console.log("Custom Sections count:", customSections ? customSections.length : 0);
      console.log("Custom Sections data:", JSON.stringify(customSections, null, 2));
      console.log("Selected Images count:", selectedImages ? selectedImages.length : 0);
      console.log("===========================");
      
      // Extract title from analysis or use provided documentTitle
      const title = documentTitle || analysis?.title || 'Confidential Information Memorandum';
      
      // Title page with modern design - using only the document title
      if (title && title !== 'Comprehensive Business Overview') {
        doc.fontSize(28)
           .font('Helvetica-Bold')
           .fillColor('#1e293b')
           .text(title, { align: 'center' });
        doc.moveDown(2);
      }

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

      // Financial Information Section (if enabled) - remove icons and clean formatting
      if (financialData && financialData.enabled) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('FINANCIAL INFORMATION')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);

        // Create a table-like layout for financial data
        const tableData = [];
        if (financialData.askingPriceIncluded && financialData.askingPrice) {
          tableData.push(['Asking Price:', `$${parseInt(financialData.askingPrice).toLocaleString()}`]);
        }
        if (financialData.revenueIncluded && financialData.revenue) {
          tableData.push(['Annual Revenue:', `$${parseInt(financialData.revenue).toLocaleString()}`]);
        }
        if (financialData.ebitdaIncluded && financialData.ebitda) {
          tableData.push(['EBITDA:', `$${parseInt(financialData.ebitda).toLocaleString()}`]);
        }

        // Draw financial data in a clean, aligned format
        if (tableData.length > 0) {
          tableData.forEach(([label, value]) => {
            doc.font('Helvetica-Bold')
               .fillColor('#000000')
               .text(label, { continued: true });
            
            doc.font('Helvetica')
               .fillColor('#2563eb')
               .text(`  ${value}`);
            
            doc.moveDown(0.5);
          });
        }
        
        // Add financial files section with hyperlinks
        if (financialFiles && financialFiles.length > 0) {
          const includedFiles = financialFiles.filter(file => file.included !== false);
          if (includedFiles.length > 0) {
            doc.moveDown(1);
            doc.font('Helvetica-Bold').text('Additional Financial Documents:');
            doc.moveDown(0.5);
            
            includedFiles.forEach((file: any) => {
              // Use the dynamic base URL for file downloads
              const domain = baseUrl || 'https://cb1f9736-4a0a-4a40-80bd-c08d8761dbaa-00-1y6o4mf3nu2bh.riker.replit.dev';
              const downloadUrl = `${domain}/api/cim/${file.cimDocumentId}/financial-files/${file.id}/download`;
              doc.font('Helvetica')
                 .fillColor('#2563eb')
                 .text(file.originalName, {
                   link: downloadUrl,
                   underline: true
                 });
              doc.fillColor('#000000');
              doc.moveDown(0.3);
            });
          }
        }
        
        // Note about financial documents
        doc.moveDown(1);
        doc.fontSize(10)
           .fillColor('#666666')
           .text('Note: Additional financial documents may be available upon request.');
        
        doc.moveDown(2);
      }

      // Website URL Section (moved after financials)
      if (websiteUrl) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('Website')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);
        doc.fontSize(12)
           .fillColor('#2563eb')
           .text(websiteUrl, {
             link: websiteUrl,
             underline: true,
             align: 'center'
           });
        doc.fillColor('#000000');
        doc.moveDown(2);
      }

      // Custom Sections (in their proper order)
      if (customSections && customSections.length > 0) {
        // Sort custom sections by position
        const sortedCustomSections = [...customSections].sort((a, b) => a.position - b.position);
        
        sortedCustomSections.forEach((customSection) => {
          doc.fontSize(18)
             .font('Helvetica-Bold')
             .fillColor('#2563eb')
             .text(customSection.title || 'Custom Section')
             .fillColor('#000000')
             .font('Helvetica')
             .fontSize(12);
          
          doc.moveDown(1);
          
          if (customSection.type === 'text' && customSection.content) {
            // Handle markdown-style content by converting to plain text
            const content = customSection.content
              .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
              .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
              .replace(/^#+\s+/gm, '') // Remove headers
              .replace(/^[-*]\s+/gm, '• ') // Convert bullet points
              .trim();
            
            doc.font('Helvetica').text(content, {
              align: 'left',
              lineGap: 4
            });
          } else if (customSection.type === 'image' && customSection.imageUrls && customSection.imageUrls.length > 0) {
            // Handle custom image sections
            const imageWidth = 220;
            const imageHeight = 165;
            const horizontalMargin = 25;
            const verticalMargin = 30;
            const imagesPerRow = 2;
            
            const totalImageWidth = (imageWidth * imagesPerRow) + (horizontalMargin * (imagesPerRow - 1));
            const startX = (doc.page.width - totalImageWidth) / 2;
            let currentY = doc.y;
            
            customSection.imageUrls.forEach((imageUrl: string, index: number) => {
              try {
                const imagePath = resolveImagePath(imageUrl);
                if (fs.existsSync(imagePath)) {
                  const col = index % imagesPerRow;
                  const row = Math.floor(index / imagesPerRow);
                  
                  const finalX = startX + (col * (imageWidth + horizontalMargin));
                  const finalY = currentY + (row * (imageHeight + verticalMargin));
                  
                  doc.image(imagePath, finalX, finalY, {
                    fit: [imageWidth, imageHeight],
                    align: 'center'
                  });
                }
              } catch (error) {
                console.error(`Failed to add custom section image ${imageUrl} to PDF:`, error);
              }
            });
            
            // Calculate how much space the images took
            const rows = Math.ceil(customSection.imageUrls.length / imagesPerRow);
            const totalImageHeight = rows * imageHeight + (rows - 1) * verticalMargin;
            doc.y = currentY + totalImageHeight;
          }
          
          doc.moveDown(2);
        });
      }

      // Business Images Section
      if (selectedImages && selectedImages.length > 0) {
        doc.addPage();
        
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('BUSINESS IMAGES')
           .fillColor('#000000');
        
        doc.moveDown(2);
        
        // Calculate layout parameters
        const pageMargin = 50;
        const imageWidth = 220;
        const imageHeight = 165;
        const horizontalMargin = 25;
        const verticalMargin = 30;
        const imagesPerRow = 2; // Fixed 2 images per row for better layout
        
        // Calculate starting positions
        const totalImageWidth = (imageWidth * imagesPerRow) + (horizontalMargin * (imagesPerRow - 1));
        const startX = (doc.page.width - totalImageWidth) / 2; // Center the images
        let currentRow = 0;
        let currentY = doc.y;
        
        for (let i = 0; i < selectedImages.length; i++) {
          try {
            const imagePath = resolveImagePath(selectedImages[i]);
            if (fs.existsSync(imagePath)) {
              // Calculate position in grid
              const col = i % imagesPerRow;
              const row = Math.floor(i / imagesPerRow);
              
              // Check if we need a new page
              const imageY = currentY + (row - currentRow) * (imageHeight + verticalMargin);
              if (imageY + imageHeight > doc.page.height - pageMargin) {
                doc.addPage();
                
                // Add section header on new page
                doc.fontSize(18)
                   .font('Helvetica-Bold')
                   .fillColor('#2563eb')
                   .text('BUSINESS IMAGES (continued)')
                   .fillColor('#000000');
                
                doc.moveDown(2);
                currentY = doc.y;
                currentRow = row;
              }
              
              // Calculate final position
              const finalX = startX + (col * (imageWidth + horizontalMargin));
              const finalY = currentY + (row - currentRow) * (imageHeight + verticalMargin);
              
              doc.image(imagePath, finalX, finalY, {
                fit: [imageWidth, imageHeight],
                align: 'center'
              });
            }
          } catch (error) {
            console.error(`Failed to add image ${selectedImages[i]} to PDF:`, error);
          }
        }
        
        // Add extra space after images section
        doc.moveDown(3);
      }

      // Flexible Document Sections (modern format) - remove page breaks
      if (analysis.sections && Array.isArray(analysis.sections)) {
        analysis.sections.forEach((section: any, index: number) => {
          doc.fontSize(18)
             .font('Helvetica-Bold')
             .fillColor('#2563eb')
             .text(section.title || `Section ${index + 1}`)
             .fillColor('#000000')
             .font('Helvetica')
             .fontSize(12);
          
          doc.moveDown(1);
          
          if (section.content) {
            // Handle markdown-style content by converting to plain text
            const content = section.content
              .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
              .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
              .replace(/^#+\s+/gm, '') // Remove headers
              .replace(/^[-*]\s+/gm, '• ') // Convert bullet points
              .trim();
            
            doc.font('Helvetica').text(content, {
              align: 'left',
              lineGap: 4
            });
          }
          
          doc.moveDown(2); // Add space between sections instead of page breaks
        });
      } else if (analysis.story) {
        // Fallback to old format if no sections
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('Business Summary')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);

        if (analysis.story.businessSummary) {
          doc.font('Helvetica').text(safeStringify(analysis.story.businessSummary));
          doc.moveDown(1.5);
        }

        if (analysis.story.businessModel) {
          doc.fontSize(16)
             .font('Helvetica-Bold')
             .fillColor('#2563eb')
             .text('Business Model')
             .fillColor('#000000')
             .font('Helvetica')
             .fontSize(12);
          doc.moveDown(0.5);
          doc.font('Helvetica').text(safeStringify(analysis.story.businessModel));
          doc.moveDown(1.5);
        }

        if (analysis.story.keyAttractions && analysis.story.keyAttractions.length > 0) {
          doc.fontSize(16)
             .font('Helvetica-Bold')
             .fillColor('#2563eb')
             .text('Key Attractions')
             .fillColor('#000000')
             .font('Helvetica')
             .fontSize(12);
          doc.moveDown(0.5);
          analysis.story.keyAttractions.forEach((attraction: string) => {
            doc.font('Helvetica').text(`• ${safeStringify(attraction)}`);
            doc.moveDown(0.3);
          });
          doc.moveDown(1.5);
        }
      }

      // Market Analysis Section - remove page break
      if (analysis.marketAnalysis) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('Market Opportunity')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);

        if (analysis.marketAnalysis.uniqueFeatures && analysis.marketAnalysis.uniqueFeatures.length > 0) {
          doc.font('Helvetica').text('The market for this industry is characterized by several competitive advantages:');
          doc.moveDown(0.5);
          analysis.marketAnalysis.uniqueFeatures.forEach((feature: string) => {
            doc.font('Helvetica').text(`• ${safeStringify(feature)}`);
            doc.moveDown(0.3);
          });
          doc.moveDown(1);
        }

        if (analysis.marketAnalysis.customerProfile) {
          doc.font('Helvetica').text(`The company's target market consists of ${safeStringify(analysis.marketAnalysis.customerProfile)}, positioning it advantageously in the competitive landscape.`);
          doc.moveDown(2);
        }
      }

      // Business Model Section - remove page break
      if (analysis.story?.businessModel) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('Business Model')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);
        doc.font('Helvetica').text(`The company's revenue model is structured around ${safeStringify(analysis.story.businessModel)}, which has been instrumental in achieving sustainable growth. Key success factors include operational excellence and market positioning, ensuring long-term profitability in a competitive market environment.`);
        doc.moveDown(2);
      }

      // Operations Section - remove page break
      if (analysis.operations) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('Operations')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);
        doc.font('Helvetica').text('Operational excellence is at the core of the company\'s success. The company maintains strong relationships with suppliers and has built a diverse customer base that underscores operational strengths and market adaptability.');
        doc.moveDown(2);
      }

      // Financial Overview Section - remove page break and clean formatting
      if ((financialData && financialData.enabled) || analysis.financials) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('Financial Overview')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);
        doc.font('Helvetica').text('The financial health of the company is robust, demonstrating strong profitability and operational efficiency. These figures underscore not only the current financial standing but also the potential for future growth and profitability.');
        doc.moveDown(2);
      }

      // Growth Opportunities Section - remove page break
      if (analysis.story?.keyAttractions && analysis.story.keyAttractions.length > 0) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('Growth Opportunities')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);
        doc.font('Helvetica').text('The company is poised for expansion, with significant opportunities identified across multiple areas. Strategic initiatives are underway to capitalize on these opportunities, underpinned by a solid foundation of operational excellence and market insight.');
        doc.moveDown(2);
      }

      // Management & Team Section - remove page break
      if (analysis.team) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#2563eb')
           .text('Management & Team')
           .fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);
        
        doc.moveDown(1);
        doc.font('Helvetica').text('The leadership team comprises individuals with extensive experience in the industry. The organizational structure is designed to promote innovation and efficiency, with a focus on leveraging the team\'s strengths to achieve strategic objectives.');
        doc.moveDown(2);
      }

      // Investment Highlights Section - remove page break
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#2563eb')
         .text('Investment Highlights')
         .fillColor('#000000')
         .font('Helvetica')
         .fontSize(12);
      
      doc.moveDown(1);
      
      let highlightsText = 'Key reasons for investment attractiveness include the company\'s strong market position, robust financial performance, and significant growth potential.';
      
      if (financialData && financialData.enabled) {
        const askingPrice = financialData.askingPriceIncluded && financialData.askingPrice ? `$${parseInt(financialData.askingPrice).toLocaleString()}` : null;
        const revenue = financialData.revenueIncluded && financialData.revenue ? `$${parseInt(financialData.revenue).toLocaleString()}` : null;
        const ebitda = financialData.ebitdaIncluded && financialData.ebitda ? `${parseInt(financialData.ebitda).toLocaleString()}%` : null;
        
        if (askingPrice || revenue || ebitda) {
          highlightsText += ' The ';
          const parts = [];
          if (askingPrice) parts.push(`asking price of ${askingPrice}`);
          if (revenue) parts.push(`revenue of ${revenue}`);
          if (ebitda) parts.push(`EBITDA of ${ebitda}`);
          highlightsText += parts.join(', ');
          highlightsText += ' presents a compelling value proposition for investors.';
        }
      }
      
      highlightsText += ' Additionally, the strategic market opportunities, operational strengths, and visionary leadership team further enhance the investment appeal.';
      
      doc.font('Helvetica').text(highlightsText);
      doc.moveDown(2);

      // Contact Information - Professional formatting with images
      if (userProfile) {
        doc.moveDown(4);
        
        // Add horizontal line before contact information
        doc.strokeColor('#e5e7eb')
           .lineWidth(1)
           .moveTo(50, doc.y)
           .lineTo(doc.page.width - 50, doc.y)
           .stroke();
        
        doc.moveDown(2);
        
        // Contact Information header with professional spacing
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('Contact Information', { align: 'center' });
        
        doc.moveDown(2);
        
        // Add profile photo if available
        if (userProfile.profilePhoto) {
          try {
            console.log("Profile photo URL:", userProfile.profilePhoto);
            const profilePhotoPath = resolveImagePath(userProfile.profilePhoto);
            console.log("Resolved profile photo path:", profilePhotoPath);
            console.log("Profile photo exists:", fs.existsSync(profilePhotoPath));
            
            if (fs.existsSync(profilePhotoPath)) {
              const centerX = (doc.page.width - 60) / 2;
              doc.image(profilePhotoPath, centerX, doc.y, {
                fit: [60, 60],
                align: 'center'
              });
              doc.moveDown(4);
              console.log("Successfully added profile photo to PDF");
            } else {
              console.log("Profile photo file does not exist at path:", profilePhotoPath);
            }
          } catch (error) {
            console.error("Failed to add profile photo to PDF:", error);
          }
        } else {
          console.log("No profile photo provided in userProfile");
        }
        
        // Contact details with proper formatting
        if (userProfile.name) {
          doc.fontSize(14)
             .font('Helvetica-Bold')
             .text(userProfile.name, { align: 'center' });
          doc.moveDown(0.5);
        }
        
        if (userProfile.title) {
          doc.fontSize(12)
             .font('Helvetica')
             .text(userProfile.title, { align: 'center' });
          doc.moveDown(0.5);
        }
        
        if (userProfile.phoneNumber) {
          doc.text(`Phone: ${userProfile.phoneNumber}`, { align: 'center' });
          doc.moveDown(0.3);
        }
        
        if (userProfile.email) {
          doc.text(`Email: ${userProfile.email}`, { align: 'center' });
          doc.moveDown(0.3);
        }
        
        // Add business name if available
        if (userProfile.businessName) {
          doc.moveDown(0.5);
          doc.fontSize(10)
             .fillColor('#666666')
             .text(userProfile.businessName, { align: 'center' });
          doc.moveDown(0.5);
        }
        
        // Add business logo if available
        if (userProfile.businessLogo) {
          try {
            console.log("Business logo URL:", userProfile.businessLogo);
            const businessLogoPath = resolveImagePath(userProfile.businessLogo);
            console.log("Resolved business logo path:", businessLogoPath);
            console.log("Business logo exists:", fs.existsSync(businessLogoPath));
            
            if (fs.existsSync(businessLogoPath)) {
              const centerX = (doc.page.width - 80) / 2;
              doc.image(businessLogoPath, centerX, doc.y, {
                fit: [80, 40],
                align: 'center'
              });
              doc.moveDown(3);
              console.log("Successfully added business logo to PDF");
            } else {
              console.log("Business logo file does not exist at path:", businessLogoPath);
            }
          } catch (error) {
            console.error("Failed to add business logo to PDF:", error);
          }
        } else {
          console.log("No business logo provided in userProfile");
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