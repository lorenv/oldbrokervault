import { storage } from './server/storage.ts';
import { migrateImagesToFiles } from './server/migrate-images.ts';

async function runMigration() {
  console.log('🚀 Starting comprehensive image migration...');
  
  try {
    const result = await migrateImagesToFiles();
    
    if (result.success) {
      console.log('\n✅ Migration completed successfully!');
      console.log(`📊 Statistics:`);
      console.log(`   - Total processed: ${result.stats.totalProcessed}`);
      console.log(`   - Successfully migrated: ${result.stats.successfulMigrations}`);
      console.log(`   - Failed: ${result.stats.failedMigrations}`);
      console.log(`   - Skipped (already files): ${result.stats.skipped}`);
    } else {
      console.error('❌ Migration failed:', result.error);
    }
  } catch (error) {
    console.error('💥 Migration script error:', error);
  }
  
  process.exit(0);
}

runMigration();