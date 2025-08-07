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

    return businessImageFiles.map((filename, index) => {
      try {
        const filePath = join(process.cwd(), 'attached_assets', filename);
        const buffer = readFileSync(filePath);
        return {
          name: `transmission-shop-${index + 1}.jpg`,
          buffer
        };
      } catch (error) {
        console.error(`Failed to load business image ${filename}:`, error);
        // Fallback to a simple placeholder if file not found
        return {
          name: `transmission-shop-${index + 1}.jpg`,
          buffer: Buffer.from('placeholder')
        };
      }
    });
  }

  /**
   * Load real cover image from attached assets
   */
  private loadRealCoverImage(): Buffer {
    try {
      const filePath = join(process.cwd(), 'attached_assets', 'cover transmissions_1754605105186.jpg');
      return readFileSync(filePath);
    } catch (error) {
      console.error('Failed to load cover image:', error);
      // Fallback to placeholder if file not found
      return Buffer.from('cover-image-placeholder');
    }
  }

  /**
   * Load real Tony's logo from attached assets
   */
  private loadRealLogo(): Buffer {
    try {
      const filePath = join(process.cwd(), 'attached_assets', 'logo_1754604458620.png');
      return readFileSync(filePath);
    } catch (error) {
      console.error('Failed to load logo:', error);
      // Fallback to placeholder if file not found
      return Buffer.from('logo-placeholder');
    }
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

    const loadedFiles: { name: string; buffer: Buffer; mimeType: string }[] = [];

    financialFiles.forEach((file) => {
      try {
        const filePath = join(process.cwd(), 'attached_assets', file.filename);
        const buffer = readFileSync(filePath);
        loadedFiles.push({
          name: file.filename,
          buffer,
          mimeType: file.mimeType
        });
      } catch (error) {
        console.error(`Failed to load financial document ${file.filename}:`, error);
        // Continue without this file if it can't be loaded
      }
    });

    return loadedFiles;
  }

  /**
   * Load actual business content from attached assets
   */
  private loadRealBusinessContent(): any {
    try {
      const filePath = join(process.cwd(), 'attached_assets', 'Pasted-Business-Summary-Tony-s-Transmission-Repair-has-established-itself-as-a-premier-provider-of-speciali-1754605160605_1754605160605.txt');
      const content = readFileSync(filePath, 'utf8');
      
      // Parse the content into sections
      const sections = content.split('\n\n').filter(section => section.trim());
      const analysis: any = {
        sections: []
      };
      
      sections.forEach((section, index) => {
        const lines = section.trim().split('\n');
        const title = lines[0];
        const content = lines.slice(1).join(' ').trim();
        
        if (title && content) {
          analysis.sections.push({
            id: `section-${index + 1}`,
            title: title,
            content: `<p>${content}</p>`,
            order: index + 1,
            type: 'text'
          });
        }
      });
      
      return {
        title: "Tony's Transmissions - Confidential Information Memorandum",
        companyName: "Tony's Transmissions",
        generatedAt: new Date().toISOString(),
        sections: analysis.sections,
        metadata: {
          purpose: "business_overview",
          tone: "professional",
          audience: "investors",
          customDirections: "Professional CIM for transmission repair business",
          wordCount: content.split(/\s+/).length,
          hasFinancials: true,
          hasImages: true
        }
      };
    } catch (error) {
      console.error('Failed to load business content:', error);
      return null;
    }
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
    try {
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