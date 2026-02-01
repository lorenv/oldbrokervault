import { sql } from "drizzle-orm";
import { db } from "../server/db";

async function addVisibilityTables() {
  console.log("Creating CRM visibility tables...");

  // Create teams table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ teams table created");

  // Create team_members table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      organization_member_id INTEGER NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
      added_by INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(team_id, organization_member_id)
    )
  `);
  console.log("✓ team_members table created");

  // Create deal_collaborators table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deal_collaborators (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      organization_member_id INTEGER NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
      permission TEXT NOT NULL DEFAULT 'view',
      invited_by INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(deal_id, organization_member_id)
    )
  `);
  console.log("✓ deal_collaborators table created");

  // Create indexes for better performance
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(organization_member_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deal_collaborators_deal ON deal_collaborators(deal_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deal_collaborators_member ON deal_collaborators(organization_member_id)`);
  console.log("✓ indexes created");

  console.log("\n✅ All CRM visibility tables created successfully!");
}

addVisibilityTables()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error creating visibility tables:", err);
    process.exit(1);
  });
