/**
 * Test script to simulate what the briefing API returns
 * Run with: npx tsx test-briefing-api.ts
 */
import { db } from "./server/db";
import {
  deals,
  pipelineStages,
  crmTasks,
  crmActivities,
} from "./shared/schema";
import { eq, and, desc, sql, inArray, isNull, gte, lte } from "drizzle-orm";

async function testBriefingAPI() {
  console.log('\n🔍 Testing briefing API logic...\n');

  // Use organization ID 1 (from the debug output)
  const orgId = 1;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get all open deals
  const openDeals = await db
    .select({
      id: deals.id,
      name: deals.name,
      amount: deals.amount,
      stageId: deals.stageId,
      stageName: pipelineStages.name,
      closeDate: deals.closeDate,
      updatedAt: deals.updatedAt,
      createdAt: deals.createdAt
    })
    .from(deals)
    .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(
      and(
        eq(deals.organizationId, orgId),
        isNull(deals.closedAt)
      )
    )
    .orderBy(desc(deals.updatedAt));

  console.log(`📊 Found ${openDeals.length} open deals`);
  openDeals.forEach(d => {
    console.log(`  - ${d.name}: amount = "${d.amount}" (${typeof d.amount})`);
  });

  // Calculate pipeline value
  const pipelineStats = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)::float`,
      count: sql<number>`COUNT(*)::int`
    })
    .from(deals)
    .where(
      and(
        eq(deals.organizationId, orgId),
        isNull(deals.closedAt)
      )
    );

  console.log('\n📈 Pipeline stats:');
  console.log(`  Total Value: ${pipelineStats[0]?.totalValue || 0}`);
  console.log(`  Open Deals: ${pipelineStats[0]?.count || 0}`);

  // Get deals won this month
  const dealsWonThisMonth = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      totalValue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)::float`
    })
    .from(deals)
    .where(
      and(
        eq(deals.organizationId, orgId),
        eq(deals.status, 'won'),
        gte(deals.closedAt, monthStart)
      )
    );

  console.log(`  Deals Won This Month: ${dealsWonThisMonth[0]?.count || 0}`);
  console.log(`  Won Value This Month: ${dealsWonThisMonth[0]?.totalValue || 0}`);

  // Create the quickStats object that would be returned
  const quickStats = {
    pipelineValue: pipelineStats[0]?.totalValue || 0,
    openDeals: pipelineStats[0]?.count || 0,
    dealsWonThisMonth: dealsWonThisMonth[0]?.count || 0,
    wonValueThisMonth: dealsWonThisMonth[0]?.totalValue || 0
  };

  console.log('\n✅ quickStats object that should be returned:');
  console.log(JSON.stringify(quickStats, null, 2));

  process.exit(0);
}

testBriefingAPI().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
