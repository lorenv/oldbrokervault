import { 
  users, documents, recipients, signatureFields, auditTrail, templates, templateFields, documentImages, templateImages, templateRecipients,
  type User, type InsertUser,
  type Document, type InsertDocument,
  type Recipient, type InsertRecipient,
  type SignatureField, type InsertSignatureField,
  type AuditTrail, type InsertAuditTrail,
  type Template, type InsertTemplate,
  type TemplateField, type InsertTemplateField,
  type TemplateRecipient, type InsertTemplateRecipient
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Documents
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByUser(userId: number): Promise<Document[]>;
  getDocumentListByUser(userId: number): Promise<Omit<Document, 'fileContent'>[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocumentStatus(id: number, status: string): Promise<void>;
  updateDocumentImages(id: number, imageUrls: string[]): Promise<void>;
  updateDocumentPageCount(id: number, pageCount: number): Promise<void>;
  updateDocumentFileStorage(id: number, fileStorageUrl: string): Promise<void>;
  deleteDocument(id: number): Promise<void>;

  // Recipients
  getRecipientsByDocument(documentId: number): Promise<Recipient[]>;
  getRecipientsByUserId(userId: number): Promise<Recipient[]>;
  getRecipientByToken(token: string): Promise<Recipient | undefined>;
  createRecipient(recipient: InsertRecipient): Promise<Recipient>;
  updateRecipient(id: number, updates: Partial<Recipient>): Promise<void>;
  updateRecipientStatus(id: number, status: string): Promise<void>;
  deleteRecipient(id: number): Promise<void>;

  // Signature Fields
  getFieldsByDocument(documentId: number): Promise<SignatureField[]>;
  getFieldsByRecipient(recipientId: number): Promise<SignatureField[]>;
  createSignatureField(field: InsertSignatureField): Promise<SignatureField>;
  updateFieldValue(id: number, value: string): Promise<void>;
  updateFieldPosition(id: number, x: number, y: number): Promise<void>;
  deleteSignatureField(id: number): Promise<void>;

  // Audit Trail
  addAuditEntry(entry: InsertAuditTrail): Promise<AuditTrail>;
  getAuditTrail(documentId: number): Promise<AuditTrail[]>;

  // Templates
  getTemplate(id: number): Promise<Template | undefined>;
  getTemplatesByUser(userId: number): Promise<Template[]>;
  getTemplateListByUser(userId: number): Promise<Omit<Template, 'fileContent' | 'imageUrls'>[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: number, updates: Partial<Template>): Promise<void>;
  updateTemplateFileStorage(id: number, fileStorageUrl: string): Promise<void>;
  deleteTemplate(id: number): Promise<void>;
  incrementTemplateUsage(id: number): Promise<void>;

  // Template Fields
  getTemplateFields(templateId: number): Promise<TemplateField[]>;
  createTemplateField(field: InsertTemplateField): Promise<TemplateField>;
  updateTemplateField(id: number, updates: Partial<TemplateField>): Promise<void>;
  deleteTemplateField(id: number): Promise<void>;

  // Template Recipients
  getTemplateRecipients(templateId: number): Promise<TemplateRecipient[]>;
  createTemplateRecipient(recipient: InsertTemplateRecipient): Promise<TemplateRecipient>;
  updateTemplateRecipient(id: number, updates: Partial<TemplateRecipient>): Promise<void>;
  deleteTemplateRecipient(id: number): Promise<void>;

  // Template to Document conversion
  createDocumentFromTemplate(templateId: number, userId: number, title: string): Promise<Document>;

  // Document Images
  getDocumentImage(documentId: number, pageNumber: number): Promise<Buffer | null>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Documents
  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocumentsByUser(userId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.createdById, userId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentListByUser(userId: number): Promise<Omit<Document, 'fileContent'>[]> {
    return await db
      .select({
        id: documents.id,
        title: documents.title,
        originalFileName: documents.originalFileName,
        fileType: documents.fileType,
        status: documents.status,
        pageCount: documents.pageCount,
        imageUrls: documents.imageUrls,
        fileStorageUrl: documents.fileStorageUrl,
        createdAt: documents.createdAt,
        createdById: documents.createdById,
        completedAt: documents.completedAt,
        templateId: documents.templateId
      })
      .from(documents)
      .where(eq(documents.createdById, userId))
      .orderBy(desc(documents.createdAt));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async updateDocumentStatus(id: number, status: string): Promise<void> {
    await db
      .update(documents)
      .set({ status })
      .where(eq(documents.id, id));
  }

  async updateDocumentImages(id: number, imageUrls: string[]): Promise<void> {
    await db
      .update(documents)
      .set({ imageUrls })
      .where(eq(documents.id, id));
  }

  async updateDocumentPageCount(id: number, pageCount: number): Promise<void> {
    await db
      .update(documents)
      .set({ pageCount })
      .where(eq(documents.id, id));
  }

  async updateDocumentFileStorage(id: number, fileStorageUrl: string): Promise<void> {
    await db
      .update(documents)
      .set({ fileStorageUrl })
      .where(eq(documents.id, id));
  }

  async deleteDocument(id: number): Promise<void> {
    // Delete in proper order due to foreign key constraints
    await db.delete(signatureFields).where(eq(signatureFields.documentId, id));
    await db.delete(auditTrail).where(eq(auditTrail.documentId, id));
    await db.delete(recipients).where(eq(recipients.documentId, id));
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Recipients
  async getRecipientsByDocument(documentId: number): Promise<Recipient[]> {
    return await db
      .select()
      .from(recipients)
      .where(eq(recipients.documentId, documentId))
      .orderBy(recipients.signingOrder);
  }

  async getRecipientsByUserId(userId: number): Promise<Recipient[]> {
    return await db
      .select({
        id: recipients.id,
        documentId: recipients.documentId,
        email: recipients.email,
        fullName: recipients.fullName,
        title: recipients.title,
        role: recipients.role,
        signingOrder: recipients.signingOrder,
        status: recipients.status,
        signedAt: recipients.signedAt,
        accessToken: recipients.accessToken
      })
      .from(recipients)
      .innerJoin(documents, eq(recipients.documentId, documents.id))
      .where(eq(documents.createdById, userId));
  }

  async getRecipientByToken(token: string): Promise<Recipient | undefined> {
    const [recipient] = await db
      .select()
      .from(recipients)
      .where(eq(recipients.accessToken, token));
    return recipient || undefined;
  }

  async createRecipient(insertRecipient: InsertRecipient): Promise<Recipient> {
    const accessToken = nanoid(32);
    const [recipient] = await db
      .insert(recipients)
      .values({ ...insertRecipient, accessToken })
      .returning();
    return recipient;
  }

  async updateRecipient(id: number, updates: Partial<Recipient>): Promise<void> {
    await db
      .update(recipients)
      .set(updates)
      .where(eq(recipients.id, id));
  }

  async updateRecipientStatus(id: number, status: string): Promise<void> {
    const updateData: any = { status };
    if (status === "signed") {
      updateData.signedAt = new Date();
    }
    
    await db
      .update(recipients)
      .set(updateData)
      .where(eq(recipients.id, id));
  }

  async deleteRecipient(id: number): Promise<void> {
    // First delete all signature fields for this recipient
    await db
      .delete(signatureFields)
      .where(eq(signatureFields.recipientId, id));
    
    // Then delete the recipient
    await db
      .delete(recipients)
      .where(eq(recipients.id, id));
  }

  // Signature Fields
  async getFieldsByDocument(documentId: number): Promise<SignatureField[]> {
    return await db
      .select()
      .from(signatureFields)
      .where(eq(signatureFields.documentId, documentId));
  }

  async getFieldsByRecipient(recipientId: number): Promise<SignatureField[]> {
    return await db
      .select()
      .from(signatureFields)
      .where(eq(signatureFields.recipientId, recipientId));
  }

  async createSignatureField(insertField: InsertSignatureField): Promise<SignatureField> {
    const [field] = await db
      .insert(signatureFields)
      .values(insertField)
      .returning();
    return field;
  }

  async updateFieldValue(id: number, value: string): Promise<void> {
    await db
      .update(signatureFields)
      .set({ value })
      .where(eq(signatureFields.id, id));
  }

  async updateFieldPosition(id: number, x: number, y: number): Promise<void> {
    await db
      .update(signatureFields)
      .set({ x, y })
      .where(eq(signatureFields.id, id));
  }

  async deleteSignatureField(id: number): Promise<void> {
    await db
      .delete(signatureFields)
      .where(eq(signatureFields.id, id));
  }

  // Audit Trail
  async addAuditEntry(insertEntry: InsertAuditTrail): Promise<AuditTrail> {
    const [entry] = await db
      .insert(auditTrail)
      .values(insertEntry)
      .returning();
    return entry;
  }

  async getAuditTrail(documentId: number): Promise<AuditTrail[]> {
    return await db
      .select()
      .from(auditTrail)
      .where(eq(auditTrail.documentId, documentId))
      .orderBy(desc(auditTrail.timestamp));
  }

  // Template methods
  async getTemplate(id: number): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template || undefined;
  }

  async getTemplatesByUser(userId: number): Promise<Template[]> {
    return await db
      .select()
      .from(templates)
      .where(eq(templates.createdById, userId))
      .orderBy(desc(templates.createdAt));
  }

  // Optimized method for template list view - excludes large fileContent and imageUrls fields
  async getTemplateListByUser(userId: number): Promise<Omit<Template, 'fileContent' | 'imageUrls'>[]> {
    return await db
      .select({
        id: templates.id,
        title: templates.title,
        description: templates.description,
        category: templates.category,
        originalFileName: templates.originalFileName,
        fileType: templates.fileType,
        fileStorageUrl: templates.fileStorageUrl,
        pageCount: templates.pageCount,
        usageCount: templates.usageCount,
        createdById: templates.createdById,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(eq(templates.createdById, userId))
      .orderBy(desc(templates.createdAt));
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const [template] = await db
      .insert(templates)
      .values(insertTemplate)
      .returning();
    return template;
  }

  async updateTemplate(id: number, updates: Partial<Template>): Promise<void> {
    await db
      .update(templates)
      .set(updates)
      .where(eq(templates.id, id));
  }

  async updateTemplateFileStorage(id: number, fileStorageUrl: string): Promise<void> {
    await db
      .update(templates)
      .set({ fileStorageUrl })
      .where(eq(templates.id, id));
  }

  async deleteTemplate(id: number): Promise<void> {
    // First, set templateId to null for any documents that reference this template
    await db
      .update(documents)
      .set({ templateId: null })
      .where(eq(documents.templateId, id));
    
    // Delete template fields
    await db
      .delete(templateFields)
      .where(eq(templateFields.templateId, id));
    
    // Delete template recipients
    await db
      .delete(templateRecipients)
      .where(eq(templateRecipients.templateId, id));
    
    // Delete template images
    await db
      .delete(templateImages)
      .where(eq(templateImages.templateId, id));
    
    // Finally delete the template
    await db
      .delete(templates)
      .where(eq(templates.id, id));
  }

  async incrementTemplateUsage(id: number): Promise<void> {
    await db
      .update(templates)
      .set({ usageCount: sql`usage_count + 1` })
      .where(eq(templates.id, id));
  }

  async getTemplateFields(templateId: number): Promise<TemplateField[]> {
    return await db
      .select()
      .from(templateFields)
      .where(eq(templateFields.templateId, templateId));
  }

  async createTemplateField(insertField: InsertTemplateField): Promise<TemplateField> {
    const [field] = await db
      .insert(templateFields)
      .values(insertField)
      .returning();
    return field;
  }

  async updateTemplateField(id: number, updates: Partial<TemplateField>): Promise<void> {
    await db
      .update(templateFields)
      .set(updates)
      .where(eq(templateFields.id, id));
  }

  async deleteTemplateField(id: number): Promise<void> {
    await db.delete(templateFields).where(eq(templateFields.id, id));
  }

  // Template Recipients
  async getTemplateRecipients(templateId: number): Promise<TemplateRecipient[]> {
    return await db
      .select()
      .from(templateRecipients)
      .where(eq(templateRecipients.templateId, templateId))
      .orderBy(templateRecipients.signingOrder);
  }

  async createTemplateRecipient(recipient: InsertTemplateRecipient): Promise<TemplateRecipient> {
    const [created] = await db
      .insert(templateRecipients)
      .values(recipient)
      .returning();
    return created;
  }

  async updateTemplateRecipient(id: number, updates: Partial<TemplateRecipient>): Promise<void> {
    await db
      .update(templateRecipients)
      .set(updates)
      .where(eq(templateRecipients.id, id));
  }

  async deleteTemplateRecipient(id: number): Promise<void> {
    await db.delete(templateRecipients).where(eq(templateRecipients.id, id));
  }

  async createDocumentFromTemplate(templateId: number, userId: number, title: string): Promise<Document> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const [document] = await db
      .insert(documents)
      .values({
        title,
        originalFileName: template.originalFileName,
        fileType: template.fileType,
        pageCount: template.pageCount,
        imageUrls: template.imageUrls,
        fileContent: template.fileContent, // Copy file content
        fileStorageUrl: template.fileStorageUrl, // Copy object storage URL
        createdById: userId,
        templateId: templateId,
      })
      .returning();

    // Copy template images to document images
    const templateImagesQuery = await db
      .select()
      .from(templateImages)
      .where(eq(templateImages.templateId, templateId));

    if (templateImagesQuery.length > 0) {
      const documentImageInserts = templateImagesQuery.map(templateImage => ({
        documentId: document.id,
        pageNumber: templateImage.pageNumber,
        imageData: templateImage.imageData,
        imageStorageUrl: templateImage.imageStorageUrl, // Copy object storage URL
      }));

      await db.insert(documentImages).values(documentImageInserts);
    }

    // Copy template recipients and fields to the new document
    const templateRecipientsQuery = await this.getTemplateRecipients(templateId);
    const templateFieldsQuery = await this.getTemplateFields(templateId);

    if (templateRecipientsQuery.length > 0) {
      // Create document recipients based on template recipients
      const createdRecipients: Recipient[] = [];

      for (const templateRecipient of templateRecipientsQuery) {
        const [recipient] = await db
          .insert(recipients)
          .values({
            documentId: document.id,
            email: templateRecipient.placeholderEmail || "", // Use template's placeholder email or empty
            fullName: templateRecipient.name,
            role: templateRecipient.role,
            signingOrder: templateRecipient.signingOrder,
            accessToken: nanoid(),
          })
          .returning();
        
        createdRecipients.push(recipient);
      }

      // Create signature fields mapping to the appropriate recipients
      if (templateFieldsQuery.length > 0) {
        const signatureFieldInserts = templateFieldsQuery.map(templateField => {
          // Handle both old format (just role) and new format (role_recipientId)
          const roleMatch = templateField.recipientRole.match(/^(.+)_(\d+)$/);
          const targetRole = roleMatch ? roleMatch[1] : templateField.recipientRole;
          const templateRecipientId = roleMatch ? parseInt(roleMatch[2]) : null;
          
          let matchingRecipient: Recipient | undefined;
          
          // If we have a template recipient ID, find the corresponding document recipient
          if (templateRecipientId) {
            const templateRecipient = templateRecipientsQuery.find(tr => tr.id === templateRecipientId);
            if (templateRecipient) {
              // Find the document recipient that was created for this template recipient
              // Match by role and signing order to ensure correct mapping
              matchingRecipient = createdRecipients.find(r => 
                r.role === templateRecipient.role && r.signingOrder === templateRecipient.signingOrder
              );
            }
          }
          
          // Fallback: find by role only
          if (!matchingRecipient) {
            matchingRecipient = createdRecipients.find(r => r.role === targetRole);
          }
          
          // Final fallback to first recipient if no match found
          if (!matchingRecipient) {
            matchingRecipient = createdRecipients[0];
          }
          
          return {
            documentId: document.id,
            recipientId: matchingRecipient.id,
            type: templateField.type,
            label: templateField.label,
            pageNumber: templateField.pageNumber,
            x: templateField.x,
            y: templateField.y,
            width: templateField.width,
            height: templateField.height,
            required: templateField.required,
          };
        });

        await db.insert(signatureFields).values(signatureFieldInserts);
      }
    } else if (templateFieldsQuery.length > 0) {
      // Fallback: Create basic recipients if template has no recipients but has fields
      const uniqueRoles = Array.from(new Set(templateFieldsQuery.map(field => field.recipientRole)));
      const createdRecipients: Recipient[] = [];

      for (let i = 0; i < uniqueRoles.length; i++) {
        const role = uniqueRoles[i];
        const [recipient] = await db
          .insert(recipients)
          .values({
            documentId: document.id,
            email: "",
            fullName: role.charAt(0).toUpperCase() + role.slice(1),
            role: role,
            signingOrder: i + 1,
            accessToken: nanoid(),
          })
          .returning();
        
        createdRecipients.push(recipient);
      }

      const signatureFieldInserts = templateFieldsQuery.map(templateField => {
        // Handle both old format (just role) and new format (role_recipientId)
        const roleMatch = templateField.recipientRole.match(/^(.+)_(\d+)$/);
        const targetRole = roleMatch ? roleMatch[1] : templateField.recipientRole;
        
        const matchingRecipient = createdRecipients.find(r => r.role === targetRole) || createdRecipients[0];
        
        return {
          documentId: document.id,
          recipientId: matchingRecipient.id,
          type: templateField.type,
          label: templateField.label,
          pageNumber: templateField.pageNumber,
          x: templateField.x,
          y: templateField.y,
          width: templateField.width,
          height: templateField.height,
          required: templateField.required,
        };
      });

      await db.insert(signatureFields).values(signatureFieldInserts);
    }

    // Increment template usage
    await this.incrementTemplateUsage(templateId);

    return document;
  }

  async getDocumentImage(documentId: number, pageNumber: number): Promise<Buffer | null> {
    // This method is deprecated - use getDocumentImage from documentProcessor.ts instead
    // which properly handles object storage with detailed error reporting
    throw new Error(`getDocumentImage is deprecated. Use getDocumentImage from documentProcessor.ts which properly handles object storage for Document ID ${documentId}, Page ${pageNumber}.`);
  }
}

export const storage = new DatabaseStorage();
