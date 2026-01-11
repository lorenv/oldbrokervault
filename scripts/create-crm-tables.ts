import { sql } from "drizzle-orm";
import { db } from "../server/db";

async function createCrmTables() {
  console.log("Creating CRM tables...");

  // Create organizations table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      owner_id INTEGER NOT NULL,
      settings JSONB NOT NULL DEFAULT '{}',
      subscription_tier TEXT DEFAULT 'free',
      seat_count INTEGER NOT NULL DEFAULT 1,
      logo_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ organizations table created");

  // Create organization_members table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organization_members (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      invited_by INTEGER,
      invited_at TIMESTAMP,
      joined_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ organization_members table created");

  // Create companies table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      domain TEXT,
      website TEXT,
      industry TEXT,
      size TEXT,
      annual_revenue TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      phone TEXT,
      linkedin_url TEXT,
      owner_id INTEGER,
      custom_properties JSONB NOT NULL DEFAULT '{}',
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ companies table created");

  // Create crm_contacts table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_contacts (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      title TEXT,
      department TEXT,
      company_id INTEGER,
      owner_id INTEGER,
      lifecycle_stage TEXT DEFAULT 'lead',
      lead_status TEXT DEFAULT 'new',
      custom_properties JSONB NOT NULL DEFAULT '{}',
      source TEXT,
      last_activity_date TIMESTAMP,
      linkedin_url TEXT,
      notes TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ crm_contacts table created");

  // Create pipelines table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pipelines (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT false,
      deal_rotting INTEGER DEFAULT 30,
      currency TEXT DEFAULT 'USD',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ pipelines table created");

  // Create pipeline_stages table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id SERIAL PRIMARY KEY,
      pipeline_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      probability INTEGER DEFAULT 0,
      color TEXT DEFAULT '#6B7280',
      is_won BOOLEAN NOT NULL DEFAULT false,
      is_lost BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ pipeline_stages table created");

  // Create deals table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deals (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount TEXT,
      currency TEXT DEFAULT 'USD',
      pipeline_id INTEGER NOT NULL,
      stage_id INTEGER NOT NULL,
      close_date TIMESTAMP,
      closed_at TIMESTAMP,
      probability INTEGER,
      owner_id INTEGER,
      company_id INTEGER,
      custom_properties JSONB NOT NULL DEFAULT '{}',
      source TEXT,
      lost_reason TEXT,
      description TEXT,
      priority TEXT DEFAULT 'normal',
      deleted_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ deals table created");

  // Create deal_contacts table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deal_contacts (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL,
      role TEXT DEFAULT 'other',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ deal_contacts table created");

  // Create deal_documents table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deal_documents (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL,
      cim_document_id INTEGER NOT NULL,
      linked_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ deal_documents table created");

  // Create crm_notes table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_notes (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      object_type TEXT NOT NULL,
      object_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      rich_content JSONB,
      is_pinned BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ crm_notes table created");

  // Create crm_activities table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_activities (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      object_type TEXT NOT NULL,
      object_id INTEGER NOT NULL,
      performed_by INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}',
      title TEXT,
      description TEXT,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ crm_activities table created");

  // Create crm_attachments table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_attachments (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      object_type TEXT NOT NULL,
      object_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ crm_attachments table created");

  // Create indexes for better performance
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(organization_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_org ON crm_contacts(organization_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pipelines_org ON pipelines(organization_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_org ON deals(organization_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON deals(pipeline_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal ON deal_contacts(deal_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deal_contacts_contact ON deal_contacts(contact_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_crm_notes_object ON crm_notes(object_type, object_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_crm_activities_object ON crm_activities(object_type, object_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_crm_attachments_object ON crm_attachments(object_type, object_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id)`);
  console.log("✓ indexes created");

  console.log("\n✅ All CRM tables created successfully!");
}

createCrmTables()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error creating CRM tables:", err);
    process.exit(1);
  });
