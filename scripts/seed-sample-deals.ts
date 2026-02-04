/**
 * Seed Sample Deals for robert@dealve.cc
 * Creates 10 example businesses for sale with companies, contacts, and deals
 *
 * Run with: npx tsx scripts/seed-sample-deals.ts
 */

import { db } from '../server/db';
import { users, organizations, organizationMembers, companies, crmContacts, deals, pipelines, pipelineStages, dealContacts } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

// Fake avatar/logo URLs using UI Avatars and placeholder services
const getAvatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200`;

const getCompanyLogoUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=200&bold=true`;

// Sample business data - small businesses for sale $50k-$600k
// Pipeline stages: Lead, First Contact, Proposal, Negotiation, Won, Lost
const sampleBusinesses = [
  {
    business: {
      name: "Sunny Side Cafe",
      industry: "Food & Beverage",
      description: "Profitable breakfast and brunch cafe in downtown location with loyal customer base. 15 years in business.",
      amount: "285000",
      website: "https://sunnysidecafe.example.com",
      city: "Austin",
      state: "TX",
      annualRevenue: "$420,000",
    },
    contact: {
      firstName: "Margaret",
      lastName: "Chen",
      email: "margaret.chen@email.com",
      title: "Owner",
      phone: "(512) 555-0142",
    },
    stage: "Proposal",
    probability: 40,
    closeDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
  },
  {
    business: {
      name: "QuickFix Auto Repair",
      industry: "Automotive",
      description: "Full-service auto repair shop with 4 bays, established clientele. Owner retiring after 20 years.",
      amount: "175000",
      website: "https://quickfixauto.example.com",
      city: "Denver",
      state: "CO",
      annualRevenue: "$380,000",
    },
    contact: {
      firstName: "Robert",
      lastName: "Martinez",
      email: "r.martinez@quickfix.com",
      title: "Owner/Operator",
      phone: "(303) 555-0198",
    },
    stage: "First Contact",
    probability: 20,
    closeDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
  },
  {
    business: {
      name: "Precision Landscaping LLC",
      industry: "Home Services",
      description: "Residential landscaping company with 200+ recurring clients. Includes all equipment and trained crew.",
      amount: "320000",
      website: null,
      city: "Phoenix",
      state: "AZ",
      annualRevenue: "$550,000",
    },
    contact: {
      firstName: "David",
      lastName: "Thompson",
      email: "david.t@precisionlandscaping.net",
      title: "Managing Partner",
      phone: "(480) 555-0267",
    },
    stage: "Proposal",
    probability: 60,
    closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  },
  {
    business: {
      name: "Cozy Corner Bookshop",
      industry: "Retail",
      description: "Beloved independent bookstore with cafe. Prime location, strong community presence, online sales channel.",
      amount: "125000",
      website: "https://cozycornerbooks.example.com",
      city: "Portland",
      state: "OR",
      annualRevenue: "$290,000",
    },
    contact: {
      firstName: "Sarah",
      lastName: "Williams",
      email: "sarah@cozycornerbooks.com",
      title: "Owner",
      phone: "(503) 555-0334",
    },
    stage: "Negotiation",
    probability: 75,
    closeDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days
  },
  {
    business: {
      name: "CleanPro Commercial Services",
      industry: "Business Services",
      description: "Commercial cleaning company with 35 contracted clients. Recurring revenue model, minimal owner involvement.",
      amount: "480000",
      website: "https://cleanproservices.example.com",
      city: "Nashville",
      state: "TN",
      annualRevenue: "$720,000",
    },
    contact: {
      firstName: "Michael",
      lastName: "Johnson",
      email: "mjohnson@cleanpro.biz",
      title: "CEO",
      phone: "(615) 555-0421",
    },
    stage: "Negotiation",
    probability: 85,
    closeDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
  },
  {
    business: {
      name: "Paws & Claws Pet Grooming",
      industry: "Pet Services",
      description: "Upscale pet grooming salon with loyal clientele. Turnkey operation with trained staff.",
      amount: "95000",
      website: "https://pawsandclawsgrooming.example.com",
      city: "San Diego",
      state: "CA",
      annualRevenue: "$185,000",
    },
    contact: {
      firstName: "Jennifer",
      lastName: "Adams",
      email: "jen.adams@pawsclaws.com",
      title: "Owner",
      phone: "(619) 555-0512",
    },
    stage: "Lead",
    probability: 15,
    closeDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days
  },
  {
    business: {
      name: "Mountain View HVAC",
      industry: "Trades & Construction",
      description: "Established HVAC installation and repair company. Strong reputation, service contracts with 150 homes.",
      amount: "545000",
      website: "https://mountainviewhvac.example.com",
      city: "Salt Lake City",
      state: "UT",
      annualRevenue: "$890,000",
    },
    contact: {
      firstName: "Thomas",
      lastName: "Garcia",
      email: "tgarcia@mvhvac.com",
      title: "Owner",
      phone: "(801) 555-0678",
    },
    stage: "First Contact",
    probability: 35,
    closeDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
  },
  {
    business: {
      name: "Digital Print Express",
      industry: "Business Services",
      description: "Print shop and sign company with commercial accounts. Modern equipment, trained staff included.",
      amount: "210000",
      website: "https://digitalprintexpress.example.com",
      city: "Atlanta",
      state: "GA",
      annualRevenue: "$340,000",
    },
    contact: {
      firstName: "Lisa",
      lastName: "Brown",
      email: "lisa.brown@dpexpress.com",
      title: "President",
      phone: "(404) 555-0789",
    },
    stage: "Proposal",
    probability: 50,
    closeDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // 35 days
  },
  {
    business: {
      name: "Serenity Day Spa",
      industry: "Health & Wellness",
      description: "Full-service day spa in affluent area. 8 treatment rooms, established brand, strong Yelp reviews.",
      amount: "375000",
      website: "https://serenitydayspa.example.com",
      city: "Scottsdale",
      state: "AZ",
      annualRevenue: "$520,000",
    },
    contact: {
      firstName: "Amanda",
      lastName: "Taylor",
      email: "amanda@serenityspa.com",
      title: "Founder & Owner",
      phone: "(480) 555-0856",
    },
    stage: "Won",
    probability: 100,
    closeDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (closed)
  },
  {
    business: {
      name: "FreshBite Food Truck",
      industry: "Food & Beverage",
      description: "Popular gourmet food truck with established routes and event contracts. Includes truck and all equipment.",
      amount: "68000",
      website: "https://freshbitefoodtruck.example.com",
      city: "Miami",
      state: "FL",
      annualRevenue: "$145,000",
    },
    contact: {
      firstName: "Carlos",
      lastName: "Rodriguez",
      email: "carlos@freshbite.io",
      title: "Owner",
      phone: "(305) 555-0923",
    },
    stage: "Lost",
    probability: 0,
    closeDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (lost)
  },
];

async function seedSampleDeals() {
  console.log('Starting sample deals seed for robert@dealve.cc...\n');

  // 1. Find the user
  const [user] = await db.select().from(users).where(eq(users.email, 'robert@dealve.cc'));
  if (!user) {
    console.error('User robert@dealve.cc not found!');
    process.exit(1);
  }
  console.log(`Found user: ${user.email} (ID: ${user.id})`);

  // 2. Find their organization membership
  const [membership] = await db.select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id));

  if (!membership) {
    console.error('User has no organization membership!');
    process.exit(1);
  }
  console.log(`Found organization membership (Org ID: ${membership.organizationId})`);

  const organizationId = membership.organizationId;
  const ownerId = membership.id; // Use membership ID as owner

  // 3. Find the default pipeline and its stages
  const [pipeline] = await db.select()
    .from(pipelines)
    .where(and(
      eq(pipelines.organizationId, organizationId),
      eq(pipelines.isDefault, true)
    ));

  if (!pipeline) {
    console.error('No default pipeline found for organization!');
    process.exit(1);
  }
  console.log(`Found pipeline: ${pipeline.name} (ID: ${pipeline.id})`);

  // Get all stages for this pipeline
  const stages = await db.select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipeline.id));

  console.log(`Found ${stages.length} stages:`, stages.map(s => s.name).join(', '));

  // Create a map of stage names to IDs
  const stageMap = new Map(stages.map(s => [s.name, s.id]));

  // 4. Create companies, contacts, and deals
  console.log('\nCreating sample data...\n');

  for (const sample of sampleBusinesses) {
    // Find the stage ID
    let stageId = stageMap.get(sample.stage);
    if (!stageId) {
      // Fallback to first stage if not found
      console.warn(`Stage "${sample.stage}" not found, using first stage`);
      stageId = stages[0]?.id;
      if (!stageId) {
        console.error('No stages available!');
        continue;
      }
    }

    // Create company
    const [company] = await db.insert(companies).values({
      organizationId,
      name: sample.business.name,
      industry: sample.business.industry,
      description: sample.business.description,
      website: sample.business.website,
      city: sample.business.city,
      state: sample.business.state,
      country: "USA",
      annualRevenue: sample.business.annualRevenue,
      logoUrl: getCompanyLogoUrl(sample.business.name),
      logoSource: 'manual',
      ownerId,
    }).returning();

    console.log(`  Created company: ${company.name}`);

    // Create contact
    const [contact] = await db.insert(crmContacts).values({
      organizationId,
      email: sample.contact.email,
      firstName: sample.contact.firstName,
      lastName: sample.contact.lastName,
      title: sample.contact.title,
      phone: sample.contact.phone,
      companyId: company.id,
      avatarUrl: getAvatarUrl(`${sample.contact.firstName} ${sample.contact.lastName}`),
      avatarSource: 'manual',
      contactType: 'seller',
      lifecycleStage: 'opportunity',
      ownerId,
    }).returning();

    console.log(`    Created contact: ${contact.firstName} ${contact.lastName}`);

    // Create deal
    const [deal] = await db.insert(deals).values({
      organizationId,
      name: `${sample.business.name} Acquisition`,
      amount: sample.amount,
      currency: "USD",
      pipelineId: pipeline.id,
      stageId: stageId,
      probability: sample.probability,
      closeDate: sample.closeDate,
      closedAt: sample.stage === 'Closed Won' || sample.stage === 'Closed Lost'
        ? sample.closeDate
        : null,
      companyId: company.id,
      ownerId,
      source: 'Manual Entry',
    }).returning();

    console.log(`    Created deal: ${deal.name} ($${Number(sample.business.amount).toLocaleString()}) - ${sample.stage}`);

    // Link contact to deal
    await db.insert(dealContacts).values({
      dealId: deal.id,
      contactId: contact.id,
      role: 'Seller',
      isPrimary: true,
    });

    console.log(`    Linked contact to deal\n`);
  }

  console.log('\n✅ Sample data seeding complete!');
  console.log(`   Created ${sampleBusinesses.length} companies, contacts, and deals for robert@dealve.cc`);

  process.exit(0);
}

seedSampleDeals().catch(err => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
