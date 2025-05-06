import { CimDocument } from "@shared/schema";
import { storage } from "./storage";
import { google } from "googleapis";
import * as docx from "docx";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

export { createGoogleDoc, getGoogleAuthUrl, handleGoogleCallback } from './google-auth';

/**
 * Generates HTML with inline styling for the CIM data
 * This function creates a formatted HTML representation suitable for copying to clipboard
 * and pasting into other applications while preserving formatting
 */
export function generateHtml(analysis: any): string {
  // Start building the HTML snippet (without doctype and head tags)
  let html = `
<div style="font-family: 'Arial', sans-serif; color: #333; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 24px; color: #1a1a1a; border-bottom: 3px solid #4b5563; padding-bottom: 12px;">CONFIDENTIAL INFORMATION MEMORANDUM</div>
`;

  // Business Overview Section with Q&A style
  html += `
    <div style="margin-bottom: 30px; padding-bottom: 20px;">
      <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Business Overview</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">When was the business founded?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.story?.yearStarted || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the business structure?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.story?.businessStructure || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the business model?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.story?.businessModel || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What process do customers follow to place orders?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.story?.orderProcess || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How has the business grown over time?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.story?.growthHistory || 'Information not provided'}</td>
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
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.sales?.averageOrderValue || 'Information not provided'}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How does pricing compare to competitors?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.sales?.competitivePricing || 'Information not provided'}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What pricing model is used?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.sales?.pricingModel || 'Information not provided'}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Is there seasonality in sales?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.sales?.seasonality || 'Information not provided'}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What are the contract terms with customers?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.sales?.contractTerms || 'Information not provided'}</td>
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
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.operations?.customers?.recurring || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How would you describe your customer relationships?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.operations?.customers?.relationships || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Is revenue concentrated among certain customers?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.operations?.customers?.concentration || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What are the typical contract terms?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.operations?.customers?.contracts || 'Information not provided'}</td>
        </tr>
      </table>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Supply Chain</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">How many suppliers does the business work with?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.operations?.suppliers?.count || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What are the supplier payment terms?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.operations?.suppliers?.terms || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Is there concentration among certain suppliers?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.operations?.suppliers?.concentration || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How easily can supplier relationships be transferred?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.operations?.suppliers?.transferability || 'Information not provided'}</td>
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
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.assets?.equipmentValue || 'Information not provided'}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Where is the business located?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.assets?.location || 'Information not provided'}</td>
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
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.inventory.leadTime || 'Information not provided'}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Where is inventory sourced from?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.inventory.sourcing || 'Information not provided'}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How and where is inventory stored?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.inventory.storage || 'Information not provided'}</td>
          </tr>
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the approximate value of inventory?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.inventory.value || 'Information not provided'}</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How many SKUs does the business maintain?</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.inventory.skuCount || 'Information not provided'}</td>
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
      <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; text-transform: uppercase;">Team & Organization</h2>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px;">Owner Involvement</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">What are the owner's current responsibilities?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.team?.ownerResponsibilities || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How many hours per week does the owner work?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.team?.ownerHours || 'Information not provided'}</td>
        </tr>
      </table>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 20px;">Staff & Organization</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">How many employees does the business have?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.team?.employeeCount || 'Information not provided'}</td>
        </tr>
        ${analysis.team?.contractorCount ? `
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">How many contractors does the business use?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.team.contractorCount}</td>
        </tr>` : ''}
        <tr style="background-color: ${analysis.team?.contractorCount ? '#f9fafb' : '#ffffff'};">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the management structure?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.team?.management || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: ${analysis.team?.contractorCount ? '#ffffff' : '#f9fafb'};">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the employee turnover rate?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.team?.turnover || 'Information not provided'}</td>
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
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563; width: 40%;">What is the ownership status of the facility?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.facility?.ownership || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the size of the facility?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.facility?.size || 'Information not provided'}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What is the monthly cost of the facility?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.facility?.cost || 'Information not provided'}</td>
        </tr>
        ${analysis.facility?.leaseDetails ? `
        <tr style="background-color: #ffffff;">
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">What are the lease details?</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1f2937;">${analysis.facility.leaseDetails}</td>
        </tr>` : ''}
      </table>
    </div>
  </div>
`;

  return html;
}

/**
 * Formats CIM analysis data as plain text
 * This function creates a formatted text representation of the CIM data
 * suitable for storing in a custom field or text dump
 */
export function formatTextContent(analysis: any): string {
  const sections: string[] = [];

  // Business Story
  if (analysis.story) {
    sections.push('# BUSINESS OVERVIEW');
    
    if (analysis.story.businessSummary) {
      sections.push(analysis.story.businessSummary);
    }
    
    sections.push('## Business History');
    const storyDetails = [
      analysis.story.yearStarted && `Year Started: ${analysis.story.yearStarted}`,
      analysis.story.businessIdea && `Business Idea: ${analysis.story.businessIdea}`,
      analysis.story.businessModel && `Business Model: ${analysis.story.businessModel}`,
      analysis.story.orderProcess && `Order Process: ${analysis.story.orderProcess}`,
      analysis.story.growthHistory && `Growth History: ${analysis.story.growthHistory}`,
      analysis.story.businessStructure && `Business Structure: ${analysis.story.businessStructure}`
    ].filter(Boolean).join('\n\n');
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
      analysis.assets.location && `Location: ${analysis.assets.location}`,
      analysis.assets.equipmentValue && `Equipment Value: ${analysis.assets.equipmentValue}`,
      analysis.assets.equipmentDetails && `Equipment Details: ${analysis.assets.equipmentDetails}`,
      analysis.assets.inventoryDetails && `Inventory Details: ${analysis.assets.inventoryDetails}`
    ].filter(Boolean).join('\n\n');
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
        analysis.operations.suppliers.count && `Count: ${analysis.operations.suppliers.count}`,
        analysis.operations.suppliers.transferability && `Transferability: ${analysis.operations.suppliers.transferability}`,
        analysis.operations.suppliers.concentration && `Concentration: ${analysis.operations.suppliers.concentration}`,
        analysis.operations.suppliers.terms && `Terms: ${analysis.operations.suppliers.terms}`,
        analysis.operations.suppliers.replaceability && `Replaceability: ${analysis.operations.suppliers.replaceability}`
      ].filter(Boolean).join('\n');
      sections.push(suppliersDetails);
    }
    
    if (analysis.operations.customers) {
      sections.push('## Customers');
      const customersDetails = [
        analysis.operations.customers.recurring && `Recurring: ${analysis.operations.customers.recurring}`,
        analysis.operations.customers.relationships && `Relationships: ${analysis.operations.customers.relationships}`,
        analysis.operations.customers.concentration && `Concentration: ${analysis.operations.customers.concentration}`,
        analysis.operations.customers.contracts && `Contracts: ${analysis.operations.customers.contracts}`,
        analysis.operations.customers.replaceability && `Replaceability: ${analysis.operations.customers.replaceability}`
      ].filter(Boolean).join('\n');
      sections.push(customersDetails);
    }
  }

  // Team
  if (analysis.team) {
    sections.push('# TEAM');
    
    const teamDetails = [
      analysis.team.ownerResponsibilities && `Owner Responsibilities: ${analysis.team.ownerResponsibilities}`,
      analysis.team.ownerHours && `Owner Hours: ${analysis.team.ownerHours}`,
      analysis.team.employeeSummary && `Employee Summary: ${analysis.team.employeeSummary}`,
      analysis.team.employeeCount && `Employee Count: ${analysis.team.employeeCount}`,
      analysis.team.contractorCount && `Contractor Count: ${analysis.team.contractorCount}`,
      analysis.team.turnover && `Turnover: ${analysis.team.turnover}`,
      analysis.team.hiring && `Hiring: ${analysis.team.hiring}`,
      analysis.team.retention && `Retention: ${analysis.team.retention}`,
      analysis.team.organization && `Organization: ${analysis.team.organization}`,
      analysis.team.management && `Management: ${analysis.team.management}`
    ].filter(Boolean).join('\n\n');
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
      analysis.facility.ownership && `Ownership: ${analysis.facility.ownership}`,
      analysis.facility.size && `Size: ${analysis.facility.size}`,
      analysis.facility.cost && `Cost: ${analysis.facility.cost}`,
      analysis.facility.leaseDetails && `Lease Details: ${analysis.facility.leaseDetails}`
    ].filter(Boolean).join('\n');
    sections.push(facilityDetails);
  }

  return sections.join('\n\n');
}

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
        employeeText = employee;
      } else if (typeof employee === 'object') {
        // Extract relevant properties from employee object
        const parts = [];
        if (employee.name) parts.push(`Name: ${employee.name}`);
        if (employee.role) parts.push(`Role: ${employee.role}`);
        if (employee.background) parts.push(`Background: ${employee.background}`);
        if (employee.tenure) parts.push(`Tenure: ${employee.tenure}`);
        
        // If no properties were found, provide a fallback format
        if (parts.length === 0) {
          employeeText = Object.entries(employee)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');
        } else {
          employeeText = parts.join(', ');
        }
      } else {
        employeeText = String(employee);
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
  console.log("Starting simplified PDF generation...");
  
  return new Promise((resolve, reject) => {
    try {
      // Create a basic PDF document
      const doc = new PDFDocument({
        size: 'letter',
        margin: 50
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
      
      // Start creating PDF content - first the title page
      doc.fontSize(22)
         .text('CONFIDENTIAL INFORMATION MEMORANDUM', {
           align: 'center'
         });
      
      doc.moveDown(2);
      
      // Add business name/title
      const businessTitle = analysis.story?.businessSummary?.substring(0, 50) || 'Business Information Memorandum';
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
      
      // Add core content on subsequent pages
      doc.addPage();
      
      // BUSINESS OVERVIEW
      doc.fontSize(16)
         .text('BUSINESS OVERVIEW', {
           underline: true
         });
      
      doc.moveDown(1);
      doc.fontSize(12);
      
      // Business basics
      if (analysis.story) {
        doc.text(`Founded: ${analysis.story.yearStarted || 'N/A'}`);
        doc.text(`Structure: ${analysis.story.businessStructure || 'N/A'}`);
        
        doc.moveDown(1);
        if (analysis.story.businessSummary) {
          doc.text("Business Description:");
          doc.moveDown(0.5);
          doc.text(analysis.story.businessSummary);
        }
      }
      
      doc.moveDown(1);
      
      // MARKET SECTION
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
          doc.text(analysis.marketAnalysis.customerProfile);
          doc.moveDown(1);
        }
        
        if (analysis.marketAnalysis.competitors && analysis.marketAnalysis.competitors.length) {
          doc.text("Competitors:");
          doc.moveDown(0.5);
          analysis.marketAnalysis.competitors.forEach((competitor: string) => {
            doc.text(`• ${competitor}`);
          });
          doc.moveDown(1);
        }
        
        if (analysis.marketAnalysis.strengths && analysis.marketAnalysis.strengths.length) {
          doc.text("Business Strengths:");
          doc.moveDown(0.5);
          analysis.marketAnalysis.strengths.forEach((strength: string) => {
            doc.text(`• ${strength}`);
          });
        }
      }
      
      // Add additional pages and sections as needed
      if (doc.y > 700) {
        doc.addPage();
      }
      
      // OPERATIONS SECTION
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
          doc.text(`Recurring Revenue: ${customers.recurring || 'N/A'}`);
          doc.text(`Customer Base: ${customers.relationships || 'N/A'}`);
          doc.text(`Revenue Concentration: ${customers.concentration || 'N/A'}`);
          doc.moveDown(1);
        }
        
        // Supplier details
        if (analysis.operations.suppliers) {
          doc.text("Supply Chain:");
          doc.moveDown(0.5);
          const suppliers = analysis.operations.suppliers;
          doc.text(`Number of Suppliers: ${suppliers.count || 'N/A'}`);
          doc.text(`Supplier Terms: ${suppliers.terms || 'N/A'}`);
        }
      }
      
      // Add page numbers to all pages
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .text(
             `Page ${i + 1} of ${range.count}`,
             50,
             doc.page.height - 50,
             { align: 'center' }
           );
      }
      
      console.log("Finalizing PDF document generation...");
      doc.end();
      
    } catch (error) {
      console.error("PDF generation failed:", error);
      reject(error);
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
  formattedContent += `• Retention: ${analysis.team?.retention || 'N/A'}\n`;
  
  // Add Key Team Members if available
  if (analysis.team?.keyEmployees?.length > 0) {
    formattedContent += `\nKey Team Members:\n`;
    
    // Format each employee based on its type
    analysis.team.keyEmployees.forEach((employee: any) => {
      if (typeof employee === 'string') {
        formattedContent += `• ${employee}\n`;
      } else if (typeof employee === 'object') {
        // Extract relevant properties from employee object
        const parts = [];
        if (employee.name) parts.push(`Name: ${employee.name}`);
        if (employee.role) parts.push(`Role: ${employee.role}`);
        if (employee.background) parts.push(`Background: ${employee.background}`);
        if (employee.tenure) parts.push(`Tenure: ${employee.tenure}`);
        
        // If no properties were found, provide a fallback format
        if (parts.length === 0) {
          formattedContent += `• ${Object.entries(employee)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ')}\n`;
        } else {
          formattedContent += `• ${parts.join(', ')}\n`;
        }
      } else {
        formattedContent += `• ${String(employee)}\n`;
      }
    });
  }
  
  formattedContent += `\n`;
  
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
