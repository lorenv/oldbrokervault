import { db } from '../db';
import { documents, templates, documentImages, templateImages } from '@shared/schema';
import { ObjectStorageService } from '../objectStorage';
import { eq, isNotNull, isNull, or } from 'drizzle-orm';

interface MigrationProgress {
  totalDocuments: number;
  migratedDocuments: number;
  totalTemplates: number;
  migratedTemplates: number;
  totalDocumentImages: number;
  migratedDocumentImages: number;
  totalTemplateImages: number;
  migratedTemplateImages: number;
  errors: string[];
}

export class MigrationService {
  private progress: MigrationProgress = {
    totalDocuments: 0,
    migratedDocuments: 0,
    totalTemplates: 0,
    migratedTemplates: 0,
    totalDocumentImages: 0,
    migratedDocumentImages: 0,
    totalTemplateImages: 0,
    migratedTemplateImages: 0,
    errors: []
  };

  private objectStorage = new ObjectStorageService();

  async initialize(): Promise<void> {
    console.log('[MIGRATION] Object storage initialized');
  }

  async getProgress(): Promise<MigrationProgress> {
    return { ...this.progress };
  }

  async runFullMigration(): Promise<MigrationProgress> {
    console.log('[MIGRATION] 🚀 Starting full migration to object storage...');
    
    try {
      await this.initialize();
      
      // Count total items to migrate
      await this.countItems();
      
      // Migrate in order: files first, then images
      await this.migrateDocumentFiles();
      await this.migrateTemplateFiles();
      await this.migrateDocumentImages();
      await this.migrateTemplateImages();
      
      console.log('[MIGRATION] ✅ Migration completed successfully');
      console.log(`[MIGRATION] Migrated: ${this.progress.migratedDocuments}/${this.progress.totalDocuments} documents, ${this.progress.migratedTemplates}/${this.progress.totalTemplates} templates, ${this.progress.migratedDocumentImages}/${this.progress.totalDocumentImages} document images, ${this.progress.migratedTemplateImages}/${this.progress.totalTemplateImages} template images`);
      
      if (this.progress.errors.length > 0) {
        console.log(`[MIGRATION] ⚠️ ${this.progress.errors.length} errors occurred during migration`);
        this.progress.errors.forEach(error => console.log(`[MIGRATION] Error: ${error}`));
      }
      
    } catch (error) {
      console.error('[MIGRATION] ❌ Migration failed:', error);
      this.progress.errors.push(`Migration failed: ${error}`);
    }
    
    return this.progress;
  }

  private async countItems(): Promise<void> {
    // Count documents with base64 file content
    const documentsToMigrate = await db.select({ count: documents.id })
      .from(documents)
      .where(isNotNull(documents.fileContent));
    this.progress.totalDocuments = documentsToMigrate.length;

    // Count templates with base64 file content  
    const templatesToMigrate = await db.select({ count: templates.id })
      .from(templates)
      .where(isNotNull(templates.fileContent));
    this.progress.totalTemplates = templatesToMigrate.length;

    // Count document images with base64 data
    const documentImagesToMigrate = await db.select({ count: documentImages.id })
      .from(documentImages)
      .where(isNotNull(documentImages.imageData));
    this.progress.totalDocumentImages = documentImagesToMigrate.length;

    // Count template images with base64 data
    const templateImagesToMigrate = await db.select({ count: templateImages.id })
      .from(templateImages)
      .where(isNotNull(templateImages.imageData));
    this.progress.totalTemplateImages = templateImagesToMigrate.length;

    console.log(`[MIGRATION] Found ${this.progress.totalDocuments} documents, ${this.progress.totalTemplates} templates, ${this.progress.totalDocumentImages} document images, ${this.progress.totalTemplateImages} template images to migrate`);
  }

  private async migrateDocumentFiles(): Promise<void> {
    console.log('[MIGRATION] 📄 Migrating document files...');
    
    const documentsToMigrate = await db.select()
      .from(documents)
      .where(isNotNull(documents.fileContent));

    for (const doc of documentsToMigrate) {
      try {
        if (!doc.fileContent) continue;

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(doc.fileContent, 'base64');
        
        // Generate storage key for document
        const key = `${this.objectStorage.getPrivateObjectDir()}/documents/${doc.id}/${doc.originalFileName}`;
        
        // Upload to object storage
        const uploadResult = await this.objectStorage.uploadFile(key, fileBuffer, `application/${doc.fileType}`);
        
        // Update database record
        await db.update(documents)
          .set({ 
            fileStorageUrl: uploadResult.url,
            // Keep fileContent for now as fallback during migration
          })
          .where(eq(documents.id, doc.id));

        this.progress.migratedDocuments++;
        console.log(`[MIGRATION] Document ${doc.id} (${doc.title}) migrated: ${uploadResult.url}`);
        
      } catch (error) {
        const errorMsg = `Failed to migrate document ${doc.id}: ${error}`;
        this.progress.errors.push(errorMsg);
        console.error(`[MIGRATION] ${errorMsg}`);
      }
    }
  }

  private async migrateTemplateFiles(): Promise<void> {
    console.log('[MIGRATION] 📋 Migrating template files...');
    
    const templatesToMigrate = await db.select()
      .from(templates)
      .where(isNotNull(templates.fileContent));

    for (const template of templatesToMigrate) {
      try {
        if (!template.fileContent) continue;

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(template.fileContent, 'base64');
        
        // Generate storage key for template
        const key = `${this.objectStorage.getPrivateObjectDir()}/templates/${template.id}/${template.originalFileName}`;
        
        // Upload to object storage
        const uploadResult = await this.objectStorage.uploadFile(key, fileBuffer, `application/${template.fileType}`);
        
        // Update database record
        await db.update(templates)
          .set({ 
            fileStorageUrl: uploadResult.url,
            // Keep fileContent for now as fallback during migration
          })
          .where(eq(templates.id, template.id));

        this.progress.migratedTemplates++;
        console.log(`[MIGRATION] Template ${template.id} (${template.title}) migrated: ${uploadResult.url}`);
        
      } catch (error) {
        const errorMsg = `Failed to migrate template ${template.id}: ${error}`;
        this.progress.errors.push(errorMsg);
        console.error(`[MIGRATION] ${errorMsg}`);
      }
    }
  }

  private async migrateDocumentImages(): Promise<void> {
    console.log('[MIGRATION] 🖼️ Migrating document images...');
    
    const imagesToMigrate = await db.select()
      .from(documentImages)
      .where(isNotNull(documentImages.imageData));

    for (const image of imagesToMigrate) {
      try {
        if (!image.imageData) continue;

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(image.imageData, 'base64');
        
        // Generate storage key for document image
        const key = `${this.objectStorage.getPrivateObjectDir()}/documents/${image.documentId}/pages/page-${image.pageNumber}.png`;
        
        // Upload to object storage
        const uploadResult = await this.objectStorage.uploadFile(key, imageBuffer, 'image/png');
        
        // Update database record
        await db.update(documentImages)
          .set({ 
            imageStorageUrl: uploadResult.url,
            // Keep imageData for now as fallback during migration
          })
          .where(eq(documentImages.id, image.id));

        this.progress.migratedDocumentImages++;
        console.log(`[MIGRATION] Document image ${image.id} (doc ${image.documentId}, page ${image.pageNumber}) migrated: ${uploadResult.url}`);
        
      } catch (error) {
        const errorMsg = `Failed to migrate document image ${image.id}: ${error}`;
        this.progress.errors.push(errorMsg);
        console.error(`[MIGRATION] ${errorMsg}`);
      }
    }
  }

  private async migrateTemplateImages(): Promise<void> {
    console.log('[MIGRATION] 🖼️ Migrating template images...');
    
    const imagesToMigrate = await db.select()
      .from(templateImages)
      .where(isNotNull(templateImages.imageData));

    for (const image of imagesToMigrate) {
      try {
        if (!image.imageData) continue;

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(image.imageData, 'base64');
        
        // Generate storage key for template image
        const key = `${this.objectStorage.getPrivateObjectDir()}/templates/${image.templateId}/pages/page-${image.pageNumber}.png`;
        
        // Upload to object storage
        const uploadResult = await this.objectStorage.uploadFile(key, imageBuffer, 'image/png');
        
        // Update database record
        await db.update(templateImages)
          .set({ 
            imageStorageUrl: uploadResult.url,
            // Keep imageData for now as fallback during migration
          })
          .where(eq(templateImages.id, image.id));

        this.progress.migratedTemplateImages++;
        console.log(`[MIGRATION] Template image ${image.id} (template ${image.templateId}, page ${image.pageNumber}) migrated: ${uploadResult.url}`);
        
      } catch (error) {
        const errorMsg = `Failed to migrate template image ${image.id}: ${error}`;
        this.progress.errors.push(errorMsg);
        console.error(`[MIGRATION] ${errorMsg}`);
      }
    }
  }

  // Verification methods
  async verifyMigration(): Promise<{ success: boolean; details: any }> {
    console.log('[MIGRATION] 🔍 Verifying migration...');
    
    const details = {
      documentsWithStorageUrl: 0,
      templatesWithStorageUrl: 0,
      documentImagesWithStorageUrl: 0,
      templateImagesWithStorageUrl: 0,
      brokenLinks: []
    };

    // Check documents
    const docsWithStorage = await db.select()
      .from(documents)
      .where(isNotNull(documents.fileStorageUrl));
    details.documentsWithStorageUrl = docsWithStorage.length;

    // Check templates
    const templatesWithStorage = await db.select()
      .from(templates)
      .where(isNotNull(templates.fileStorageUrl));
    details.templatesWithStorageUrl = templatesWithStorage.length;

    // Check document images
    const docImagesWithStorage = await db.select()
      .from(documentImages)
      .where(isNotNull(documentImages.imageStorageUrl));
    details.documentImagesWithStorageUrl = docImagesWithStorage.length;

    // Check template images
    const templateImagesWithStorage = await db.select()
      .from(templateImages)
      .where(isNotNull(templateImages.imageStorageUrl));
    details.templateImagesWithStorageUrl = templateImagesWithStorage.length;

    const success = details.documentsWithStorageUrl === this.progress.migratedDocuments &&
                   details.templatesWithStorageUrl === this.progress.migratedTemplates &&
                   details.documentImagesWithStorageUrl === this.progress.migratedDocumentImages &&
                   details.templateImagesWithStorageUrl === this.progress.migratedTemplateImages;

    console.log(`[MIGRATION] Verification ${success ? '✅ PASSED' : '❌ FAILED'}`);
    return { success, details };
  }
}

export const migrationService = new MigrationService();