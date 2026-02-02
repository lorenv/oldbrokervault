/**
 * Debug script to check cached briefing data
 * Run with: npx tsx debug-briefing-cache.ts
 */
import { db } from "./server/db";
import { dashboardBriefings } from "./shared/schema";
import { desc } from "drizzle-orm";

async function debugBriefingCache() {
  console.log('\n🔍 Checking cached briefings...\n');

  const cached = await db
    .select()
    .from(dashboardBriefings)
    .orderBy(desc(dashboardBriefings.generatedAt))
    .limit(5);

  console.log(`Found ${cached.length} cached briefings:\n`);

  cached.forEach((briefing, index) => {
    console.log(`${index + 1}. Cached on: ${briefing.validForDate}`);
    console.log(`   Generated at: ${briefing.generatedAt}`);
    console.log(`   User ID: ${briefing.userId}`);
    console.log(`   Org ID: ${briefing.organizationId}`);

    const quickStats = (briefing.briefing as any)?.quickStats;
    if (quickStats) {
      console.log(`   Quick Stats:`);
      console.log(`     - Pipeline Value: ${quickStats.pipelineValue}`);
      console.log(`     - Open Deals: ${quickStats.openDeals}`);
      console.log(`     - Deals Won This Month: ${quickStats.dealsWonThisMonth}`);
      console.log(`     - Won Value This Month: ${quickStats.wonValueThisMonth}`);
    }
    console.log('\n');
  });

  process.exit(0);
}

debugBriefingCache().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
