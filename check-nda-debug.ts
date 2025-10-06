import { db } from './server/db.js';
import { ndaSignatures } from './shared/schema.js';
import { desc } from 'drizzle-orm';

async function checkRecentNDA() {
  try {
    const recent = await db.select().from(ndaSignatures)
      .orderBy(desc(ndaSignatures.signedAt))
      .limit(3);

    console.log('\n=== MOST RECENT NDA SIGNATURES ===');
    recent.forEach((sig, i) => {
      console.log(`\n--- Signature ${i + 1} ---`);
      console.log('ID:', sig.id);
      console.log('Signer Name:', sig.signerName);
      console.log('Signer Email:', sig.signerEmail);
      console.log('Signed At:', sig.signedAt);
      console.log('CIM Document ID:', sig.cimDocumentId);

      // Check PDF content
      const pdfLength = sig.signedNdaContent?.length || 0;
      console.log('PDF Content Length:', pdfLength);

      if (pdfLength > 0) {
        try {
          const buffer = Buffer.from(sig.signedNdaContent, 'base64');
          const header = buffer.toString('utf8', 0, 4);
          console.log('PDF Header:', header);
          console.log('PDF Valid:', header.startsWith('%PDF') ? '✅ YES' : '❌ NO');
          console.log('PDF Size:', buffer.length, 'bytes');
        } catch (e) {
          console.log('PDF Validation Error:', e);
        }
      } else {
        console.log('PDF Valid: ❌ EMPTY');
      }
    });

    console.log('\n=== END ===\n');
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkRecentNDA();
