/**
 * Migration script to add UTM attribution columns to users table
 * Run with: npx tsx scripts/add-attribution-columns.ts
 */

import { neon } from '@neondatabase/serverless';

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log('Adding attribution columns to users table...');

  try {
    // Add all columns in a single transaction
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS utm_source TEXT,
      ADD COLUMN IF NOT EXISTS utm_medium TEXT,
      ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
      ADD COLUMN IF NOT EXISTS utm_term TEXT,
      ADD COLUMN IF NOT EXISTS utm_content TEXT,
      ADD COLUMN IF NOT EXISTS referrer_url TEXT,
      ADD COLUMN IF NOT EXISTS landing_page TEXT
    `;

    console.log('  ✓ Added column: utm_source');
    console.log('  ✓ Added column: utm_medium');
    console.log('  ✓ Added column: utm_campaign');
    console.log('  ✓ Added column: utm_term');
    console.log('  ✓ Added column: utm_content');
    console.log('  ✓ Added column: referrer_url');
    console.log('  ✓ Added column: landing_page');

    console.log('\n✅ Migration complete!');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('Columns already exist, migration not needed.');
    } else {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  }
}

migrate();
