// Script to create a test CIM document for contact form testing
import { db } from './server/db.ts';
import { cimDocuments, users } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function createTestCim() {
  try {
    console.log('🔍 Checking for existing test CIM documents...');

    // First check if there are any users
    const userList = await db.select().from(users).limit(1);
    if (userList.length === 0) {
      console.log('❌ No users found in database. Cannot create test CIM.');
      return;
    }

    const testUser = userList[0];
    console.log(`✅ Found user: ${testUser.name} (${testUser.email})`);

    // Check if there's already a shared CIM document
    const existingSharedCims = await db
      .select()
      .from(cimDocuments)
      .where(eq(cimDocuments.shareEnabled, true))
      .limit(1);

    if (existingSharedCims.length > 0) {
      const cim = existingSharedCims[0];
      console.log(`✅ Found existing shared CIM: "${cim.title}" with shareSlug: ${cim.shareSlug}`);
      return cim.shareSlug;
    }

    // Check if there are any CIM documents we can enable sharing for
    const existingCims = await db
      .select()
      .from(cimDocuments)
      .limit(1);

    if (existingCims.length > 0) {
      const cim = existingCims[0];
      console.log(`🔄 Enabling sharing for existing CIM: "${cim.title}"`);

      // Enable sharing for this CIM
      await db
        .update(cimDocuments)
        .set({
          shareEnabled: true,
          shareSlug: cim.shareSlug || `test-cim-${Date.now()}`
        })
        .where(eq(cimDocuments.id, cim.id));

      const updatedCim = await db
        .select()
        .from(cimDocuments)
        .where(eq(cimDocuments.id, cim.id));

      console.log(`✅ Sharing enabled! ShareSlug: ${updatedCim[0].shareSlug}`);
      return updatedCim[0].shareSlug;
    }

    // If no CIM documents exist, create a test one
    console.log('📝 Creating new test CIM document...');

    const shareSlug = `test-contact-cim-${Date.now()}`;

    const [newCim] = await db
      .insert(cimDocuments)
      .values({
        userId: testUser.id,
        title: 'Test Business Opportunity - Contact Form Testing',
        businessDescription: 'This is a test CIM document for testing the contact form functionality.',
        industry: 'Technology',
        askingPrice: 1000000,
        revenue: 500000,
        ebitda: 100000,
        shareEnabled: true,
        shareSlug: shareSlug,
        contactEnabled: true
      })
      .returning();

    console.log(`✅ Created test CIM: "${newCim.title}" with shareSlug: ${newCim.shareSlug}`);
    return newCim.shareSlug;

  } catch (error) {
    console.error('❌ Error creating test CIM:', error.message);
    return null;
  }
}

// Run the function
createTestCim()
  .then(shareSlug => {
    if (shareSlug) {
      console.log(`\n🎯 Ready to test! Use shareSlug: ${shareSlug}`);
      console.log(`📡 Test URL: http://localhost:3001/api/share/${shareSlug}/contact`);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Script error:', error);
    process.exit(1);
  });