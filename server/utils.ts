/**
 * Utility functions for the server
 */

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

  // Ownership
  if (analysis.ownership) {
    sections.push('# OWNERSHIP');
    
    if (analysis.ownership.owners && analysis.ownership.owners.length) {
      sections.push('## Owners');
      const ownersText = analysis.ownership.owners.map((owner: any) => 
        `- ${owner.name} (${owner.percentage})\n  ${owner.background}`
      ).join('\n\n');
      sections.push(ownersText);
    }
    
    if (analysis.ownership.intellectualProperty && analysis.ownership.intellectualProperty.length) {
      sections.push('## Intellectual Property');
      sections.push(analysis.ownership.intellectualProperty.map((item: string) => `- ${item}`).join('\n'));
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

  // Inventory
  if (analysis.inventory) {
    sections.push('# INVENTORY');
    
    const inventoryDetails = [
      analysis.inventory.leadTime && `Lead Time: ${analysis.inventory.leadTime}`,
      analysis.inventory.sourcing && `Sourcing: ${analysis.inventory.sourcing}`,
      analysis.inventory.storage && `Storage: ${analysis.inventory.storage}`,
      analysis.inventory.value && `Value: ${analysis.inventory.value}`,
      analysis.inventory.skuCount && `SKU Count: ${analysis.inventory.skuCount}`
    ].filter(Boolean).join('\n');
    sections.push(inventoryDetails);
    
    if (analysis.inventory.topProducts && analysis.inventory.topProducts.length) {
      sections.push('## Top Products');
      sections.push(analysis.inventory.topProducts.map((item: string) => `- ${item}`).join('\n'));
    }
  }

  // Sales
  if (analysis.sales) {
    sections.push('# SALES');
    
    const salesDetails = [
      analysis.sales.seasonality && `Seasonality: ${analysis.sales.seasonality}`,
      analysis.sales.averageOrderValue && `Average Order Value: ${analysis.sales.averageOrderValue}`,
      analysis.sales.competitivePricing && `Competitive Pricing: ${analysis.sales.competitivePricing}`,
      analysis.sales.pricingModel && `Pricing Model: ${analysis.sales.pricingModel}`,
      analysis.sales.contractTerms && `Contract Terms: ${analysis.sales.contractTerms}`
    ].filter(Boolean).join('\n');
    sections.push(salesDetails);
    
    if (analysis.sales.channels) {
      sections.push('## Sales Channels');
      const channelsText = Object.entries(analysis.sales.channels)
        .map(([channel, percentage]) => `- ${channel}: ${percentage}%`)
        .join('\n');
      sections.push(channelsText);
    }
    
    if (analysis.sales.paymentMethods && analysis.sales.paymentMethods.length) {
      sections.push('## Payment Methods');
      sections.push(analysis.sales.paymentMethods.map((item: string) => `- ${item}`).join('\n'));
    }
  }

  // Marketing
  if (analysis.marketing) {
    sections.push('# MARKETING');
    
    if (analysis.marketing.strategies && analysis.marketing.strategies.length) {
      sections.push('## Marketing Strategies');
      sections.push(analysis.marketing.strategies.map((item: string) => `- ${item}`).join('\n'));
    }
    
    if (analysis.marketing.paidAdvertising) {
      sections.push('## Paid Advertising');
      const paidAdText = [
        analysis.marketing.paidAdvertising.effectiveness && `Effectiveness: ${analysis.marketing.paidAdvertising.effectiveness}`
      ].filter(Boolean).join('\n');
      
      if (analysis.marketing.paidAdvertising.channels && analysis.marketing.paidAdvertising.channels.length) {
        sections.push('### Channels');
        sections.push(analysis.marketing.paidAdvertising.channels.map((item: string) => `- ${item}`).join('\n'));
      }
      
      if (paidAdText) sections.push(paidAdText);
    }
    
    if (analysis.marketing.emailMarketing) {
      sections.push('## Email Marketing');
      const emailMarketingText = [
        analysis.marketing.emailMarketing.listSize && `List Size: ${analysis.marketing.emailMarketing.listSize}`,
        analysis.marketing.emailMarketing.usage && `Usage: ${analysis.marketing.emailMarketing.usage}`
      ].filter(Boolean).join('\n');
      sections.push(emailMarketingText);
    }
    
    if (analysis.marketing.seoEfforts) {
      sections.push('## SEO Efforts');
      sections.push(analysis.marketing.seoEfforts);
    }
    
    if (analysis.marketing.clientAcquisition) {
      sections.push('## Client Acquisition');
      sections.push(analysis.marketing.clientAcquisition);
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
      sections.push(analysis.team.keyEmployees.map((item: string) => `- ${item}`).join('\n'));
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