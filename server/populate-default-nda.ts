import { db } from "./db";
import { users, ndaTemplates } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

// Read the actual PDF content from the base64 file
const DEFAULT_NDA_BASE64 = fs.readFileSync(path.join(process.cwd(), 'nda_base64.txt'), 'utf8').trim();

// Default signature fields for new user NDA templates
// All coordinates and dimensions are percentages (0-100) of the page
const DEFAULT_SIGNATURE_FIELDS = [
  {
    id: 'default_name',
    type: 'name',
    label: 'Full Name',
    x: 10,
    y: 85,
    width: 15,
    height: 3,
    pageNumber: 1,
    required: true,
    fontSize: 12,
  },
  {
    id: 'default_signature',
    type: 'signature',
    label: 'Signature',
    x: 10,
    y: 90,
    width: 18,
    height: 6,
    pageNumber: 1,
    required: true,
    fontSize: 12,
  },
];

export async function populateDefaultNDAForAllUsers() {
  try {
    console.log('Starting default NDA population for all users...');
    
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users to process`);
    
    for (const user of allUsers) {
      // Check if user already has a default NDA template
      const existingDefault = await db.select()
        .from(ndaTemplates)
        .where(and(
          eq(ndaTemplates.userId, user.id),
          eq(ndaTemplates.isDefault, true)
        ));
      
      if (existingDefault.length === 0) {
        // Create default NDA template for this user
        await db.insert(ndaTemplates).values({
          userId: user.id,
          name: "Broker Vault NDA",
          fileContent: DEFAULT_NDA_BASE64,
          isDefault: true,
          signatureFields: DEFAULT_SIGNATURE_FIELDS,
        });
        
        console.log(`Created "Broker Vault NDA" template for user ${user.id} (${user.email})`);
      } else {
        console.log(`User ${user.id} (${user.email}) already has a Broker Vault NDA template`);
      }
    }
    
    console.log('Default NDA population completed successfully');
    return { success: true, message: 'Default NDA templates populated for all users' };
  } catch (error) {
    console.error('Error populating default NDA templates:', error);
    throw error;
  }
}

export async function populateDefaultNDAForUser(userId: number) {
  try {
    // Check if user already has a default NDA template
    const existingDefault = await db.select()
      .from(ndaTemplates)
      .where(and(
        eq(ndaTemplates.userId, userId),
        eq(ndaTemplates.isDefault, true)
      ));
    
    if (existingDefault.length === 0) {
      // Create default NDA template for this user
      await db.insert(ndaTemplates).values({
        userId: userId,
        name: "Default Confidentiality Agreement",
        fileContent: DEFAULT_NDA_BASE64,
        isDefault: true,
        signatureFields: DEFAULT_SIGNATURE_FIELDS,
      });
      
      console.log(`Created "Broker Vault NDA" template for user ${userId}`);
      return { success: true, message: 'Broker Vault NDA template created' };
    } else {
      console.log(`User ${userId} already has a Broker Vault NDA template`);
      return { success: true, message: 'Broker Vault NDA template already exists' };
    }
  } catch (error) {
    console.error('Error creating default NDA template:', error);
    throw error;
  }
}