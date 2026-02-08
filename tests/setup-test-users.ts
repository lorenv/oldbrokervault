// Temporary script to add test users to the same organization
import { db } from '../server/db.js';
import { organizationMembers } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function addTestMembers() {
  const orgId = 7;   // Owner's org
  const adminId = 187;
  const memberId = 188;

  // Remove admin's auto-created org membership, add to owner's org as admin
  await db.delete(organizationMembers).where(eq(organizationMembers.userId, adminId));
  await db.insert(organizationMembers).values({
    organizationId: orgId,
    userId: adminId,
    role: 'admin',
    invitedBy: 186,
    invitedAt: new Date(),
    joinedAt: new Date(),
    status: 'active',
  });
  console.log('Added admin (187) to org', orgId);

  // Remove member's auto-created org membership, add to owner's org as member
  await db.delete(organizationMembers).where(eq(organizationMembers.userId, memberId));
  await db.insert(organizationMembers).values({
    organizationId: orgId,
    userId: memberId,
    role: 'member',
    invitedBy: 186,
    invitedAt: new Date(),
    joinedAt: new Date(),
    status: 'active',
  });
  console.log('Added member (188) to org', orgId);

  // Verify all 4 are in the same org
  const members = await db.select().from(organizationMembers).where(
    eq(organizationMembers.organizationId, orgId)
  );

  console.log('\nOrg', orgId, 'members:');
  for (const m of members) {
    console.log(`  User ${m.userId} - Role: ${m.role} - Status: ${m.status}`);
  }

  process.exit(0);
}

addTestMembers();
