/**
 * Debug script to check deal amounts in database
 * Run with: npx tsx debug-deals.ts
 */
import { db } from "./server/db";
import { deals } from "./shared/schema";
import { isNull, and, eq, sql } from "drizzle-orm";

async function debugDeals() {
  console.log('\n🔍 Checking deals in database...\n');

  // Get all open deals
  const openDeals = await db
    .select({
      id: deals.id,
      name: deals.name,
      amount: deals.amount,
      currency: deals.currency,
      closedAt: deals.closedAt,
      organizationId: deals.organizationId
    })
    .from(deals)
    .where(isNull(deals.closedAt))
    .limit(20);

  console.log(`Found ${openDeals.length} open deals:\n`);

  openDeals.forEach((deal, index) => {
    console.log(`${index + 1}. "${deal.name}"`);
    console.log(`   ID: ${deal.id}`);
    console.log(`   Amount: ${deal.amount} (type: ${typeof deal.amount}, isNull: ${deal.amount === null}, isEmpty: ${deal.amount === ''})`);
    console.log(`   Currency: ${deal.currency}`);
    console.log(`   Org ID: ${deal.organizationId}\n`);
  });

  // Try to sum the amounts
  const sumResult = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)::float`,
      count: sql<number>`COUNT(*)::int`,
      countWithAmount: sql<number>`COUNT(${deals.amount})::int`,
      avgAmount: sql<number>`AVG(CAST(${deals.amount} AS DECIMAL))::float`
    })
    .from(deals)
    .where(isNull(deals.closedAt));

  console.log('📊 Aggregation results:');
  console.log(sumResult[0]);
  console.log('\n');

  process.exit(0);
}

debugDeals().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
