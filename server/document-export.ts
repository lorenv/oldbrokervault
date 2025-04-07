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
  // Define CSS styles for the HTML output
  const styles = `
    .cim-container {
      font-family: 'Arial', sans-serif;
      color: #333;
      line-height: 1.5;
      max-width: 800px;
      margin: 0 auto;
    }
    .cim-title {
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 24px;
      color: #1a1a1a;
    }
    .cim-section {
      margin-bottom: 28px;
    }
    .cim-section-title {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 16px;
      color: #2c3e50;
      border-bottom: 1px solid #e1e1e1;
      padding-bottom: 8px;
    }
    .cim-subsection-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 12px;
      color: #34495e;
    }
    .cim-field-name {
      font-weight: bold;
      margin-right: 8px;
    }
    .cim-field-value {
      margin-bottom: 8px;
    }
    .cim-list {
      margin-left: 24px;
      margin-bottom: 16px;
      padding-left: 0;
      list-style-type: disc;
    }
    .cim-list-item {
      margin-bottom: 6px;
    }
  `;

  // Start building the HTML snippet (without doctype and head tags)
  let html = `
<div class="cim-container" style="font-family: 'Arial', sans-serif; color: #333; line-height: 1.5; max-width: 800px; margin: 0 auto;">
  <div class="cim-title" style="font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 24px; color: #1a1a1a;">CONFIDENTIAL INFORMATION MEMORANDUM</div>
`;

  // Business Overview Section
  html += `
    <div style="margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1;">BUSINESS OVERVIEW</h2>
      <div>
        <span style="font-weight: 600; color: #4b5563; min-width: 120px; display: inline-block;">Founded:</span>
        <span style="color: #1f2937;">${analysis.story?.yearStarted || 'N/A'}</span>
      </div>
      <div>
        <span style="font-weight: 600; color: #4b5563; min-width: 120px; display: inline-block;">Structure:</span>
        <span style="color: #1f2937;">${analysis.story?.businessStructure || 'N/A'}</span>
      </div>
      <div style="color: #1f2937; margin-top: 12px;">
        ${analysis.story?.businessSummary || analysis.story?.businessModel || 'N/A'}
      </div>
    </div>
`;

  // Executive Summary Section
  html += `
    <div style="margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1;">INVESTMENT HIGHLIGHTS</h2>
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px;">Key Attractions</h3>
      <ul style="padding-left: 20px; margin-bottom: 16px; list-style-type: disc;">
`;

  if (analysis.executiveSummary?.buyerAttractions?.length) {
    analysis.executiveSummary.buyerAttractions.forEach((item: string) => {
      html += `        <li style="margin-bottom: 6px;">${item}</li>\n`;
    });
  } else {
    html += `        <li style="margin-bottom: 6px;">N/A</li>\n`;
  }

  html += `
      </ul>
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px;">Growth Opportunities</h3>
      <ul style="padding-left: 20px; margin-bottom: 16px; list-style-type: disc;">
`;

  if (analysis.executiveSummary?.growthOpportunities?.length) {
    analysis.executiveSummary.growthOpportunities.forEach((item: string) => {
      html += `        <li style="margin-bottom: 6px;">${item}</li>\n`;
    });
  } else {
    html += `        <li style="margin-bottom: 6px;">N/A</li>\n`;
  }

  html += `
      </ul>
    </div>
`;

  // Market Position Section
  html += `
    <div style="margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1;">MARKET POSITION</h2>
      <div>
        <span style="font-weight: 600; color: #4b5563; min-width: 120px; display: inline-block;">Target Market:</span>
        <span style="color: #1f2937;">${analysis.marketAnalysis?.customerProfile || 'N/A'}</span>
      </div>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 16px;">Competitors</h3>
      <ul style="padding-left: 20px; margin-bottom: 16px; list-style-type: disc;">
`;

  if (analysis.marketAnalysis?.competitors?.length) {
    analysis.marketAnalysis.competitors.forEach((item: string) => {
      html += `        <li style="margin-bottom: 6px;">${item}</li>\n`;
    });
  } else {
    html += `        <li style="margin-bottom: 6px;">N/A</li>\n`;
  }

  html += `
      </ul>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 16px;">Business Strengths</h3>
      <ul style="padding-left: 20px; margin-bottom: 16px; list-style-type: disc;">
`;

  if (analysis.marketAnalysis?.strengths?.length) {
    analysis.marketAnalysis.strengths.forEach((item: string) => {
      html += `        <li style="margin-bottom: 6px;">${item}</li>\n`;
    });
  } else {
    html += `        <li style="margin-bottom: 6px;">N/A</li>\n`;
  }

  html += `
      </ul>
    </div>
`;

  // Operations Section
  html += `
    <div style="margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1;">OPERATIONS</h2>
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 16px;">Customer Relationships</h3>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Recurring Revenue:</span>
        <span style="color: #1f2937;">${analysis.operations?.customers?.recurring || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Customer Base:</span>
        <span style="color: #1f2937;">${analysis.operations?.customers?.relationships || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Revenue Concentration:</span>
        <span style="color: #1f2937;">${analysis.operations?.customers?.concentration || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Contract Terms:</span>
        <span style="color: #1f2937;">${analysis.operations?.customers?.contracts || 'N/A'}</span>
      </div>
      
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 16px;">Supply Chain</h3>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Number of Suppliers:</span>
        <span style="color: #1f2937;">${analysis.operations?.suppliers?.count || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Supplier Terms:</span>
        <span style="color: #1f2937;">${analysis.operations?.suppliers?.terms || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Concentration:</span>
        <span style="color: #1f2937;">${analysis.operations?.suppliers?.concentration || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Transferability:</span>
        <span style="color: #1f2937;">${analysis.operations?.suppliers?.transferability || 'N/A'}</span>
      </div>
    </div>
`;

  // Team Structure Section
  html += `
    <div style="margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1;">TEAM STRUCTURE</h2>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Owner Responsibilities:</span>
        <span style="color: #1f2937;">${analysis.team?.ownerResponsibilities || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Required Hours:</span>
        <span style="color: #1f2937;">${analysis.team?.ownerHours || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Management Structure:</span>
        <span style="color: #1f2937;">${analysis.team?.management || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Team Size:</span>
        <span style="color: #1f2937;">${analysis.team?.employeeCount || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Turnover Rate:</span>
        <span style="color: #1f2937;">${analysis.team?.turnover || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Retention:</span>
        <span style="color: #1f2937;">${analysis.team?.retention || 'N/A'}</span>
      </div>
`;

  // Key Team Members
  if (analysis.team?.keyEmployees?.length > 0) {
    html += `
      <h3 style="font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; margin-top: 16px;">Key Team Members</h3>
      <ul style="padding-left: 20px; margin-bottom: 16px; list-style-type: disc;">
`;
    
    // Format each employee
    analysis.team.keyEmployees.forEach((employee: any) => {
      let employeeText = '';
      
      if (typeof employee === 'string') {
        employeeText = employee;
      } else if (typeof employee === 'object') {
        // Extract relevant properties from employee object
        const parts = [];
        if (employee.name) parts.push(`<strong>Name:</strong> ${employee.name}`);
        if (employee.role) parts.push(`<strong>Role:</strong> ${employee.role}`);
        if (employee.background) parts.push(`<strong>Background:</strong> ${employee.background}`);
        if (employee.tenure) parts.push(`<strong>Tenure:</strong> ${employee.tenure}`);
        
        // If no properties were found, provide a fallback format
        if (parts.length === 0) {
          employeeText = Object.entries(employee)
            .map(([key, val]) => `<strong>${key}:</strong> ${val}`)
            .join(', ');
        } else {
          employeeText = parts.join(', ');
        }
      } else {
        employeeText = String(employee);
      }
      
      html += `        <li style="margin-bottom: 8px; color: #1f2937;">${employeeText}</li>\n`;
    });
    
    html += `      </ul>\n`;
  }

  html += `
    </div>
`;

  // Facilities Section
  html += `
    <div style="margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #6366f1;">FACILITIES</h2>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Ownership Status:</span>
        <span style="color: #1f2937;">${analysis.facility?.ownership || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Size:</span>
        <span style="color: #1f2937;">${analysis.facility?.size || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Monthly Cost:</span>
        <span style="color: #1f2937;">${analysis.facility?.cost || 'N/A'}</span>
      </div>
`;

  if (analysis.facility?.leaseDetails) {
    html += `
      <div style="margin-bottom: 8px;">
        <span style="font-weight: 600; color: #4b5563; min-width: 180px; display: inline-block;">Lease Details:</span>
        <span style="color: #1f2937;">${analysis.facility.leaseDetails}</span>
      </div>
`;
  }

  html += `
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
    
    // Add Key Team Members if available
    if (analysis.team?.keyEmployees?.length > 0) {
      doc.moveDown();
      doc.fontSize(14).text('Key Team Members');
      doc.moveDown(0.5);
      doc.fontSize(12);
      
      // Format each employee based on its type
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
        
        doc.text(`• ${employeeText}`);
      });
    }
    
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
