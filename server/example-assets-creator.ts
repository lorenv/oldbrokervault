import { objectStorage } from './object-storage';
import { readFileSync } from 'fs';
import { join } from 'path';

export class ExampleAssetsCreator {

  /**
   * Load real business images from attached assets
   */
  private loadRealBusinessImages(): { name: string; buffer: Buffer }[] {
    const businessImageFiles = [
      'pexels-maltelu-2244746_1754604461525.jpg',
      'pexels-mikebirdy-190574_1754604461525.jpg', 
      'pexels-olly-3807329_1754604461526.jpg',
      'pexels-pixabay-159293_1754604461526.jpg'
    ];

    console.log('🔄 Loading real business images from attached_assets...');
    console.log(`📁 Current working directory: ${process.cwd()}`);
    
    return businessImageFiles.map((filename, index) => {
      const filePath = join(process.cwd(), 'attached_assets', filename);
      console.log(`📸 Loading: ${filePath}`);
      
      const buffer = readFileSync(filePath); // Will throw if file not found
      console.log(`✅ Loaded ${filename}, size: ${buffer.length} bytes`);
      
      return {
        name: `transmission-shop-${index + 1}.jpg`,
        buffer
      };
    });
  }

  /**
   * Load real cover image from attached assets
   */
  private loadRealCoverImage(): Buffer {
    const filePath = join(process.cwd(), 'attached_assets', 'cover transmissions_1754605105186.jpg');
    console.log(`🎨 Loading cover image: ${filePath}`);
    
    const buffer = readFileSync(filePath); // Will throw if file not found
    console.log(`✅ Loaded cover image, size: ${buffer.length} bytes`);
    
    return buffer;
  }

  /**
   * Load real Tony's logo from attached assets
   */
  private loadRealLogo(): Buffer {
    const filePath = join(process.cwd(), 'attached_assets', 'logo_1754604458620.png');
    console.log(`🏢 Loading logo: ${filePath}`);
    
    const buffer = readFileSync(filePath); // Will throw if file not found
    console.log(`✅ Loaded logo, size: ${buffer.length} bytes`);
    
    return buffer;
  }

  /**
   * Load real financial documents from attached assets
   */
  private loadRealFinancialDocuments(): { name: string; buffer: Buffer; mimeType: string }[] {
    const financialFiles = [
      { filename: 'Balance Sheets_1754605045862.xls', mimeType: 'application/vnd.ms-excel' },
      { filename: 'Monthly-Profit-Loss-Statement-Template-TemplateLab_1754605045862.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { filename: 'Contracts_1754605045862.doc', mimeType: 'application/msword' }
    ];

    console.log('📊 Loading real financial documents from attached_assets...');
    console.log(`📁 Current working directory: ${process.cwd()}`);
    
    return financialFiles.map((file) => {
      const filePath = join(process.cwd(), 'attached_assets', file.filename);
      console.log(`📄 Loading: ${filePath}`);
      
      const buffer = readFileSync(filePath); // Will throw if file not found
      console.log(`✅ Loaded ${file.filename}, size: ${buffer.length} bytes`);
      
      return {
        name: file.filename,
        buffer,
        mimeType: file.mimeType
      };
    });
  }

  /**
   * Load actual business content from attached assets
   */
  private loadRealBusinessContent(): any {
    const filePath = join(process.cwd(), 'attached_assets', 'Pasted-Business-Summary-Tony-s-Transmission-Repair-has-established-itself-as-a-premier-provider-of-speciali-1754605160605_1754605160605.txt');
    console.log(`📄 Loading business content: ${filePath}`);
    console.log(`📁 Current working directory: ${process.cwd()}`);
    
    const content = readFileSync(filePath, 'utf8'); // Will throw if file not found
    console.log(`✅ Loaded business content, length: ${content.length} characters`);
    
    // Parse the content into sections
    const sections = content.split('\n\n').filter(section => section.trim());
    console.log(`📋 Parsed ${sections.length} sections from business content`);
    
    const analysis: any = {};
    
    sections.forEach((section, index) => {
      const lines = section.trim().split('\n');
      const title = lines[0];
      const sectionContent = lines.slice(1).join(' ').trim();
      
      if (title && sectionContent) {
        analysis[title] = sectionContent;
        console.log(`📝 Added section: ${title} (${sectionContent.length} chars)`);
      }
    });
    
    console.log(`✅ Created analysis object with ${Object.keys(analysis).length} sections`);
    return analysis;
  }

  /**
   * Upload all example assets to object storage
   */
  async createAndUploadExampleAssets(): Promise<{
    logoUrl: string;
    coverImageUrl: string;
    businessImages: string[];
    financialDocuments: { name: string; url: string }[];
    businessContent?: any;
  }> {
    // Load and upload real business images
    const businessImages = this.loadRealBusinessImages();
    const uploadedBusinessImages: string[] = [];

    for (const image of businessImages) {
      const storageKey = `users/example/business-images/${image.name}`;
      
      await objectStorage.uploadImage(image.buffer, storageKey);
      uploadedBusinessImages.push(`/api/object-storage/${storageKey}`);
    }

    // Load and upload real logo
    const logoBuffer = this.loadRealLogo();
    const logoStorageKey = 'users/example/logos/tonys-logo.png';
    
    await objectStorage.uploadImage(logoBuffer, logoStorageKey);
    const logoUrl = `/api/object-storage/${logoStorageKey}`;

    // Load and upload real cover image
    const coverBuffer = this.loadRealCoverImage();
    const coverStorageKey = 'users/example/cover-images/tonys-cover.jpg';
    
    await objectStorage.uploadImage(coverBuffer, coverStorageKey);
    const coverImageUrl = `/api/object-storage/${coverStorageKey}`;

    // Load and upload real financial documents
    const financialDocs = this.loadRealFinancialDocuments();
    const uploadedFinancialDocs: { name: string; url: string }[] = [];

    for (const doc of financialDocs) {
      const storageKey = `users/example/financial-files/${doc.name}`;
      
      await objectStorage.uploadImage(doc.buffer, storageKey);
      uploadedFinancialDocs.push({
        name: doc.name,
        url: `/api/object-storage/${storageKey}`
      });
    }

    // Load real business content
    const businessContent = this.loadRealBusinessContent();

    console.log('✅ Successfully created and uploaded all real example assets');
    
    return {
      logoUrl,
      coverImageUrl,
      businessImages: uploadedBusinessImages,
      financialDocuments: uploadedFinancialDocs,
      businessContent
    };
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