/**
 * Seed a self-contained DEMO LOGIN with fake M&A transaction data.
 *
 * Creates (idempotent — safe to re-run):
 *   - a demo user that can log in with email/password
 *   - an organization + owner membership
 *   - a default pipeline with stages
 *   - companies, seller/buyer contacts, and deals across every stage
 *
 * Run with: npx tsx scripts/seed-demo-login.ts
 */

import { db } from '../server/db';
import {
  users,
  organizations,
  organizationMembers,
  companies,
  crmContacts,
  deals,
  pipelines,
  pipelineStages,
  dealContacts,
} from '../shared/schema';
import { hashPassword } from '../server/auth';
import { eq } from 'drizzle-orm';

// ---- Demo credentials -------------------------------------------------------
const DEMO_EMAIL = 'demo@brokervault.com';
const DEMO_PASSWORD = 'DemoDeal2026!';
// -----------------------------------------------------------------------------

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const avatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200`;
const logo = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=200&bold=true`;

// Stage names match the default pipeline created at signup.
const sampleBusinesses = [
  {
    business: { name: 'Atlas Logistics Group', industry: 'Transportation & Logistics', description: 'Regional freight & last-mile delivery company with 42 trucks and long-term contracts with 3 national retailers.', amount: '6200000', askingPrice: '6500000', annualRevenue: '$11,400,000', revenueRange: '10m_25m', profitRange: '1m_5m', website: 'https://atlaslogistics.example.com', city: 'Dallas', state: 'TX' },
    seller: { firstName: 'Raymond', lastName: 'Okafor', email: 'r.okafor@atlaslogistics.com', title: 'Founder & CEO', phone: '(214) 555-0182' },
    sellerMotivation: 'retirement', sellerTimeline: '6_months', stage: 'Negotiation', probability: 75, closeDate: days(28),
  },
  {
    business: { name: 'BrightPath Pediatric Dental', industry: 'Healthcare', description: '4-location pediatric dental group, 18 operatories, strong insurance mix and recurring patient base.', amount: '4100000', askingPrice: '4250000', annualRevenue: '$5,900,000', revenueRange: '5m_10m', profitRange: '1m_5m', website: 'https://brightpathdental.example.com', city: 'Charlotte', state: 'NC' },
    seller: { firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@brightpathdental.com', title: 'Managing Doctor / Owner', phone: '(704) 555-0231' },
    sellerMotivation: 'partner_dispute', sellerTimeline: '3_months', stage: 'Proposal', probability: 50, closeDate: days(45),
  },
  {
    business: { name: 'Summit Precision Machining', industry: 'Manufacturing', description: 'CNC machining shop serving aerospace & defense. ISO 9001 / AS9100 certified, 30 employees, $2.1M of equipment.', amount: '8750000', askingPrice: '9200000', annualRevenue: '$14,800,000', revenueRange: '10m_25m', profitRange: '1m_5m', website: 'https://summitprecision.example.com', city: 'Wichita', state: 'KS' },
    seller: { firstName: 'Gregory', lastName: 'Lindqvist', email: 'g.lindqvist@summitprecision.com', title: 'President', phone: '(316) 555-0345' },
    sellerMotivation: 'retirement', sellerTimeline: '12_months', stage: 'Qualified', probability: 25, closeDate: days(120),
  },
  {
    business: { name: 'Coastal HVAC & Refrigeration', industry: 'Trades & Construction', description: 'Commercial HVAC service & install company, 60% recurring service-contract revenue, fleet of 14 vans.', amount: '3300000', askingPrice: '3500000', annualRevenue: '$6,200,000', revenueRange: '5m_10m', profitRange: '500k_1m', website: 'https://coastalhvac.example.com', city: 'Tampa', state: 'FL' },
    seller: { firstName: 'Daniel', lastName: 'Brooks', email: 'dan.brooks@coastalhvac.com', title: 'Owner', phone: '(813) 555-0419' },
    sellerMotivation: 'burnout', sellerTimeline: '6_months', stage: 'Proposal', probability: 55, closeDate: days(38),
  },
  {
    business: { name: 'Evergreen SaaS Analytics', industry: 'Software / SaaS', description: 'B2B analytics platform, $2.4M ARR, 92% gross retention, 140 mid-market customers. Founder-led, lean team.', amount: '9600000', askingPrice: '10000000', annualRevenue: '$2,400,000', revenueRange: '1m_5m', profitRange: '500k_1m', website: 'https://evergreenanalytics.example.com', city: 'Austin', state: 'TX' },
    seller: { firstName: 'Mei', lastName: 'Tanaka', email: 'mei@evergreenanalytics.io', title: 'Co-Founder & CEO', phone: '(512) 555-0573' },
    sellerMotivation: 'new_venture', sellerTimeline: '3_months', stage: 'Negotiation', probability: 80, closeDate: days(21),
  },
  {
    business: { name: 'Ironclad Security Services', industry: 'Business Services', description: 'Commercial security guarding & monitoring, 220 W-2 guards, multi-year contracts with property managers.', amount: '5400000', askingPrice: '5600000', annualRevenue: '$9,100,000', revenueRange: '5m_10m', profitRange: '1m_5m', website: 'https://ironcladsecurity.example.com', city: 'Phoenix', state: 'AZ' },
    seller: { firstName: 'Marcus', lastName: 'Reyes', email: 'mreyes@ironcladsecurity.com', title: 'CEO', phone: '(602) 555-0628' },
    sellerMotivation: 'health', sellerTimeline: 'immediate', stage: 'Lead', probability: 10, closeDate: days(150),
  },
  {
    business: { name: 'Harvest Table Food Co.', industry: 'Food & Beverage', description: 'Specialty packaged-foods manufacturer with national retail distribution and a growing DTC channel.', amount: '7200000', askingPrice: '7500000', annualRevenue: '$12,600,000', revenueRange: '10m_25m', profitRange: '1m_5m', website: 'https://harvesttablefoods.example.com', city: 'Portland', state: 'OR' },
    seller: { firstName: 'Sophia', lastName: 'Andersson', email: 'sophia@harvesttablefoods.com', title: 'Founder', phone: '(503) 555-0744' },
    sellerMotivation: 'retirement', sellerTimeline: '6_months', stage: 'Qualified', probability: 30, closeDate: days(95),
  },
  {
    business: { name: 'Meridian Property Management', industry: 'Real Estate', description: 'Residential property management firm, 1,850 doors under management, sticky recurring fee revenue.', amount: '4800000', askingPrice: '5000000', annualRevenue: '$4,300,000', revenueRange: '1m_5m', profitRange: '1m_5m', website: 'https://meridianpm.example.com', city: 'Denver', state: 'CO' },
    seller: { firstName: 'Olivia', lastName: 'Hartman', email: 'olivia@meridianpm.com', title: 'Principal Broker', phone: '(720) 555-0851' },
    sellerMotivation: 'partner_dispute', sellerTimeline: '12_months', stage: 'Lead', probability: 15, closeDate: days(180),
  },
  {
    business: { name: 'Pinnacle Aesthetics Med Spa', industry: 'Health & Wellness', description: 'Two-location medical spa with physician oversight, strong membership program and 9 treatment rooms.', amount: '5100000', askingPrice: '5300000', annualRevenue: '$6,800,000', revenueRange: '5m_10m', profitRange: '1m_5m', website: 'https://pinnacleaesthetics.example.com', city: 'Scottsdale', state: 'AZ' },
    seller: { firstName: 'Amanda', lastName: 'Whitfield', email: 'amanda@pinnacleaesthetics.com', title: 'Founder & Owner', phone: '(480) 555-0967' },
    sellerMotivation: 'retirement', sellerTimeline: 'immediate', stage: 'Won', probability: 100, closeDate: days(-7),
  },
  {
    business: { name: 'TerraForm Landscaping Holdings', industry: 'Home Services', description: 'Commercial landscaping & snow-removal roll-up candidate, 14 crews, municipal and HOA contracts.', amount: '3900000', askingPrice: '4400000', annualRevenue: '$7,700,000', revenueRange: '5m_10m', profitRange: '500k_1m', website: 'https://terraformland.example.com', city: 'Minneapolis', state: 'MN' },
    seller: { firstName: 'Lucas', lastName: 'Novak', email: 'lucas@terraformland.com', title: 'Owner / Operator', phone: '(612) 555-1043' },
    sellerMotivation: 'burnout', sellerTimeline: '6_months', stage: 'Lost', probability: 0, closeDate: days(-14),
  },
];

// A few buyer-side contacts to make the CRM feel realistic.
const buyers = [
  { firstName: 'Jonathan', lastName: 'Pierce', email: 'jpierce@cardinalcapital.com', title: 'Partner', phone: '(312) 555-2201', companyName: 'Cardinal Capital Partners', companyType: 'pe_firm', buyerType: 'financial', estimatedBudget: '$25,000,000', financialCapability: 'proof_of_funds', priorAcquisitions: 7, qualificationScore: 92, industry: 'Private Equity' },
  { firstName: 'Elena', lastName: 'Vasquez', email: 'elena@northstarsearch.com', title: 'Searcher / Principal', phone: '(206) 555-2318', companyName: 'Northstar Search Fund', companyType: 'search_fund', buyerType: 'search_fund', estimatedBudget: '$8,000,000', financialCapability: 'pre_approved', priorAcquisitions: 0, qualificationScore: 78, industry: 'Search Fund' },
  { firstName: 'William', lastName: 'Cho', email: 'wcho@meridianstrategic.com', title: 'VP Corporate Development', phone: '(415) 555-2477', companyName: 'Meridian Strategic Group', companyType: 'strategic_acquirer', buyerType: 'strategic', estimatedBudget: '$40,000,000', financialCapability: 'pre_approved', priorAcquisitions: 12, qualificationScore: 88, industry: 'Industrial Holdings' },
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 7);

async function seed() {
  console.log('\n=== Seeding demo login + fake M&A data ===\n');

  // 1. User (idempotent)
  let [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
  if (user) {
    console.log(`User ${DEMO_EMAIL} already exists (ID ${user.id}). Resetting password + plan.`);
    [user] = await db
      .update(users)
      // 'pro' plan has an unlimited document/regeneration limit, so the demo
      // account can freely generate CIMs without hitting the free-tier cap of 1.
      .set({ password: await hashPassword(DEMO_PASSWORD), subscriptionStatus: 'pro' })
      .where(eq(users.id, user.id))
      .returning();
  } else {
    [user] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        password: await hashPassword(DEMO_PASSWORD),
        firstName: 'Demo',
        lastName: 'Broker',
        businessName: 'BrokerVault Demo Advisory',
        emailVerified: true,
        // 'pro' plan = unlimited CIMs so the demo account isn't blocked by the
        // free-tier 1-document cap.
        subscriptionStatus: 'pro',
        authProvider: 'local',
      })
      .returning();
    console.log(`Created user ${DEMO_EMAIL} (ID ${user.id}).`);
  }

  // 2. Organization + membership (reuse if present)
  let [membership] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id));

  let organizationId: number;
  if (membership) {
    organizationId = membership.organizationId;
    console.log(`Reusing organization ID ${organizationId}.`);
  } else {
    const [org] = await db
      .insert(organizations)
      .values({ name: 'BrokerVault Demo Advisory', slug: slugify('brokervault-demo'), ownerId: user.id })
      .returning();
    [membership] = await db
      .insert(organizationMembers)
      .values({ organizationId: org.id, userId: user.id, role: 'owner', status: 'active', joinedAt: new Date() })
      .returning();
    organizationId = org.id;
    console.log(`Created organization ID ${organizationId}.`);
  }
  const ownerId = membership.id;

  // 3. Default pipeline + stages (reuse if present)
  let [pipeline] = await db.select().from(pipelines).where(eq(pipelines.organizationId, organizationId));
  if (!pipeline) {
    [pipeline] = await db
      .insert(pipelines)
      .values({ organizationId, name: 'M&A Deal Pipeline', isDefault: true })
      .returning();
    const defaultStages = [
      { name: 'Lead', displayOrder: 0, probability: 10, color: '#D1FAE5' },
      { name: 'Qualified', displayOrder: 1, probability: 25, color: '#A7F3D0' },
      { name: 'Proposal', displayOrder: 2, probability: 50, color: '#6EE7B7' },
      { name: 'Negotiation', displayOrder: 3, probability: 75, color: '#34D399' },
      { name: 'Won', displayOrder: 4, probability: 100, color: '#10B981', isWon: true },
      { name: 'Lost', displayOrder: 5, probability: 0, color: '#FCA5A5', isLost: true },
    ];
    for (const stage of defaultStages) {
      await db.insert(pipelineStages).values({ pipelineId: pipeline.id, ...stage });
    }
    console.log(`Created pipeline "${pipeline.name}" with ${defaultStages.length} stages.`);
  } else {
    console.log(`Reusing pipeline "${pipeline.name}" (ID ${pipeline.id}).`);
  }

  const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id));
  const stageMap = new Map(stages.map((s) => [s.name, s.id]));

  // 4. Buyer contacts + their firms
  console.log('\nCreating buyer-side contacts...');
  for (const b of buyers) {
    const [company] = await db
      .insert(companies)
      .values({
        organizationId,
        name: b.companyName,
        industry: b.industry,
        companyType: b.companyType,
        country: 'USA',
        logoUrl: logo(b.companyName),
        logoSource: 'manual',
        ownerId,
      })
      .returning();
    await db.insert(crmContacts).values({
      organizationId,
      email: b.email,
      firstName: b.firstName,
      lastName: b.lastName,
      title: b.title,
      phone: b.phone,
      companyId: company.id,
      avatarUrl: avatar(`${b.firstName} ${b.lastName}`),
      avatarSource: 'manual',
      contactType: 'buyer',
      buyerType: b.buyerType,
      financialCapability: b.financialCapability,
      estimatedBudget: b.estimatedBudget,
      priorAcquisitions: b.priorAcquisitions,
      qualificationScore: b.qualificationScore,
      lifecycleStage: 'opportunity',
      ownerId,
    });
    console.log(`  Buyer: ${b.firstName} ${b.lastName} — ${b.companyName}`);
  }

  // 5. Sell-side deals (company + seller contact + deal)
  console.log('\nCreating sell-side deals...');
  for (const s of sampleBusinesses) {
    const stageId = stageMap.get(s.stage) ?? stages[0].id;

    const [company] = await db
      .insert(companies)
      .values({
        organizationId,
        name: s.business.name,
        industry: s.business.industry,
        description: s.business.description,
        website: s.business.website,
        city: s.business.city,
        state: s.business.state,
        country: 'USA',
        annualRevenue: s.business.annualRevenue,
        companyType: 'individual',
        logoUrl: logo(s.business.name),
        logoSource: 'manual',
        ownerId,
      })
      .returning();

    const [contact] = await db
      .insert(crmContacts)
      .values({
        organizationId,
        email: s.seller.email,
        firstName: s.seller.firstName,
        lastName: s.seller.lastName,
        title: s.seller.title,
        phone: s.seller.phone,
        companyId: company.id,
        avatarUrl: avatar(`${s.seller.firstName} ${s.seller.lastName}`),
        avatarSource: 'manual',
        contactType: 'seller',
        lifecycleStage: 'opportunity',
        ownerId,
      })
      .returning();

    const closed = s.stage === 'Won' || s.stage === 'Lost';
    const [deal] = await db
      .insert(deals)
      .values({
        organizationId,
        name: `${s.business.name} Acquisition`,
        amount: s.business.amount,
        currency: 'USD',
        pipelineId: pipeline.id,
        stageId,
        probability: s.probability,
        closeDate: s.closeDate,
        closedAt: closed ? s.closeDate : null,
        companyId: company.id,
        askingPrice: s.business.askingPrice,
        revenueRange: s.business.revenueRange,
        profitRange: s.business.profitRange,
        industry: s.business.industry,
        businessDescription: s.business.description,
        sellerMotivation: s.sellerMotivation,
        sellerTimeline: s.sellerTimeline,
        ownerId,
        source: 'Demo Seed',
      })
      .returning();

    await db.insert(dealContacts).values({ dealId: deal.id, contactId: contact.id, role: 'Seller', isPrimary: true });

    console.log(`  ${s.stage.padEnd(12)} $${Number(s.business.amount).toLocaleString().padStart(11)}  ${s.business.name}`);
  }

  console.log('\n✅ Done.');
  console.log('\n──────────────────────────────────────────────');
  console.log('  DEMO LOGIN');
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log('──────────────────────────────────────────────\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
