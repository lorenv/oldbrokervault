import { db } from "./db";
import { users, ndaTemplates } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

// Read the actual PDF content from the base64 file
const DEFAULT_NDA_BASE64 = fs.readFileSync(path.join(process.cwd(), 'nda_base64.txt'), 'utf8').trim();

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
          name: "Default Confidentiality Agreement",
          fileContent: DEFAULT_NDA_BASE64,
          isDefault: true
        });
        
        console.log(`Created default NDA template for user ${user.id} (${user.email})`);
      } else {
        console.log(`User ${user.id} (${user.email}) already has a default NDA template`);
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
        isDefault: true
      });
      
      console.log(`Created default NDA template for user ${userId}`);
      return { success: true, message: 'Default NDA template created' };
    } else {
      console.log(`User ${userId} already has a default NDA template`);
      return { success: true, message: 'Default NDA template already exists' };
    }
  } catch (error) {
    console.error('Error creating default NDA template:', error);
    throw error;
  }
}