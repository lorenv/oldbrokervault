import { objectStorage } from './object-storage';

export class ExampleAssetsCreator {

  /**
   * Create sample transmission shop business images as SVGs
   */
  private createTransmissionShopImages(): { name: string; content: string }[] {
    return [
      {
        name: 'transmission-shop-1.jpg',
        content: `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="400" height="300" fill="url(#grad1)"/>
          <rect x="50" y="80" width="300" height="140" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
          <text x="200" y="130" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#1e293b">Tony's Transmissions</text>
          <text x="200" y="155" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#64748b">Automotive Repair Shop</text>
          <rect x="80" y="180" width="60" height="20" fill="#dc2626"/>
          <rect x="160" y="180" width="60" height="20" fill="#ea580c"/>
          <rect x="240" y="180" width="60" height="20" fill="#ca8a04"/>
          <text x="200" y="250" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#f8fafc">Professional Service Since 2001</text>
        </svg>`
      },
      {
        name: 'transmission-shop-2.jpg',
        content: `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="300" fill="#1f2937"/>
          <rect x="20" y="20" width="360" height="260" fill="#374151" stroke="#6b7280" stroke-width="2"/>
          <text x="200" y="60" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="#f9fafb">Service Bay</text>
          <rect x="50" y="80" width="100" height="60" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
          <rect x="250" y="80" width="100" height="60" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
          <circle cx="100" cy="180" r="30" fill="#64748b" stroke="#475569" stroke-width="3"/>
          <circle cx="300" cy="180" r="30" fill="#64748b" stroke="#475569" stroke-width="3"/>
          <text x="200" y="240" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#d1d5db">Modern Equipment & Tools</text>
        </svg>`
      },
      {
        name: 'transmission-shop-3.jpg',
        content: `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="300" fill="#065f46"/>
          <rect x="30" y="50" width="340" height="200" fill="#ecfdf5" stroke="#10b981" stroke-width="3"/>
          <text x="200" y="90" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#047857">Expert Technicians</text>
          <rect x="80" y="110" width="80" height="80" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>
          <rect x="240" y="110" width="80" height="80" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>
          <text x="120" y="155" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#92400e">23+ Years</text>
          <text x="280" y="155" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#92400e">Experience</text>
          <text x="200" y="230" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#047857">Specialized Transmission Solutions</text>
        </svg>`
      },
      {
        name: 'transmission-shop-4.jpg',
        content: `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="300" fill="#7c2d12"/>
          <rect x="40" y="40" width="320" height="220" fill="#fed7aa" stroke="#ea580c" stroke-width="2"/>
          <text x="200" y="80" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#9a3412">Customer Satisfaction</text>
          <text x="200" y="110" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#c2410c">★★★★★</text>
          <text x="200" y="140" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#9a3412">Highly Rated Across</text>
          <text x="200" y="160" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#9a3412">Multiple Platforms</text>
          <rect x="100" y="180" width="200" height="40" fill="#f97316" stroke="#ea580c" stroke-width="2"/>
          <text x="200" y="205" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#fed7aa">Trusted by Auto Body Shops</text>
        </svg>`
      }
    ];
  }

  /**
   * Create cover image for the CIM
   */
  private createCoverImage(): string {
    return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="coverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#60a5fa;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#coverGrad)"/>
      <rect x="50" y="50" width="700" height="500" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      <text x="400" y="150" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle" fill="#ffffff">CONFIDENTIAL</text>
      <text x="400" y="200" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#e0e7ff">INFORMATION MEMORANDUM</text>
      <text x="400" y="280" font-family="Arial, sans-serif" font-size="36" font-weight="bold" text-anchor="middle" fill="#ffffff">Tony's Transmissions</text>
      <text x="400" y="320" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#cbd5e1">Specialized Automotive Transmission Repair</text>
      <text x="400" y="380" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#e0e7ff">23+ Years of Excellence</text>
      <text x="400" y="420" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="#fbbf24">$5,500,000 Revenue</text>
      <text x="400" y="460" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#e0e7ff">Florida & Georgia Operations</text>
      <text x="400" y="520" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#94a3b8">This document contains confidential and proprietary information</text>
    </svg>`;
  }

  /**
   * Create Tony's Transmissions logo as SVG
   */
  private createTonyLogo(): string {
    return `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#b91c1c;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="200" height="100" fill="#1f2937"/>
      <text x="100" y="35" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="url(#logoGrad)">TONY'S</text>
      <text x="100" y="60" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#f9fafb">TRANSMISSIONS</text>
      <text x="100" y="80" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#9ca3af">EST. 2001</text>
    </svg>`;
  }

  /**
   * Create sample financial documents as simple text content
   */
  private createFinancialDocuments(): { name: string; content: string; mimeType: string }[] {
    const p_and_l_content = `TONY'S TRANSMISSIONS
PROFIT & LOSS STATEMENT
Year: 2024

REVENUE
Transmission Repairs: $4,200,000
Diagnostic Services: $800,000
Parts Sales: $500,000
Total Revenue: $5,500,000

EXPENSES
Labor Costs: $2,200,000
Parts & Materials: $1,100,000
Facility Costs: $300,000
Equipment & Tools: $150,000
Insurance: $80,000
Utilities: $70,000
Total Expenses: $3,900,000

EBITDA: $1,600,000
Depreciation: $100,000
Net Income: $1,500,000`;

    const balance_sheet_content = `TONY'S TRANSMISSIONS
BALANCE SHEET
As of December 31, 2024

ASSETS
Current Assets:
  Cash: $450,000
  Accounts Receivable: $320,000
  Inventory: $180,000
  Total Current Assets: $950,000

Fixed Assets:
  Equipment: $650,000
  Building: $850,000
  Less Depreciation: $(200,000)
  Total Fixed Assets: $1,300,000

Total Assets: $2,250,000

LIABILITIES & EQUITY
Current Liabilities:
  Accounts Payable: $150,000
  Accrued Expenses: $80,000
  Total Current Liabilities: $230,000

Long-term Debt: $420,000

Owner's Equity: $1,600,000

Total Liabilities & Equity: $2,250,000`;

    return [
      {
        name: 'P&L_Statement_2024.txt',
        content: p_and_l_content,
        mimeType: 'text/plain'
      },
      {
        name: 'Balance_Sheet_2024.txt',
        content: balance_sheet_content,
        mimeType: 'text/plain'
      }
    ];
  }

  /**
   * Convert SVG content to buffer
   */
  private svgToBuffer(svgContent: string): Buffer {
    return Buffer.from(svgContent, 'utf8');
  }

  /**
   * Upload all example assets to object storage
   */
  async createAndUploadExampleAssets(): Promise<{
    logoUrl: string;
    coverImageUrl: string;
    businessImages: string[];
    financialDocuments: { name: string; url: string }[];
  }> {
    try {
      // Create business images
      const businessImages = this.createTransmissionShopImages();
      const uploadedBusinessImages: string[] = [];

      for (const image of businessImages) {
        const buffer = this.svgToBuffer(image.content);
        const storageKey = `users/example/business-images/${image.name}`;
        
        await objectStorage.uploadImage(buffer, storageKey);
        uploadedBusinessImages.push(`/api/object-storage/${storageKey}`);
      }

      // Create and upload logo
      const logoContent = this.createTonyLogo();
      const logoBuffer = this.svgToBuffer(logoContent);
      const logoStorageKey = 'users/example/logos/tonys-logo.png';
      
      await objectStorage.uploadImage(logoBuffer, logoStorageKey);
      const logoUrl = `/api/object-storage/${logoStorageKey}`;

      // Create and upload cover image
      const coverContent = this.createCoverImage();
      const coverBuffer = this.svgToBuffer(coverContent);
      const coverStorageKey = 'users/example/cover-images/tonys-cover.jpg';
      
      await objectStorage.uploadImage(coverBuffer, coverStorageKey);
      const coverImageUrl = `/api/object-storage/${coverStorageKey}`;

      // Create and upload financial documents
      const financialDocs = this.createFinancialDocuments();
      const uploadedFinancialDocs: { name: string; url: string }[] = [];

      for (const doc of financialDocs) {
        const buffer = Buffer.from(doc.content, 'utf8');
        const storageKey = `users/example/financial-files/${doc.name}`;
        
        await objectStorage.uploadImage(buffer, storageKey);
        uploadedFinancialDocs.push({
          name: doc.name,
          url: `/api/object-storage/${storageKey}`
        });
      }

      console.log('✅ Successfully created and uploaded all example assets');
      
      return {
        logoUrl,
        coverImageUrl,
        businessImages: uploadedBusinessImages,
        financialDocuments: uploadedFinancialDocs
      };

    } catch (error) {
      console.error('❌ Failed to create example assets:', error);
      throw error;
    }
  }

  /**
   * Clean up example assets (optional, for maintenance)
   */
  async cleanupExampleAssets(): Promise<void> {
    try {
      // List and delete all example assets
      const examplePrefixes = [
        'users/example/business-images/',
        'users/example/logos/',
        'users/example/cover-images/',
        'users/example/financial-files/'
      ];

      for (const prefix of examplePrefixes) {
        const files = await objectStorage.listImages(prefix);
        for (const file of files) {
          await objectStorage.deleteImage(file);
        }
      }

      console.log('✅ Cleaned up example assets');
    } catch (error) {
      console.error('❌ Failed to cleanup example assets:', error);
      throw error;
    }
  }
}

export const exampleAssetsCreator = new ExampleAssetsCreator();