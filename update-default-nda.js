import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import database connection
import { db } from './server/db.js';
import { ndaTemplates } from './shared/schema.js';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateDefaultNDA() {
  try {
    console.log('Starting default NDA update for all existing templates...');
    
    // Read the new default NDA content
    const newNdaBase64 = fs.readFileSync(path.join(__dirname, 'nda_base64.txt'), 'utf8').trim();
    
    // Update all existing default NDA templates
    const result = await db.update(ndaTemplates)
      .set({ 
        fileContent: newNdaBase64,
        name: "Default Confidentiality Agreement"
      })
      .where(eq(ndaTemplates.isDefault, true));
    
    console.log('Successfully updated all default NDA templates');
    console.log('Update result:', result);
    
    // Also verify the update
    const updatedTemplates = await db.select().from(ndaTemplates).where(eq(ndaTemplates.isDefault, true));
    console.log(`Verified: ${updatedTemplates.length} default templates now use the new NDA`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating default NDA templates:', error);
    process.exit(1);
  }
}

updateDefaultNDA();