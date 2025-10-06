import { db } from './server/db.js';
import { ndaSignatures, cimDocuments, users } from './shared/schema.js';
import { desc, eq } from 'drizzle-orm';
import { sendNdaConfirmationEmail } from './server/email.js';

async function testEmail() {
  try {
    // Get the most recent signature
    const [signature] = await db.select().from(ndaSignatures)
      .orderBy(desc(ndaSignatures.signedAt))
      .limit(1);

    if (!signature) {
      console.log('No signatures found');
      process.exit(1);
    }

    console.log('\n=== TESTING EMAIL WITH MOST RECENT SIGNATURE ===');
    console.log('Signer:', signature.signerName);
    console.log('Email:', signature.signerEmail);
    console.log('PDF Length:', signature.signedNdaContent?.length || 0);

    // Get CIM document
    const [cimDoc] = await db.select().from(cimDocuments)
      .where(eq(cimDocuments.id, signature.cimDocumentId))
      .limit(1);

    if (!cimDoc) {
      console.log('CIM document not found');
      process.exit(1);
    }

    console.log('CIM Title:', cimDoc.title);

    // Test sending the email
    console.log('\n=== ATTEMPTING TO SEND EMAIL ===');

    const result = await sendNdaConfirmationEmail(
      signature.signerEmail,
      signature.signerName,
      cimDoc.title,
      signature.signedNdaContent
    );

    console.log('\n=== EMAIL SEND RESULT ===');
    console.log('Success:', result ? '✅ YES' : '❌ NO');

  } catch (error) {
    console.error('\n❌ Error:', error);
  }
  process.exit(0);
}

testEmail();
