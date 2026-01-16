import { Router } from 'express';
import { db } from '../db';
import {
  organizations,
  organizationMembers,
  companies,
  crmContacts,
  pipelines,
  pipelineStages,
  deals,
  dealContacts,
  dealDocuments,
  crmNotes,
  crmActivities,
  crmAttachments,
  crmTasks,
  users,
  cimDocuments,
  investorContacts,
  buyerPipelineStages,
  dealBuyers,
  integrationConnections,
  customFieldDefinitions,
  detailPageLayouts,
  dealViews,
  notifications,
  mentions,
  emailTemplates,
  insertOrganizationSchema,
  insertDealViewSchema,
  insertOrganizationMemberSchema,
  insertCompanySchema,
  insertCrmContactSchema,
  insertPipelineSchema,
  insertPipelineStageSchema,
  insertDealSchema,
  insertDealContactSchema,
  insertDealDocumentSchema,
  insertCrmNoteSchema,
  insertCrmActivitySchema,
  insertCrmAttachmentSchema,
  insertCrmTaskSchema,
  updateCrmTaskSchema,
  insertBuyerPipelineStageSchema,
  insertDealBuyerSchema,
  insertCustomFieldDefinitionSchema,
  ORGANIZATION_ROLES,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_OBJECT_TYPES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_REMINDER_OPTIONS,
  type OrganizationRole,
} from '@shared/schema';
import { eq, and, or, desc, asc, sql, isNull, inArray, ilike } from 'drizzle-orm';
import * as crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { gmailProvider } from '../integrations/providers/gmail';
import { microsoftProvider } from '../integrations/providers/microsoft';

const router = Router();

// File upload configuration for CRM attachments
const crmUploadsDir = path.join(process.cwd(), 'private', 'crm-attachments');
fs.mkdir(crmUploadsDir, { recursive: true }).catch(console.error);

// Allowed file types for CRM attachments (security whitelist)
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Archives (if needed)
  'application/zip',
];

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    if (ALLOWED_MIME_TYPES.includes(mimeType) && ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  },
});

// Helper to prevent path traversal attacks
function sanitizeFilePath(filePath: string, baseDir: string): string | null {
  // Remove any path traversal sequences
  const sanitized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(baseDir, sanitized);

  // Ensure the resolved path is still within the base directory
  if (!fullPath.startsWith(path.resolve(baseDir))) {
    return null; // Path traversal attempt detected
  }

  return fullPath;
}

// Generate a URL-friendly slug
function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40);
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  return `${baseSlug}-${randomSuffix}`;
}

// Helper: Get user's organization (creates one if it doesn't exist)
async function getUserOrganization(userId: number) {
  // Check if user already has an organization
  const [existingMembership] = await db
    .select({
      organization: organizations,
      membership: organizationMembers,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  if (existingMembership) {
    return existingMembership;
  }

  // Create a new organization for this user
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const orgName = user.businessName || user.email.split('@')[0] + "'s Workspace";
  const orgSlug = generateSlug(orgName);

  const [newOrg] = await db
    .insert(organizations)
    .values({
      name: orgName,
      slug: orgSlug,
      ownerId: userId,
    })
    .returning();

  const [membership] = await db
    .insert(organizationMembers)
    .values({
      organizationId: newOrg.id,
      userId: userId,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    })
    .returning();

  // Create default pipeline for the organization
  const [defaultPipeline] = await db
    .insert(pipelines)
    .values({
      organizationId: newOrg.id,
      name: 'Sales Pipeline',
      isDefault: true,
    })
    .returning();

  // Create default stages
  const defaultStages = [
    { name: 'Lead', displayOrder: 0, probability: 10, color: '#D1FAE5' },
    { name: 'Qualified', displayOrder: 1, probability: 25, color: '#A7F3D0' },
    { name: 'Proposal', displayOrder: 2, probability: 50, color: '#6EE7B7' },
    { name: 'Negotiation', displayOrder: 3, probability: 75, color: '#34D399' },
    { name: 'Won', displayOrder: 4, probability: 100, color: '#10B981', isWon: true },
    { name: 'Lost', displayOrder: 5, probability: 0, color: '#FCA5A5', isLost: true },
  ];

  for (const stage of defaultStages) {
    await db.insert(pipelineStages).values({
      pipelineId: defaultPipeline.id,
      ...stage,
    });
  }

  // Migrate existing investor contacts to CRM contacts
  try {
    const existingInvestorContacts = await db
      .select()
      .from(investorContacts)
      .where(eq(investorContacts.userId, userId));

    if (existingInvestorContacts.length > 0) {
      // Group by company to create companies first
      const companiesMap = new Map<string, number>();

      for (const contact of existingInvestorContacts) {
        if (contact.company && !companiesMap.has(contact.company)) {
          const [newCompany] = await db
            .insert(companies)
            .values({
              organizationId: newOrg.id,
              name: contact.company,
            })
            .returning();
          companiesMap.set(contact.company, newCompany.id);
        }
      }

      // Now migrate contacts
      for (const contact of existingInvestorContacts) {
        // Parse name into first/last
        const nameParts = contact.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Store engagement data in customProperties
        const customProperties: Record<string, any> = {};
        if (contact.totalDocumentViews) customProperties.totalDocumentViews = contact.totalDocumentViews;
        if (contact.totalTimeSpentMinutes) customProperties.totalTimeSpentMinutes = contact.totalTimeSpentMinutes;
        if (contact.firstSeenAt) customProperties.firstSeenAt = contact.firstSeenAt;
        if (contact.lastSeenAt) customProperties.lastSeenAt = contact.lastSeenAt;
        if (contact.ipAddress) customProperties.ipAddress = contact.ipAddress;
        if (contact.location) customProperties.location = contact.location;
        if (contact.isPotentialVpn) customProperties.isPotentialVpn = contact.isPotentialVpn;
        if (contact.lastContactDate) customProperties.lastContactDate = contact.lastContactDate;
        if (contact.nextFollowUpDate) customProperties.nextFollowUpDate = contact.nextFollowUpDate;
        customProperties.migratedFromInvestorDatabase = true;
        customProperties.originalStatus = contact.status;

        await db.insert(crmContacts).values({
          organizationId: newOrg.id,
          email: contact.email,
          firstName,
          lastName,
          companyId: contact.company ? companiesMap.get(contact.company) : null,
          notes: contact.notes,
          tags: contact.tags,
          contactType: 'buyer', // Set contact type to buyer for migrated investor contacts
          leadStatus: contact.status === 'new' ? 'new' :
                      contact.status === 'contacted' ? 'contacted' :
                      contact.status === 'interested' ? 'qualified' : 'new',
          source: 'investor_database_migration',
          lastActivityDate: contact.lastSeenAt || contact.lastContactDate,
          customProperties,
          createdAt: contact.createdAt,
        });
      }
      console.log(`[CRM] Migrated ${existingInvestorContacts.length} investor contacts for user ${userId}`);
    }
  } catch (migrationError) {
    console.error('[CRM] Error migrating investor contacts:', migrationError);
    // Don't fail org creation if migration fails
  }

  return { organization: newOrg, membership };
}

// Helper: Check user has permission in organization
async function checkOrgPermission(
  userId: number,
  organizationId: number,
  requiredRoles: OrganizationRole[] = ['owner', 'admin', 'member']
): Promise<boolean> {
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active')
      )
    );

  if (!membership) return false;
  return requiredRoles.includes(membership.role as OrganizationRole);
}

// Helper: Log activity
async function logActivity(
  organizationId: number,
  activityType: string,
  objectType: string,
  objectId: number,
  performedBy: number,
  metadata: Record<string, any> = {},
  title?: string,
  description?: string
) {
  await db.insert(crmActivities).values({
    organizationId,
    activityType,
    objectType,
    objectId,
    performedBy,
    metadata,
    title,
    description,
  });
}

// Helper: Create notification
async function createNotification(params: {
  organizationId: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  actorId?: number;
}) {
  await db.insert(notifications).values({
    organizationId: params.organizationId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    entityType: params.entityType || null,
    entityId: params.entityId || null,
    actorId: params.actorId || null,
  });
}

// Helper: Get user display name
async function getUserDisplayName(userId: number): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return 'Someone';
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return user.email.split('@')[0];
}

// ==================== ORGANIZATION ROUTES ====================

// Get current user's organization
router.get('/organization', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get member count
    const memberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgData.organization.id),
          eq(organizationMembers.status, 'active')
        )
      );

    res.json({
      ...orgData.organization,
      membership: orgData.membership,
      memberCount: Number(memberCount[0]?.count || 0),
    });
  } catch (error) {
    console.error('[CRM] Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Migrate investor contacts to CRM (manual trigger for existing orgs)
router.post('/migrate-contacts', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const userId = req.user!.id;
    const orgId = orgData.organization.id;

    // Check if already migrated
    const existingCrmContacts = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmContacts)
      .where(eq(crmContacts.organizationId, orgId));

    if (Number(existingCrmContacts[0]?.count) > 0) {
      return res.json({
        success: true,
        message: 'Contacts already exist in CRM',
        contactsMigrated: 0
      });
    }

    // Get investor contacts
    const existingInvestorContacts = await db
      .select()
      .from(investorContacts)
      .where(eq(investorContacts.userId, userId));

    if (existingInvestorContacts.length === 0) {
      return res.json({
        success: true,
        message: 'No investor contacts to migrate',
        contactsMigrated: 0
      });
    }

    // Group by company to create companies first
    const companiesMap = new Map<string, number>();

    for (const contact of existingInvestorContacts) {
      if (contact.company && !companiesMap.has(contact.company)) {
        const [newCompany] = await db
          .insert(companies)
          .values({
            organizationId: orgId,
            name: contact.company,
          })
          .returning();
        companiesMap.set(contact.company, newCompany.id);
      }
    }

    // Now migrate contacts
    for (const contact of existingInvestorContacts) {
      // Parse name into first/last
      const nameParts = contact.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Store engagement data in customProperties
      const customProperties: Record<string, any> = {};
      if (contact.totalDocumentViews) customProperties.totalDocumentViews = contact.totalDocumentViews;
      if (contact.totalTimeSpentMinutes) customProperties.totalTimeSpentMinutes = contact.totalTimeSpentMinutes;
      if (contact.firstSeenAt) customProperties.firstSeenAt = contact.firstSeenAt;
      if (contact.lastSeenAt) customProperties.lastSeenAt = contact.lastSeenAt;
      if (contact.ipAddress) customProperties.ipAddress = contact.ipAddress;
      if (contact.location) customProperties.location = contact.location;
      if (contact.isPotentialVpn) customProperties.isPotentialVpn = contact.isPotentialVpn;
      if (contact.lastContactDate) customProperties.lastContactDate = contact.lastContactDate;
      if (contact.nextFollowUpDate) customProperties.nextFollowUpDate = contact.nextFollowUpDate;
      customProperties.migratedFromInvestorDatabase = true;
      customProperties.originalStatus = contact.status;

      await db.insert(crmContacts).values({
        organizationId: orgId,
        email: contact.email,
        firstName,
        lastName,
        companyId: contact.company ? companiesMap.get(contact.company) : null,
        notes: contact.notes,
        tags: contact.tags,
        contactType: 'buyer', // Set contact type to buyer for migrated investor contacts
        leadStatus: contact.status === 'new' ? 'new' :
                    contact.status === 'contacted' ? 'contacted' :
                    contact.status === 'interested' ? 'qualified' : 'new',
        source: 'investor_database_migration',
        lastActivityDate: contact.lastSeenAt || contact.lastContactDate,
        customProperties,
        createdAt: contact.createdAt,
      });
    }

    console.log(`[CRM] Manually migrated ${existingInvestorContacts.length} investor contacts for user ${userId}`);

    res.json({
      success: true,
      message: `Migrated ${existingInvestorContacts.length} contacts`,
      contactsMigrated: existingInvestorContacts.length,
      companiesCreated: companiesMap.size
    });
  } catch (error) {
    console.error('[CRM] Error migrating contacts:', error);
    res.status(500).json({ error: 'Failed to migrate contacts' });
  }
});

// Migrate CIMs to Deals - creates deals for orphan CIMs
router.post('/migrate-cims-to-deals', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const userId = req.user!.id;
    const orgId = orgData.organization.id;

    // Get CIMs without dealId for this user
    const orphanCims = await db
      .select()
      .from(cimDocuments)
      .where(
        and(
          eq(cimDocuments.userId, userId),
          isNull(cimDocuments.dealId),
          isNull(cimDocuments.deletedAt)
        )
      );

    if (orphanCims.length === 0) {
      return res.json({
        success: true,
        message: 'No CIMs to migrate',
        dealsMigrated: 0
      });
    }

    // Get or create default pipeline
    let [defaultPipeline] = await db
      .select()
      .from(pipelines)
      .where(
        and(eq(pipelines.organizationId, orgId), eq(pipelines.isDefault, true))
      );

    if (!defaultPipeline) {
      // Get any pipeline
      [defaultPipeline] = await db
        .select()
        .from(pipelines)
        .where(eq(pipelines.organizationId, orgId))
        .limit(1);
    }

    if (!defaultPipeline) {
      return res.status(400).json({
        error: 'No pipeline found. Please set up your pipeline first.'
      });
    }

    // Get first stage of the pipeline
    const [firstStage] = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, defaultPipeline.id))
      .orderBy(asc(pipelineStages.displayOrder));

    if (!firstStage) {
      return res.status(400).json({
        error: 'No pipeline stages found. Please set up your pipeline stages first.'
      });
    }

    let dealsMigrated = 0;

    // Create a deal for each orphan CIM
    for (const cim of orphanCims) {
      // Extract deal name from CIM title or company name
      const dealName = cim.title ||
        (cim.content as any)?.companyInfo?.companyName ||
        `Deal from CIM ${cim.id}`;

      // Create the deal
      const [newDeal] = await db
        .insert(deals)
        .values({
          organizationId: orgId,
          name: dealName,
          pipelineId: defaultPipeline.id,
          stageId: firstStage.id,
          description: `Auto-created from CIM: ${cim.title || 'Untitled'}`,
          source: 'cim_migration',
        })
        .returning();

      // Update the CIM with the deal ID
      await db
        .update(cimDocuments)
        .set({ dealId: newDeal.id })
        .where(eq(cimDocuments.id, cim.id));

      // Also create a deal-document link
      await db.insert(dealDocuments).values({
        dealId: newDeal.id,
        cimDocumentId: cim.id,
      });

      dealsMigrated++;
    }

    console.log(`[CRM] Migrated ${dealsMigrated} CIMs to deals for user ${userId}`);

    res.json({
      success: true,
      message: `Created ${dealsMigrated} deals from existing CIMs`,
      dealsMigrated
    });
  } catch (error) {
    console.error('[CRM] Error migrating CIMs to deals:', error);
    res.status(500).json({ error: 'Failed to migrate CIMs to deals' });
  }
});

// Update organization
router.patch('/organization', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const hasPermission = await checkOrgPermission(req.user!.id, orgData.organization.id, ['owner', 'admin']);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, logoUrl, settings } = req.body;

    const [updated] = await db
      .update(organizations)
      .set({
        ...(name && { name }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(settings && { settings }),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgData.organization.id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// ==================== TEAM MEMBER ROUTES ====================

// Get organization members
router.get('/organization/members', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const members = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        status: organizationMembers.status,
        joinedAt: organizationMembers.joinedAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePhoto: users.profilePhoto,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, orgData.organization.id))
      .orderBy(asc(organizationMembers.createdAt));

    res.json(members);
  } catch (error) {
    console.error('[CRM] Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Invite team member
router.post('/organization/members/invite', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const hasPermission = await checkOrgPermission(req.user!.id, orgData.organization.id, ['owner', 'admin']);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only owners and admins can invite members' });
    }

    const { email, role } = req.body;

    // Check if user exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, email));

    if (!existingUser) {
      return res.status(400).json({ error: 'User with this email does not exist. They need to create an account first.' });
    }

    // Check if already a member
    const [existingMembership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgData.organization.id),
          eq(organizationMembers.userId, existingUser.id)
        )
      );

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member of this organization' });
    }

    // Add as member
    const [newMember] = await db
      .insert(organizationMembers)
      .values({
        organizationId: orgData.organization.id,
        userId: existingUser.id,
        role: role || 'member',
        status: 'active',
        invitedBy: req.user!.id,
        invitedAt: new Date(),
        joinedAt: new Date(),
      })
      .returning();

    res.json({
      ...newMember,
      email: existingUser.email,
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
    });
  } catch (error) {
    console.error('[CRM] Error inviting member:', error);
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

// Update member role
router.patch('/organization/members/:memberId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const memberId = parseInt(req.params.memberId);
    const { role } = req.body;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const hasPermission = await checkOrgPermission(req.user!.id, orgData.organization.id, ['owner', 'admin']);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Can't change owner's role
    const [targetMember] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.id, memberId));

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (targetMember.role === 'owner' && role !== 'owner') {
      return res.status(400).json({ error: 'Cannot change the owner role. Transfer ownership first.' });
    }

    const [updated] = await db
      .update(organizationMembers)
      .set({ role, updatedAt: new Date() })
      .where(eq(organizationMembers.id, memberId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Remove member
router.delete('/organization/members/:memberId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const memberId = parseInt(req.params.memberId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const hasPermission = await checkOrgPermission(req.user!.id, orgData.organization.id, ['owner', 'admin']);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const [targetMember] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.id, memberId));

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (targetMember.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove the owner' });
    }

    await db
      .update(organizationMembers)
      .set({ status: 'deactivated', updatedAt: new Date() })
      .where(eq(organizationMembers.id, memberId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ==================== PIPELINE ROUTES ====================

// Get pipelines
router.get('/pipelines', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const pipelineList = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.organizationId, orgData.organization.id))
      .orderBy(desc(pipelines.isDefault), asc(pipelines.createdAt));

    // Get stages for each pipeline
    const pipelinesWithStages = await Promise.all(
      pipelineList.map(async (pipeline) => {
        const stages = await db
          .select()
          .from(pipelineStages)
          .where(eq(pipelineStages.pipelineId, pipeline.id))
          .orderBy(asc(pipelineStages.displayOrder));
        return { ...pipeline, stages };
      })
    );

    res.json(pipelinesWithStages);
  } catch (error) {
    console.error('[CRM] Error fetching pipelines:', error);
    res.status(500).json({ error: 'Failed to fetch pipelines' });
  }
});

// Create pipeline
router.post('/pipelines', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const hasPermission = await checkOrgPermission(req.user!.id, orgData.organization.id, ['owner', 'admin']);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const parsed = insertPipelineSchema.safeParse({
      ...req.body,
      organizationId: orgData.organization.id,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const [newPipeline] = await db
      .insert(pipelines)
      .values(parsed.data)
      .returning();

    // Create default stages
    const defaultStages = [
      { name: 'New', displayOrder: 0, probability: 0, color: '#A7F3D0' },
      { name: 'Won', displayOrder: 1, probability: 100, color: '#10B981', isWon: true },
      { name: 'Lost', displayOrder: 2, probability: 0, color: '#FCA5A5', isLost: true },
    ];

    const stages = await Promise.all(
      defaultStages.map((stage) =>
        db
          .insert(pipelineStages)
          .values({ pipelineId: newPipeline.id, ...stage })
          .returning()
      )
    );

    res.json({ ...newPipeline, stages: stages.flat() });
  } catch (error) {
    console.error('[CRM] Error creating pipeline:', error);
    res.status(500).json({ error: 'Failed to create pipeline' });
  }
});

// Update pipeline
router.patch('/pipelines/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const pipelineId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(
        and(eq(pipelines.id, pipelineId), eq(pipelines.organizationId, orgData.organization.id))
      );

    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    const hasPermission = await checkOrgPermission(req.user!.id, orgData.organization.id, ['owner', 'admin']);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, dealRotting, currency } = req.body;

    const [updated] = await db
      .update(pipelines)
      .set({
        ...(name && { name }),
        ...(dealRotting !== undefined && { dealRotting }),
        ...(currency && { currency }),
        updatedAt: new Date(),
      })
      .where(eq(pipelines.id, pipelineId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating pipeline:', error);
    res.status(500).json({ error: 'Failed to update pipeline' });
  }
});

// ==================== PIPELINE STAGE ROUTES ====================

// Create stage
router.post('/pipelines/:pipelineId/stages', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const pipelineId = parseInt(req.params.pipelineId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(
        and(eq(pipelines.id, pipelineId), eq(pipelines.organizationId, orgData.organization.id))
      );

    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    const parsed = insertPipelineStageSchema.safeParse({
      ...req.body,
      pipelineId,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const [newStage] = await db.insert(pipelineStages).values(parsed.data).returning();

    res.json(newStage);
  } catch (error) {
    console.error('[CRM] Error creating stage:', error);
    res.status(500).json({ error: 'Failed to create stage' });
  }
});

// Update stage
router.patch('/stages/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const stageId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify stage belongs to org
    const [stage] = await db
      .select({ stage: pipelineStages, pipeline: pipelines })
      .from(pipelineStages)
      .innerJoin(pipelines, eq(pipelines.id, pipelineStages.pipelineId))
      .where(
        and(eq(pipelineStages.id, stageId), eq(pipelines.organizationId, orgData.organization.id))
      );

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const { name, displayOrder, probability, color, isWon, isLost } = req.body;

    const [updated] = await db
      .update(pipelineStages)
      .set({
        ...(name && { name }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(probability !== undefined && { probability }),
        ...(color && { color }),
        ...(isWon !== undefined && { isWon }),
        ...(isLost !== undefined && { isLost }),
        updatedAt: new Date(),
      })
      .where(eq(pipelineStages.id, stageId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating stage:', error);
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

// Reorder stages
router.post('/pipelines/:pipelineId/stages/reorder', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const pipelineId = parseInt(req.params.pipelineId);
    const { stageIds } = req.body; // Array of stage IDs in new order

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(
        and(eq(pipelines.id, pipelineId), eq(pipelines.organizationId, orgData.organization.id))
      );

    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    // Update each stage's display order
    await Promise.all(
      stageIds.map((stageId: number, index: number) =>
        db
          .update(pipelineStages)
          .set({ displayOrder: index, updatedAt: new Date() })
          .where(eq(pipelineStages.id, stageId))
      )
    );

    // Return updated stages
    const stages = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipelineId))
      .orderBy(asc(pipelineStages.displayOrder));

    res.json(stages);
  } catch (error) {
    console.error('[CRM] Error reordering stages:', error);
    res.status(500).json({ error: 'Failed to reorder stages' });
  }
});

// Delete stage
router.delete('/stages/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const stageId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify stage belongs to org and check for deals
    const [stage] = await db
      .select({ stage: pipelineStages, pipeline: pipelines })
      .from(pipelineStages)
      .innerJoin(pipelines, eq(pipelines.id, pipelineStages.pipelineId))
      .where(
        and(eq(pipelineStages.id, stageId), eq(pipelines.organizationId, orgData.organization.id))
      );

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Check if any deals are in this stage
    const dealsInStage = await db
      .select({ count: sql<number>`count(*)` })
      .from(deals)
      .where(eq(deals.stageId, stageId));

    if (Number(dealsInStage[0]?.count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete stage with deals. Move deals to another stage first.',
      });
    }

    await db.delete(pipelineStages).where(eq(pipelineStages.id, stageId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting stage:', error);
    res.status(500).json({ error: 'Failed to delete stage' });
  }
});

// ==================== CUSTOM FIELD ROUTES ====================

// Get all custom field definitions
router.get('/custom-fields', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { objectType } = req.query;

    let conditions = [eq(customFieldDefinitions.organizationId, orgData.organization.id)];

    if (objectType && typeof objectType === 'string') {
      conditions.push(eq(customFieldDefinitions.objectType, objectType));
    }

    const fields = await db
      .select()
      .from(customFieldDefinitions)
      .where(and(...conditions))
      .orderBy(asc(customFieldDefinitions.displayOrder), asc(customFieldDefinitions.createdAt));

    res.json({
      fields,
      fieldTypes: CUSTOM_FIELD_TYPES,
      objectTypes: CUSTOM_FIELD_OBJECT_TYPES
    });
  } catch (error) {
    console.error('[CRM] Error fetching custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// Create custom field definition
router.post('/custom-fields', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const parsed = insertCustomFieldDefinitionSchema.safeParse({
      ...req.body,
      organizationId: orgData.organization.id,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    // Check for duplicate field name within the same object type
    const existing = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, orgData.organization.id),
          eq(customFieldDefinitions.objectType, parsed.data.objectType),
          eq(customFieldDefinitions.name, parsed.data.name)
        )
      );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'A field with this name already exists for this object type' });
    }

    // Get the next display order
    const [maxOrder] = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${customFieldDefinitions.displayOrder}), -1)` })
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, orgData.organization.id),
          eq(customFieldDefinitions.objectType, parsed.data.objectType)
        )
      );

    const [newField] = await db
      .insert(customFieldDefinitions)
      .values({
        ...parsed.data,
        displayOrder: (maxOrder?.maxOrder ?? -1) + 1,
      })
      .returning();

    res.status(201).json(newField);
  } catch (error) {
    console.error('[CRM] Error creating custom field:', error);
    res.status(500).json({ error: 'Failed to create custom field' });
  }
});

// Update custom field definition
router.patch('/custom-fields/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const fieldId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify field belongs to org
    const [existingField] = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, fieldId),
          eq(customFieldDefinitions.organizationId, orgData.organization.id)
        )
      );

    if (!existingField) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    // Prepare update data (only allow certain fields to be updated)
    const updateData: Record<string, any> = { updatedAt: new Date() };
    const allowedFields = ['label', 'description', 'placeholder', 'options', 'isRequired', 'isVisible', 'displayOrder', 'groupName', 'minValue', 'maxValue', 'maxLength'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const [updatedField] = await db
      .update(customFieldDefinitions)
      .set(updateData)
      .where(eq(customFieldDefinitions.id, fieldId))
      .returning();

    res.json(updatedField);
  } catch (error) {
    console.error('[CRM] Error updating custom field:', error);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
});

// Delete custom field definition
router.delete('/custom-fields/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const fieldId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify field belongs to org
    const [existingField] = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, fieldId),
          eq(customFieldDefinitions.organizationId, orgData.organization.id)
        )
      );

    if (!existingField) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, fieldId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting custom field:', error);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
});

// Reorder custom fields
router.post('/custom-fields/reorder', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { fieldIds, objectType } = req.body;

    if (!Array.isArray(fieldIds) || !objectType) {
      return res.status(400).json({ error: 'fieldIds array and objectType are required' });
    }

    // Update each field's display order
    await Promise.all(
      fieldIds.map((fieldId: number, index: number) =>
        db
          .update(customFieldDefinitions)
          .set({ displayOrder: index, updatedAt: new Date() })
          .where(
            and(
              eq(customFieldDefinitions.id, fieldId),
              eq(customFieldDefinitions.organizationId, orgData.organization.id)
            )
          )
      )
    );

    // Return updated fields
    const fields = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, orgData.organization.id),
          eq(customFieldDefinitions.objectType, objectType)
        )
      )
      .orderBy(asc(customFieldDefinitions.displayOrder));

    res.json(fields);
  } catch (error) {
    console.error('[CRM] Error reordering custom fields:', error);
    res.status(500).json({ error: 'Failed to reorder custom fields' });
  }
});

// ==================== DETAIL PAGE LAYOUT ROUTES ====================

// Get layout for an object type
router.get('/layouts/:objectType', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { objectType } = req.params;
    if (!['deal', 'contact', 'company'].includes(objectType)) {
      return res.status(400).json({ error: 'Invalid object type' });
    }

    // Try to get custom layout
    const [layout] = await db
      .select()
      .from(detailPageLayouts)
      .where(
        and(
          eq(detailPageLayouts.organizationId, orgData.organization.id),
          eq(detailPageLayouts.objectType, objectType)
        )
      )
      .limit(1);

    // Also get custom fields for this object type
    const customFields = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, orgData.organization.id),
          eq(customFieldDefinitions.objectType, objectType)
        )
      )
      .orderBy(asc(customFieldDefinitions.displayOrder));

    res.json({
      layout: layout?.layout || null,
      customFields,
    });
  } catch (error) {
    console.error('[CRM] Error fetching layout:', error);
    res.status(500).json({ error: 'Failed to fetch layout' });
  }
});

// Save layout for an object type
router.post('/layouts/:objectType', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { objectType } = req.params;
    if (!['deal', 'contact', 'company'].includes(objectType)) {
      return res.status(400).json({ error: 'Invalid object type' });
    }

    const { layout } = req.body;
    if (!layout || !Array.isArray(layout)) {
      return res.status(400).json({ error: 'Layout must be an array of sections' });
    }

    // Check if layout already exists
    const [existing] = await db
      .select()
      .from(detailPageLayouts)
      .where(
        and(
          eq(detailPageLayouts.organizationId, orgData.organization.id),
          eq(detailPageLayouts.objectType, objectType)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing layout
      await db
        .update(detailPageLayouts)
        .set({ layout, updatedAt: new Date() })
        .where(eq(detailPageLayouts.id, existing.id));
    } else {
      // Create new layout
      await db.insert(detailPageLayouts).values({
        organizationId: orgData.organization.id,
        objectType,
        layout,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error saving layout:', error);
    res.status(500).json({ error: 'Failed to save layout' });
  }
});

// Reset layout to default
router.delete('/layouts/:objectType', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { objectType } = req.params;
    if (!['deal', 'contact', 'company'].includes(objectType)) {
      return res.status(400).json({ error: 'Invalid object type' });
    }

    await db
      .delete(detailPageLayouts)
      .where(
        and(
          eq(detailPageLayouts.organizationId, orgData.organization.id),
          eq(detailPageLayouts.objectType, objectType)
        )
      );

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error resetting layout:', error);
    res.status(500).json({ error: 'Failed to reset layout' });
  }
});

// ==================== COMPANY ROUTES ====================

// Get companies
router.get('/companies', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { search, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let conditions = [eq(companies.organizationId, orgData.organization.id)];

    if (search) {
      conditions.push(sql`${companies.name} ILIKE ${'%' + search + '%'}`);
    }

    const companyList = await db
      .select()
      .from(companies)
      .where(and(...conditions))
      .orderBy(desc(companies.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(eq(companies.organizationId, orgData.organization.id));

    res.json({
      companies: companyList,
      total: Number(countResult?.count || 0),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    console.error('[CRM] Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get single company
router.get('/companies/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const companyId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(
        and(eq(companies.id, companyId), eq(companies.organizationId, orgData.organization.id))
      );

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get associated contacts
    const contacts = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.companyId, companyId))
      .limit(100);

    // Get associated deals
    const companyDeals = await db
      .select()
      .from(deals)
      .where(and(eq(deals.companyId, companyId), isNull(deals.deletedAt)))
      .orderBy(desc(deals.createdAt))
      .limit(50);

    res.json({ ...company, contacts, deals: companyDeals });
  } catch (error) {
    console.error('[CRM] Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Create company
router.post('/companies', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const parsed = insertCompanySchema.safeParse({
      ...req.body,
      organizationId: orgData.organization.id,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const [newCompany] = await db.insert(companies).values(parsed.data).returning();

    // Log activity
    await logActivity(
      orgData.organization.id,
      'company_created',
      'company',
      newCompany.id,
      req.user!.id,
      { companyName: newCompany.name }
    );

    res.json(newCompany);
  } catch (error) {
    console.error('[CRM] Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Update company
router.patch('/companies/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const companyId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(companies)
      .where(
        and(eq(companies.id, companyId), eq(companies.organizationId, orgData.organization.id))
      );

    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const {
      name,
      domain,
      website,
      industry,
      size,
      annualRevenue,
      address,
      city,
      state,
      country,
      phone,
      linkedinUrl,
      ownerId,
      customProperties,
      description,
    } = req.body;

    const [updated] = await db
      .update(companies)
      .set({
        ...(name && { name }),
        ...(domain !== undefined && { domain }),
        ...(website !== undefined && { website }),
        ...(industry !== undefined && { industry }),
        ...(size !== undefined && { size }),
        ...(annualRevenue !== undefined && { annualRevenue }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(country !== undefined && { country }),
        ...(phone !== undefined && { phone }),
        ...(linkedinUrl !== undefined && { linkedinUrl }),
        ...(ownerId !== undefined && { ownerId }),
        ...(customProperties && { customProperties }),
        ...(description !== undefined && { description }),
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company
router.delete('/companies/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const companyId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(companies)
      .where(
        and(eq(companies.id, companyId), eq(companies.organizationId, orgData.organization.id))
      );

    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Remove company associations from contacts and deals
    await db
      .update(crmContacts)
      .set({ companyId: null, updatedAt: new Date() })
      .where(eq(crmContacts.companyId, companyId));

    await db
      .update(deals)
      .set({ companyId: null, updatedAt: new Date() })
      .where(eq(deals.companyId, companyId));

    await db.delete(companies).where(eq(companies.id, companyId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

// ==================== CONTACT ROUTES ====================

// Get contacts
router.get('/contacts', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { search, companyId, contactType, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let conditions = [eq(crmContacts.organizationId, orgData.organization.id)];

    if (companyId) {
      conditions.push(eq(crmContacts.companyId, parseInt(companyId as string)));
    }

    // Filter by contact type(s) - supports comma-separated values like "buyer,investor"
    if (contactType) {
      const types = (contactType as string).split(',').map(t => t.trim());
      if (types.length === 1) {
        conditions.push(eq(crmContacts.contactType, types[0]));
      } else {
        conditions.push(inArray(crmContacts.contactType, types));
      }
    }

    // Search by name, email, or company name
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          ilike(crmContacts.email, searchTerm),
          ilike(crmContacts.firstName, searchTerm),
          ilike(crmContacts.lastName, searchTerm),
          ilike(crmContacts.phone, searchTerm),
          sql`CONCAT(${crmContacts.firstName}, ' ', ${crmContacts.lastName}) ILIKE ${searchTerm}`
        )!
      );
    }

    const contactList = await db
      .select({
        contact: crmContacts,
        company: companies,
      })
      .from(crmContacts)
      .leftJoin(companies, eq(companies.id, crmContacts.companyId))
      .where(and(...conditions))
      .orderBy(desc(crmContacts.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmContacts)
      .where(and(...conditions));

    res.json({
      contacts: contactList.map((c) => ({
        ...c.contact,
        company: c.company,
      })),
      total: Number(countResult?.count || 0),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    console.error('[CRM] Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Get single contact
router.get('/contacts/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const contactId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [result] = await db
      .select({
        contact: crmContacts,
        company: companies,
      })
      .from(crmContacts)
      .leftJoin(companies, eq(companies.id, crmContacts.companyId))
      .where(
        and(eq(crmContacts.id, contactId), eq(crmContacts.organizationId, orgData.organization.id))
      );

    if (!result) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Get associated deals
    const contactDeals = await db
      .select({ deal: deals, association: dealContacts })
      .from(dealContacts)
      .innerJoin(deals, eq(deals.id, dealContacts.dealId))
      .where(and(eq(dealContacts.contactId, contactId), isNull(deals.deletedAt)));

    res.json({
      ...result.contact,
      company: result.company,
      deals: contactDeals.map((d) => ({ ...d.deal, role: d.association.role })),
    });
  } catch (error) {
    console.error('[CRM] Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// Create contact
router.post('/contacts', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const parsed = insertCrmContactSchema.safeParse({
      ...req.body,
      organizationId: orgData.organization.id,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const [newContact] = await db.insert(crmContacts).values(parsed.data).returning();

    // Log activity
    await logActivity(
      orgData.organization.id,
      'contact_created',
      'contact',
      newContact.id,
      req.user!.id,
      { contactEmail: newContact.email }
    );

    // Fetch avatar in background (don't block response)
    import('../utils/avatar-fetcher').then(({ fetchAndSaveContactAvatar }) => {
      fetchAndSaveContactAvatar(newContact.id, newContact.email, req.user!.id)
        .catch(err => console.error('[CRM] Background avatar fetch failed:', err));
    });

    res.json(newContact);
  } catch (error) {
    console.error('[CRM] Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// Update contact
router.patch('/contacts/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const contactId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(crmContacts)
      .where(
        and(eq(crmContacts.id, contactId), eq(crmContacts.organizationId, orgData.organization.id))
      );

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    const allowedFields = [
      'email',
      'firstName',
      'lastName',
      'phone',
      'title',
      'department',
      'companyId',
      'ownerId',
      'lifecycleStage',
      'leadStatus',
      'customProperties',
      'source',
      'linkedinUrl',
      'notes',
      'tags',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const [updated] = await db
      .update(crmContacts)
      .set(updateData)
      .where(eq(crmContacts.id, contactId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Delete contact
router.delete('/contacts/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const contactId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(crmContacts)
      .where(
        and(eq(crmContacts.id, contactId), eq(crmContacts.organizationId, orgData.organization.id))
      );

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Remove deal associations
    await db.delete(dealContacts).where(eq(dealContacts.contactId, contactId));

    await db.delete(crmContacts).where(eq(crmContacts.id, contactId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Refresh contact avatar
router.post('/contacts/:id/refresh-avatar', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const contactId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(
        and(eq(crmContacts.id, contactId), eq(crmContacts.organizationId, orgData.organization.id))
      );

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const { fetchAndSaveContactAvatar } = await import('../utils/avatar-fetcher');
    const result = await fetchAndSaveContactAvatar(contactId, contact.email, req.user!.id);

    res.json({
      success: true,
      avatarUrl: result.url,
      avatarSource: result.source,
    });
  } catch (error) {
    console.error('[CRM] Error refreshing contact avatar:', error);
    res.status(500).json({ error: 'Failed to refresh avatar' });
  }
});

// Bulk fetch avatars for contacts without avatars
router.post('/contacts/fetch-avatars', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get contacts without avatars
    const contactsWithoutAvatars = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.organizationId, orgData.organization.id),
          isNull(crmContacts.avatarUrl)
        )
      )
      .limit(50); // Process max 50 at a time

    if (contactsWithoutAvatars.length === 0) {
      return res.json({ message: 'All contacts already have avatars', processed: 0 });
    }

    const { fetchAndSaveContactAvatar } = await import('../utils/avatar-fetcher');

    // Process in background, return immediately with count
    const processPromises = contactsWithoutAvatars.map(contact =>
      fetchAndSaveContactAvatar(contact.id, contact.email, req.user!.id)
        .catch(err => {
          console.error(`[CRM] Avatar fetch failed for contact ${contact.id}:`, err);
          return null;
        })
    );

    // Don't await - let it process in background
    Promise.all(processPromises).then(results => {
      const successCount = results.filter(r => r?.url).length;
      console.log(`[CRM] Bulk avatar fetch completed: ${successCount}/${contactsWithoutAvatars.length} found`);
    });

    res.json({
      message: `Processing ${contactsWithoutAvatars.length} contacts`,
      processing: contactsWithoutAvatars.length,
    });
  } catch (error) {
    console.error('[CRM] Error bulk fetching avatars:', error);
    res.status(500).json({ error: 'Failed to fetch avatars' });
  }
});

// ==================== DEAL VIEWS ROUTES ====================

// Get all deal views (user's + shared org views)
router.get('/deal-views', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get user's personal views + shared org views
    const views = await db
      .select()
      .from(dealViews)
      .where(
        and(
          eq(dealViews.organizationId, orgData.organization.id),
          or(
            eq(dealViews.userId, req.user!.id), // User's own views
            eq(dealViews.isShared, true) // Shared org views
          )
        )
      )
      .orderBy(desc(dealViews.isDefault), asc(dealViews.name));

    res.json(views);
  } catch (error) {
    console.error('[CRM] Error fetching deal views:', error);
    res.status(500).json({ error: 'Failed to fetch deal views' });
  }
});

// Create a new deal view
router.post('/deal-views', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const validation = insertDealViewSchema.safeParse({
      ...req.body,
      organizationId: orgData.organization.id,
      userId: req.user!.id,
    });

    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    // If this view is being set as default, unset other defaults
    if (validation.data.isDefault) {
      await db
        .update(dealViews)
        .set({ isDefault: false })
        .where(
          and(
            eq(dealViews.organizationId, orgData.organization.id),
            eq(dealViews.userId, req.user!.id)
          )
        );
    }

    const [newView] = await db
      .insert(dealViews)
      .values({
        organizationId: orgData.organization.id,
        userId: req.user!.id,
        name: validation.data.name,
        isDefault: validation.data.isDefault || false,
        isShared: validation.data.isShared || false,
        filters: validation.data.filters || {},
        columns: validation.data.columns || [],
        sorting: validation.data.sorting || {},
        viewMode: validation.data.viewMode || 'list',
      })
      .returning();

    res.status(201).json(newView);
  } catch (error) {
    console.error('[CRM] Error creating deal view:', error);
    res.status(500).json({ error: 'Failed to create deal view' });
  }
});

// Update a deal view
router.patch('/deal-views/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const viewId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check view exists and belongs to user
    const [existingView] = await db
      .select()
      .from(dealViews)
      .where(
        and(
          eq(dealViews.id, viewId),
          eq(dealViews.organizationId, orgData.organization.id),
          eq(dealViews.userId, req.user!.id)
        )
      );

    if (!existingView) {
      return res.status(404).json({ error: 'View not found or access denied' });
    }

    // If setting as default, unset other defaults
    if (req.body.isDefault === true) {
      await db
        .update(dealViews)
        .set({ isDefault: false })
        .where(
          and(
            eq(dealViews.organizationId, orgData.organization.id),
            eq(dealViews.userId, req.user!.id),
            sql`${dealViews.id} != ${viewId}`
          )
        );
    }

    const [updatedView] = await db
      .update(dealViews)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(dealViews.id, viewId))
      .returning();

    res.json(updatedView);
  } catch (error) {
    console.error('[CRM] Error updating deal view:', error);
    res.status(500).json({ error: 'Failed to update deal view' });
  }
});

// Delete a deal view
router.delete('/deal-views/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const viewId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check view exists and belongs to user
    const [existingView] = await db
      .select()
      .from(dealViews)
      .where(
        and(
          eq(dealViews.id, viewId),
          eq(dealViews.organizationId, orgData.organization.id),
          eq(dealViews.userId, req.user!.id)
        )
      );

    if (!existingView) {
      return res.status(404).json({ error: 'View not found or access denied' });
    }

    await db.delete(dealViews).where(eq(dealViews.id, viewId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting deal view:', error);
    res.status(500).json({ error: 'Failed to delete deal view' });
  }
});

// Toggle share status of a deal view
router.post('/deal-views/:id/share', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const viewId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check view exists and belongs to user
    const [existingView] = await db
      .select()
      .from(dealViews)
      .where(
        and(
          eq(dealViews.id, viewId),
          eq(dealViews.organizationId, orgData.organization.id),
          eq(dealViews.userId, req.user!.id)
        )
      );

    if (!existingView) {
      return res.status(404).json({ error: 'View not found or access denied' });
    }

    const [updatedView] = await db
      .update(dealViews)
      .set({
        isShared: !existingView.isShared,
        updatedAt: new Date(),
      })
      .where(eq(dealViews.id, viewId))
      .returning();

    res.json(updatedView);
  } catch (error) {
    console.error('[CRM] Error toggling share status:', error);
    res.status(500).json({ error: 'Failed to toggle share status' });
  }
});

// ==================== DEAL ROUTES ====================

// Get deals (with advanced filtering, sorting, and aggregates)
router.get('/deals', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const {
      pipelineId,
      stageId,
      page = '1',
      limit = '100',
      // Advanced filters
      search,
      stages, // comma-separated stage IDs
      owners, // comma-separated owner IDs
      companies: companyIds, // comma-separated company IDs
      amountMin,
      amountMax,
      closeDateFrom,
      closeDateTo,
      createdFrom,
      createdTo,
      priority, // comma-separated priorities
      status, // 'open', 'won', 'lost', 'all'
      ownerId, // for "My Deals" filter
      // Sorting
      sortField = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let conditions: any[] = [
      eq(deals.organizationId, orgData.organization.id),
      isNull(deals.deletedAt),
    ];

    // Pipeline filter
    if (pipelineId) {
      conditions.push(eq(deals.pipelineId, parseInt(pipelineId as string)));
    }

    // Single stage filter (legacy)
    if (stageId) {
      conditions.push(eq(deals.stageId, parseInt(stageId as string)));
    }

    // Multiple stages filter
    if (stages) {
      const stageIds = (stages as string).split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
      if (stageIds.length > 0) {
        conditions.push(inArray(deals.stageId, stageIds));
      }
    }

    // Owner filter (My Deals)
    if (ownerId) {
      conditions.push(eq(deals.ownerId, parseInt(ownerId as string)));
    }

    // Multiple owners filter
    if (owners) {
      const ownerIds = (owners as string).split(',').map(o => parseInt(o.trim())).filter(o => !isNaN(o));
      if (ownerIds.length > 0) {
        conditions.push(inArray(deals.ownerId, ownerIds));
      }
    }

    // Companies filter
    if (companyIds) {
      const compIds = (companyIds as string).split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));
      if (compIds.length > 0) {
        conditions.push(inArray(deals.companyId, compIds));
      }
    }

    // Amount range filter
    if (amountMin) {
      conditions.push(sql`CAST(${deals.amount} AS DECIMAL) >= ${parseFloat(amountMin as string)}`);
    }
    if (amountMax) {
      conditions.push(sql`CAST(${deals.amount} AS DECIMAL) <= ${parseFloat(amountMax as string)}`);
    }

    // Close date range filter
    if (closeDateFrom) {
      conditions.push(sql`${deals.closeDate} >= ${new Date(closeDateFrom as string)}`);
    }
    if (closeDateTo) {
      conditions.push(sql`${deals.closeDate} <= ${new Date(closeDateTo as string)}`);
    }

    // Created date range filter
    if (createdFrom) {
      conditions.push(sql`${deals.createdAt} >= ${new Date(createdFrom as string)}`);
    }
    if (createdTo) {
      conditions.push(sql`${deals.createdAt} <= ${new Date(createdTo as string)}`);
    }

    // Priority filter
    if (priority) {
      const priorities = (priority as string).split(',').map(p => p.trim()).filter(p => p);
      if (priorities.length > 0) {
        conditions.push(inArray(deals.priority, priorities));
      }
    }

    // Status filter (open/won/lost)
    if (status && status !== 'all') {
      if (status === 'open') {
        // Open deals are those not in won or lost stages
        conditions.push(sql`${pipelineStages.isWon} = false AND ${pipelineStages.isLost} = false`);
      } else if (status === 'won') {
        conditions.push(eq(pipelineStages.isWon, true));
      } else if (status === 'lost') {
        conditions.push(eq(pipelineStages.isLost, true));
      }
    }

    // Search filter (searches deal name and company name)
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          ilike(deals.name, searchTerm),
          ilike(companies.name, searchTerm)
        )
      );
    }

    // Build sort order
    const sortFieldMap: Record<string, any> = {
      name: deals.name,
      amount: sql`CAST(${deals.amount} AS DECIMAL)`,
      closeDate: deals.closeDate,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      priority: deals.priority,
      stage: pipelineStages.displayOrder,
      company: companies.name,
    };

    const sortColumn = sortFieldMap[sortField as string] || deals.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get deals with joins
    const dealList = await db
      .select({
        deal: deals,
        stage: pipelineStages,
        company: companies,
        owner: users,
      })
      .from(deals)
      .leftJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .leftJoin(companies, eq(companies.id, deals.companyId))
      .leftJoin(users, eq(users.id, deals.ownerId))
      .where(and(...conditions))
      .orderBy(orderDirection)
      .limit(parseInt(limit as string))
      .offset(offset);

    console.log('[CRM] First deal owner from DB:', dealList[0]?.owner);

    // Get aggregates for filtered results (without pagination)
    const [aggregates] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)`,
        avgAmount: sql<string>`COALESCE(AVG(CAST(${deals.amount} AS DECIMAL)), 0)`,
        weightedAmount: sql<string>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL) * COALESCE(${pipelineStages.probability}, 0) / 100), 0)`,
      })
      .from(deals)
      .leftJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .leftJoin(companies, eq(companies.id, deals.companyId))
      .where(and(...conditions));

    res.json({
      deals: dealList.map((d) => ({
        ...d.deal,
        stage: d.stage,
        company: d.company,
        owner: d.owner ? {
          id: d.owner.id,
          email: d.owner.email,
          name: d.owner.name,
          firstName: d.owner.firstName,
          lastName: d.owner.lastName,
          profilePhoto: d.owner.profilePhoto,
        } : null,
      })),
      total: Number(aggregates?.count || 0),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      aggregates: {
        count: Number(aggregates?.count || 0),
        totalAmount: parseFloat(aggregates?.totalAmount || '0'),
        avgAmount: parseFloat(aggregates?.avgAmount || '0'),
        weightedAmount: parseFloat(aggregates?.weightedAmount || '0'),
      },
    });
  } catch (error) {
    console.error('[CRM] Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// Get deals grouped by stage (for Kanban)
router.get('/deals/kanban/:pipelineId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const pipelineId = parseInt(req.params.pipelineId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify pipeline belongs to org
    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(
        and(eq(pipelines.id, pipelineId), eq(pipelines.organizationId, orgData.organization.id))
      );

    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    // Get stages with deals
    const stages = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipelineId))
      .orderBy(asc(pipelineStages.displayOrder));

    const stagesWithDeals = await Promise.all(
      stages.map(async (stage) => {
        const stageDeals = await db
          .select({
            deal: deals,
            company: companies,
            owner: {
              id: users.id,
              email: users.email,
              name: users.name,
              firstName: users.firstName,
              lastName: users.lastName,
              profilePhoto: users.profilePhoto,
            },
          })
          .from(deals)
          .leftJoin(companies, eq(companies.id, deals.companyId))
          .leftJoin(users, eq(users.id, deals.ownerId))
          .where(
            and(
              eq(deals.stageId, stage.id),
              eq(deals.organizationId, orgData.organization.id),
              isNull(deals.deletedAt)
            )
          )
          .orderBy(desc(deals.updatedAt));

        return {
          ...stage,
          deals: stageDeals.map((d) => ({
            ...d.deal,
            company: d.company,
            owner: d.owner?.id ? d.owner : null,
          })),
        };
      })
    );

    res.json({ pipeline, stages: stagesWithDeals });
  } catch (error) {
    console.error('[CRM] Error fetching kanban:', error);
    res.status(500).json({ error: 'Failed to fetch kanban data' });
  }
});

// Get single deal
router.get('/deals/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [result] = await db
      .select({
        deal: deals,
        stage: pipelineStages,
        pipeline: pipelines,
        company: companies,
        owner: {
          id: users.id,
          email: users.email,
          name: users.name,
          firstName: users.firstName,
          lastName: users.lastName,
          profilePhoto: users.profilePhoto,
        },
      })
      .from(deals)
      .leftJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .leftJoin(pipelines, eq(pipelines.id, deals.pipelineId))
      .leftJoin(companies, eq(companies.id, deals.companyId))
      .leftJoin(users, eq(users.id, deals.ownerId))
      .where(
        and(
          eq(deals.id, dealId),
          eq(deals.organizationId, orgData.organization.id),
          isNull(deals.deletedAt)
        )
      );

    if (!result) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get associated contacts
    const contacts = await db
      .select({ contact: crmContacts, association: dealContacts })
      .from(dealContacts)
      .innerJoin(crmContacts, eq(crmContacts.id, dealContacts.contactId))
      .where(eq(dealContacts.dealId, dealId));

    // Get associated documents from junction table
    const linkedDocuments = await db
      .select({ document: cimDocuments, association: dealDocuments })
      .from(dealDocuments)
      .innerJoin(cimDocuments, eq(cimDocuments.id, dealDocuments.cimDocumentId))
      .where(eq(dealDocuments.dealId, dealId));

    // Get CIM documents that have this deal's ID directly set
    const directDocuments = await db
      .select()
      .from(cimDocuments)
      .where(
        and(
          eq(cimDocuments.dealId, dealId),
          isNull(cimDocuments.deletedAt)
        )
      );

    // Combine and deduplicate documents (in case same doc is in both)
    const linkedIds = new Set(linkedDocuments.map((d) => d.document.id));
    const allDocuments = [
      ...linkedDocuments.map((d) => d.document),
      ...directDocuments.filter((d) => !linkedIds.has(d.id)),
    ];

    res.json({
      ...result.deal,
      stage: result.stage,
      pipeline: result.pipeline,
      company: result.company,
      owner: result.owner?.id ? result.owner : null,
      contacts: contacts.map((c) => ({ ...c.contact, role: c.association.role })),
      documents: allDocuments,
    });
  } catch (error) {
    console.error('[CRM] Error fetching deal:', error);
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

// Create deal
router.post('/deals', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get default pipeline if not specified
    let { pipelineId, stageId } = req.body;

    if (!pipelineId) {
      const [defaultPipeline] = await db
        .select()
        .from(pipelines)
        .where(
          and(eq(pipelines.organizationId, orgData.organization.id), eq(pipelines.isDefault, true))
        );

      if (defaultPipeline) {
        pipelineId = defaultPipeline.id;
      }
    }

    if (!stageId && pipelineId) {
      const [firstStage] = await db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, pipelineId))
        .orderBy(asc(pipelineStages.displayOrder))
        .limit(1);

      if (firstStage) {
        stageId = firstStage.id;
      }
    }

    const parsed = insertDealSchema.safeParse({
      ...req.body,
      organizationId: orgData.organization.id,
      pipelineId,
      stageId,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const [newDeal] = await db.insert(deals).values(parsed.data).returning();

    // Log activity
    await logActivity(
      orgData.organization.id,
      'deal_created',
      'deal',
      newDeal.id,
      req.user!.id,
      { dealName: newDeal.name, amount: newDeal.amount }
    );

    // Send notification if deal is assigned to someone else
    if (newDeal.ownerId && newDeal.ownerId !== req.user!.id) {
      const assignerName = await getUserDisplayName(req.user!.id);
      await createNotification({
        organizationId: orgData.organization.id,
        userId: newDeal.ownerId,
        type: 'deal_assigned',
        title: 'Deal assigned to you',
        message: `${assignerName} assigned you a deal: "${newDeal.name}"`,
        entityType: 'deal',
        entityId: newDeal.id,
        actorId: req.user!.id,
      });
    }

    res.json(newDeal);
  } catch (error) {
    console.error('[CRM] Error creating deal:', error);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// Update deal
router.patch('/deals/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.id, dealId),
          eq(deals.organizationId, orgData.organization.id),
          isNull(deals.deletedAt)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const oldStageId = existing.stageId;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    const allowedFields = [
      'name',
      'amount',
      'currency',
      'pipelineId',
      'stageId',
      'closeDate',
      'probability',
      'ownerId',
      'companyId',
      'customProperties',
      'source',
      'lostReason',
      'description',
      'priority',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // Convert date strings to Date objects for timestamp fields
        if (field === 'closeDate' && req.body[field]) {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    // Handle stage change
    if (updateData.stageId && updateData.stageId !== oldStageId) {
      const [newStage] = await db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.id, updateData.stageId));

      const [oldStage] = await db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.id, oldStageId));

      // Check for terminal stages
      if (newStage?.isWon) {
        updateData.closedAt = new Date();
      } else if (newStage?.isLost) {
        updateData.closedAt = new Date();
      }

      // Log stage change activity
      await logActivity(
        orgData.organization.id,
        'stage_change',
        'deal',
        dealId,
        req.user!.id,
        {
          fromStage: oldStage?.name,
          toStage: newStage?.name,
          fromStageId: oldStageId,
          toStageId: updateData.stageId,
        },
        `Moved from ${oldStage?.name || 'Unknown'} to ${newStage?.name || 'Unknown'}`
      );
    }

    const [updated] = await db
      .update(deals)
      .set(updateData)
      .where(eq(deals.id, dealId))
      .returning();

    // Send notification if deal owner changed to someone new
    if (
      updated.ownerId &&
      updated.ownerId !== existing.ownerId &&
      updated.ownerId !== req.user!.id
    ) {
      const assignerName = await getUserDisplayName(req.user!.id);
      await createNotification({
        organizationId: orgData.organization.id,
        userId: updated.ownerId,
        type: 'deal_assigned',
        title: 'Deal assigned to you',
        message: `${assignerName} assigned you a deal: "${updated.name}"`,
        entityType: 'deal',
        entityId: updated.id,
        actorId: req.user!.id,
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating deal:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// Move deal to stage (for drag & drop)
router.post('/deals/:id/move', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.id);
    const { stageId, lostReason } = req.body;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.id, dealId),
          eq(deals.organizationId, orgData.organization.id),
          isNull(deals.deletedAt)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const oldStageId = existing.stageId;

    if (stageId === oldStageId) {
      return res.json(existing);
    }

    const [newStage] = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.id, stageId));

    const [oldStage] = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.id, oldStageId));

    const updateData: Record<string, any> = {
      stageId,
      updatedAt: new Date(),
    };

    // Set closedAt for terminal stages
    if (newStage?.isWon || newStage?.isLost) {
      updateData.closedAt = new Date();
    } else if (oldStage?.isWon || oldStage?.isLost) {
      // Reopening a closed deal
      updateData.closedAt = null;
      // Clear lost reason when reopening
      updateData.lostReason = null;
    }

    // Set lost reason if moving to lost stage
    if (newStage?.isLost && lostReason) {
      updateData.lostReason = lostReason;
    } else if (!newStage?.isLost) {
      // Clear lost reason if not moving to lost stage
      updateData.lostReason = null;
    }

    const [updated] = await db
      .update(deals)
      .set(updateData)
      .where(eq(deals.id, dealId))
      .returning();

    // Log activity
    const activityMetadata: Record<string, any> = {
      fromStage: oldStage?.name,
      toStage: newStage?.name,
      fromStageId: oldStageId,
      toStageId: stageId,
    };
    if (newStage?.isLost && lostReason) {
      activityMetadata.lostReason = lostReason;
    }

    await logActivity(
      orgData.organization.id,
      'stage_change',
      'deal',
      dealId,
      req.user!.id,
      activityMetadata,
      newStage?.isLost && lostReason
        ? `Moved to ${newStage?.name || 'Lost'} - Reason: ${lostReason}`
        : `Moved from ${oldStage?.name || 'Unknown'} to ${newStage?.name || 'Unknown'}`
    );

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error moving deal:', error);
    res.status(500).json({ error: 'Failed to move deal' });
  }
});

// Delete deal (soft delete)
router.delete('/deals/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.id, dealId),
          eq(deals.organizationId, orgData.organization.id),
          isNull(deals.deletedAt)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await db
      .update(deals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(deals.id, dealId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting deal:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

// ==================== DEAL ASSOCIATIONS ====================

// Add contact to deal
router.post('/deals/:dealId/contacts', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);
    const { contactId, role = 'other' } = req.body;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify deal and contact belong to org
    const [deal] = await db
      .select()
      .from(deals)
      .where(
        and(eq(deals.id, dealId), eq(deals.organizationId, orgData.organization.id))
      );

    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(
        and(eq(crmContacts.id, contactId), eq(crmContacts.organizationId, orgData.organization.id))
      );

    if (!deal || !contact) {
      return res.status(404).json({ error: 'Deal or contact not found' });
    }

    // Check if already associated
    const [existing] = await db
      .select()
      .from(dealContacts)
      .where(and(eq(dealContacts.dealId, dealId), eq(dealContacts.contactId, contactId)));

    if (existing) {
      // Update role
      const [updated] = await db
        .update(dealContacts)
        .set({ role })
        .where(eq(dealContacts.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [newAssociation] = await db
      .insert(dealContacts)
      .values({ dealId, contactId, role })
      .returning();

    res.json(newAssociation);
  } catch (error) {
    console.error('[CRM] Error adding contact to deal:', error);
    res.status(500).json({ error: 'Failed to add contact to deal' });
  }
});

// Remove contact from deal
router.delete('/deals/:dealId/contacts/:contactId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);
    const contactId = parseInt(req.params.contactId);

    await db
      .delete(dealContacts)
      .where(and(eq(dealContacts.dealId, dealId), eq(dealContacts.contactId, contactId)));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error removing contact from deal:', error);
    res.status(500).json({ error: 'Failed to remove contact from deal' });
  }
});

// Link CIM document to deal
router.post('/deals/:dealId/documents', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);
    const { cimDocumentId } = req.body;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify deal belongs to org
    const [deal] = await db
      .select()
      .from(deals)
      .where(
        and(eq(deals.id, dealId), eq(deals.organizationId, orgData.organization.id))
      );

    // Verify user owns the document
    const [doc] = await db
      .select()
      .from(cimDocuments)
      .where(
        and(eq(cimDocuments.id, cimDocumentId), eq(cimDocuments.userId, req.user!.id))
      );

    if (!deal || !doc) {
      return res.status(404).json({ error: 'Deal or document not found' });
    }

    // Check if already linked
    const [existing] = await db
      .select()
      .from(dealDocuments)
      .where(
        and(eq(dealDocuments.dealId, dealId), eq(dealDocuments.cimDocumentId, cimDocumentId))
      );

    if (existing) {
      return res.status(400).json({ error: 'Document already linked to this deal' });
    }

    const [newLink] = await db
      .insert(dealDocuments)
      .values({ dealId, cimDocumentId })
      .returning();

    res.json(newLink);
  } catch (error) {
    console.error('[CRM] Error linking document to deal:', error);
    res.status(500).json({ error: 'Failed to link document' });
  }
});

// Unlink document from deal
router.delete('/deals/:dealId/documents/:documentId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);
    const documentId = parseInt(req.params.documentId);

    await db
      .delete(dealDocuments)
      .where(
        and(eq(dealDocuments.dealId, dealId), eq(dealDocuments.cimDocumentId, documentId))
      );

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error unlinking document:', error);
    res.status(500).json({ error: 'Failed to unlink document' });
  }
});

// ==================== BUYER PIPELINE ROUTES ====================

// Get buyer pipeline stages for organization
router.get('/buyer-stages', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const stages = await db
      .select()
      .from(buyerPipelineStages)
      .where(eq(buyerPipelineStages.organizationId, orgData.organization.id))
      .orderBy(asc(buyerPipelineStages.displayOrder));

    // If no stages exist, create default ones
    if (stages.length === 0) {
      const defaultStages = [
        { name: 'Identified', displayOrder: 0, color: '#D1FAE5' },
        { name: 'Contacted', displayOrder: 1, color: '#A7F3D0' },
        { name: 'NDA Signed', displayOrder: 2, color: '#6EE7B7' },
        { name: 'CIM Sent', displayOrder: 3, color: '#34D399' },
        { name: 'IOI Received', displayOrder: 4, color: '#10B981' },
        { name: 'In DD', displayOrder: 5, color: '#059669' },
        { name: 'Passed', displayOrder: 6, color: '#FCA5A5' },
      ];

      const createdStages = [];
      for (const stage of defaultStages) {
        const [created] = await db
          .insert(buyerPipelineStages)
          .values({
            organizationId: orgData.organization.id,
            ...stage,
          })
          .returning();
        createdStages.push(created);
      }

      return res.json(createdStages);
    }

    res.json(stages);
  } catch (error) {
    console.error('[CRM] Error fetching buyer stages:', error);
    res.status(500).json({ error: 'Failed to fetch buyer stages' });
  }
});

// Create buyer pipeline stage
router.post('/buyer-stages', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const data = insertBuyerPipelineStageSchema.parse({
      ...req.body,
      organizationId: orgData.organization.id,
    });

    const [stage] = await db
      .insert(buyerPipelineStages)
      .values(data)
      .returning();

    res.json(stage);
  } catch (error) {
    console.error('[CRM] Error creating buyer stage:', error);
    res.status(500).json({ error: 'Failed to create buyer stage' });
  }
});

// Update buyer pipeline stage
router.patch('/buyer-stages/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const stageId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(buyerPipelineStages)
      .where(
        and(
          eq(buyerPipelineStages.id, stageId),
          eq(buyerPipelineStages.organizationId, orgData.organization.id)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const [updated] = await db
      .update(buyerPipelineStages)
      .set({
        name: req.body.name ?? existing.name,
        color: req.body.color ?? existing.color,
        displayOrder: req.body.displayOrder ?? existing.displayOrder,
      })
      .where(eq(buyerPipelineStages.id, stageId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating buyer stage:', error);
    res.status(500).json({ error: 'Failed to update buyer stage' });
  }
});

// Reorder buyer pipeline stages
router.post('/buyer-stages/reorder', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { stageIds } = req.body; // Array of stage IDs in new order

    if (!Array.isArray(stageIds)) {
      return res.status(400).json({ error: 'stageIds must be an array' });
    }

    for (let i = 0; i < stageIds.length; i++) {
      await db
        .update(buyerPipelineStages)
        .set({ displayOrder: i })
        .where(
          and(
            eq(buyerPipelineStages.id, stageIds[i]),
            eq(buyerPipelineStages.organizationId, orgData.organization.id)
          )
        );
    }

    const stages = await db
      .select()
      .from(buyerPipelineStages)
      .where(eq(buyerPipelineStages.organizationId, orgData.organization.id))
      .orderBy(asc(buyerPipelineStages.displayOrder));

    res.json(stages);
  } catch (error) {
    console.error('[CRM] Error reordering buyer stages:', error);
    res.status(500).json({ error: 'Failed to reorder buyer stages' });
  }
});

// Delete buyer pipeline stage
router.delete('/buyer-stages/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const stageId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if there are any buyers in this stage
    const buyersInStage = await db
      .select({ count: sql<number>`count(*)` })
      .from(dealBuyers)
      .where(eq(dealBuyers.stageId, stageId));

    if (Number(buyersInStage[0]?.count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete stage with buyers. Move buyers first.',
      });
    }

    await db
      .delete(buyerPipelineStages)
      .where(
        and(
          eq(buyerPipelineStages.id, stageId),
          eq(buyerPipelineStages.organizationId, orgData.organization.id)
        )
      );

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting buyer stage:', error);
    res.status(500).json({ error: 'Failed to delete buyer stage' });
  }
});

// ==================== DEAL BUYERS ROUTES ====================

// Get buyers for a deal grouped by stage
router.get('/deals/:dealId/buyers', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify deal belongs to org
    const [deal] = await db
      .select()
      .from(deals)
      .where(
        and(eq(deals.id, dealId), eq(deals.organizationId, orgData.organization.id))
      );

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get all buyers for this deal with contact/company info
    const buyers = await db
      .select({
        buyer: dealBuyers,
        contact: crmContacts,
        company: companies,
        stage: buyerPipelineStages,
      })
      .from(dealBuyers)
      .leftJoin(crmContacts, eq(dealBuyers.contactId, crmContacts.id))
      .leftJoin(companies, eq(dealBuyers.companyId, companies.id))
      .leftJoin(buyerPipelineStages, eq(dealBuyers.stageId, buyerPipelineStages.id))
      .where(eq(dealBuyers.dealId, dealId))
      .orderBy(asc(buyerPipelineStages.displayOrder), desc(dealBuyers.updatedAt));

    res.json(
      buyers.map((b) => ({
        ...b.buyer,
        contact: b.contact,
        company: b.company,
        stage: b.stage,
      }))
    );
  } catch (error) {
    console.error('[CRM] Error fetching deal buyers:', error);
    res.status(500).json({ error: 'Failed to fetch deal buyers' });
  }
});

// Add buyer to deal
router.post('/deals/:dealId/buyers', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify deal belongs to org
    const [deal] = await db
      .select()
      .from(deals)
      .where(
        and(eq(deals.id, dealId), eq(deals.organizationId, orgData.organization.id))
      );

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get default stage if not specified
    let { stageId } = req.body;
    if (!stageId) {
      const [firstStage] = await db
        .select()
        .from(buyerPipelineStages)
        .where(eq(buyerPipelineStages.organizationId, orgData.organization.id))
        .orderBy(asc(buyerPipelineStages.displayOrder))
        .limit(1);

      if (!firstStage) {
        return res.status(400).json({ error: 'No buyer stages configured' });
      }
      stageId = firstStage.id;
    }

    const data = insertDealBuyerSchema.parse({
      dealId,
      stageId,
      contactId: req.body.contactId || null,
      companyId: req.body.companyId || null,
      notes: req.body.notes || null,
    });

    const [buyer] = await db.insert(dealBuyers).values(data).returning();

    // Fetch the complete buyer with relations
    const [completeBuyer] = await db
      .select({
        buyer: dealBuyers,
        contact: crmContacts,
        company: companies,
        stage: buyerPipelineStages,
      })
      .from(dealBuyers)
      .leftJoin(crmContacts, eq(dealBuyers.contactId, crmContacts.id))
      .leftJoin(companies, eq(dealBuyers.companyId, companies.id))
      .leftJoin(buyerPipelineStages, eq(dealBuyers.stageId, buyerPipelineStages.id))
      .where(eq(dealBuyers.id, buyer.id));

    res.json({
      ...completeBuyer.buyer,
      contact: completeBuyer.contact,
      company: completeBuyer.company,
      stage: completeBuyer.stage,
    });
  } catch (error) {
    console.error('[CRM] Error adding deal buyer:', error);
    res.status(500).json({ error: 'Failed to add deal buyer' });
  }
});

// Update deal buyer (move stage, update notes, etc.)
router.patch('/deals/:dealId/buyers/:buyerId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);
    const buyerId = parseInt(req.params.buyerId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify buyer exists and belongs to this deal
    const [existing] = await db
      .select()
      .from(dealBuyers)
      .innerJoin(deals, eq(deals.id, dealBuyers.dealId))
      .where(
        and(
          eq(dealBuyers.id, buyerId),
          eq(dealBuyers.dealId, dealId),
          eq(deals.organizationId, orgData.organization.id)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (req.body.stageId !== undefined) updateData.stageId = req.body.stageId;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.lastContactDate !== undefined)
      updateData.lastContactDate = req.body.lastContactDate ? new Date(req.body.lastContactDate) : null;
    if (req.body.nextFollowUp !== undefined)
      updateData.nextFollowUp = req.body.nextFollowUp ? new Date(req.body.nextFollowUp) : null;

    const [updated] = await db
      .update(dealBuyers)
      .set(updateData)
      .where(eq(dealBuyers.id, buyerId))
      .returning();

    // Fetch complete buyer with relations
    const [completeBuyer] = await db
      .select({
        buyer: dealBuyers,
        contact: crmContacts,
        company: companies,
        stage: buyerPipelineStages,
      })
      .from(dealBuyers)
      .leftJoin(crmContacts, eq(dealBuyers.contactId, crmContacts.id))
      .leftJoin(companies, eq(dealBuyers.companyId, companies.id))
      .leftJoin(buyerPipelineStages, eq(dealBuyers.stageId, buyerPipelineStages.id))
      .where(eq(dealBuyers.id, updated.id));

    res.json({
      ...completeBuyer.buyer,
      contact: completeBuyer.contact,
      company: completeBuyer.company,
      stage: completeBuyer.stage,
    });
  } catch (error) {
    console.error('[CRM] Error updating deal buyer:', error);
    res.status(500).json({ error: 'Failed to update deal buyer' });
  }
});

// Remove buyer from deal
router.delete('/deals/:dealId/buyers/:buyerId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);
    const buyerId = parseInt(req.params.buyerId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify buyer exists and belongs to this deal
    const [existing] = await db
      .select()
      .from(dealBuyers)
      .innerJoin(deals, eq(deals.id, dealBuyers.dealId))
      .where(
        and(
          eq(dealBuyers.id, buyerId),
          eq(dealBuyers.dealId, dealId),
          eq(deals.organizationId, orgData.organization.id)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    await db.delete(dealBuyers).where(eq(dealBuyers.id, buyerId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error removing deal buyer:', error);
    res.status(500).json({ error: 'Failed to remove deal buyer' });
  }
});

// ==================== NOTES ROUTES ====================

// Get notes for an object
router.get('/notes/:objectType/:objectId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { objectType, objectId } = req.params;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const notes = await db
      .select({
        note: crmNotes,
        author: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(crmNotes)
      .leftJoin(users, eq(users.id, crmNotes.authorId))
      .where(
        and(
          eq(crmNotes.organizationId, orgData.organization.id),
          eq(crmNotes.objectType, objectType),
          eq(crmNotes.objectId, parseInt(objectId))
        )
      )
      .orderBy(desc(crmNotes.isPinned), desc(crmNotes.createdAt));

    res.json(notes.map((n) => ({ ...n.note, author: n.author })));
  } catch (error) {
    console.error('[CRM] Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Create note
router.post('/notes', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { mentionedUserIds, ...noteData } = req.body;

    const parsed = insertCrmNoteSchema.safeParse({
      ...noteData,
      organizationId: orgData.organization.id,
      authorId: req.user!.id,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const [newNote] = await db.insert(crmNotes).values(parsed.data).returning();

    // Log activity
    await logActivity(
      orgData.organization.id,
      'note',
      parsed.data.objectType,
      parsed.data.objectId,
      req.user!.id,
      { noteId: newNote.id }
    );

    // Process mentions if any
    if (mentionedUserIds && Array.isArray(mentionedUserIds) && mentionedUserIds.length > 0) {
      // Get author's name for the notification
      const [author] = await db
        .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(eq(users.id, req.user!.id));

      const authorName = author?.firstName
        ? `${author.firstName} ${author.lastName || ''}`.trim()
        : author?.email || 'Someone';

      // Get entity name for context
      let entityName = 'a record';
      if (parsed.data.objectType === 'deal') {
        const [deal] = await db.select({ name: deals.name }).from(deals).where(eq(deals.id, parsed.data.objectId));
        entityName = deal?.name || 'a deal';
      } else if (parsed.data.objectType === 'contact') {
        const [contact] = await db
          .select({ firstName: crmContacts.firstName, lastName: crmContacts.lastName })
          .from(crmContacts)
          .where(eq(crmContacts.id, parsed.data.objectId));
        entityName = contact?.firstName ? `${contact.firstName} ${contact.lastName || ''}`.trim() : 'a contact';
      } else if (parsed.data.objectType === 'company') {
        const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, parsed.data.objectId));
        entityName = company?.name || 'a company';
      }

      // Create mentions and notifications for each mentioned user
      for (const mentionedUserId of mentionedUserIds) {
        // Don't notify yourself
        if (mentionedUserId === req.user!.id) continue;

        // Get the mentioned user's name for the mention text
        const [mentionedUser] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, mentionedUserId));

        const mentionText = mentionedUser?.firstName
          ? `@${mentionedUser.firstName} ${mentionedUser.lastName || ''}`.trim()
          : '@User';

        // Create mention record
        await db.insert(mentions).values({
          organizationId: orgData.organization.id,
          mentionedUserId,
          mentionedByUserId: req.user!.id,
          entityType: parsed.data.objectType,
          entityId: parsed.data.objectId,
          noteId: newNote.id,
          mentionText,
        });

        // Create notification
        await db.insert(notifications).values({
          organizationId: orgData.organization.id,
          userId: mentionedUserId,
          type: 'mention',
          title: `${authorName} mentioned you`,
          message: `You were mentioned in a note on ${entityName}`,
          entityType: parsed.data.objectType,
          entityId: parsed.data.objectId,
          actorId: req.user!.id,
        });

        // TODO: Send email notification (requires email service integration)
        // For now, we'll skip the email part
      }
    }

    res.json(newNote);
  } catch (error) {
    console.error('[CRM] Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Update note
router.patch('/notes/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const noteId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(crmNotes)
      .where(
        and(eq(crmNotes.id, noteId), eq(crmNotes.organizationId, orgData.organization.id))
      );

    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { content, richContent, isPinned } = req.body;

    const [updated] = await db
      .update(crmNotes)
      .set({
        ...(content && { content }),
        ...(richContent !== undefined && { richContent }),
        ...(isPinned !== undefined && { isPinned }),
        updatedAt: new Date(),
      })
      .where(eq(crmNotes.id, noteId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete note
router.delete('/notes/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const noteId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await db
      .delete(crmNotes)
      .where(
        and(eq(crmNotes.id, noteId), eq(crmNotes.organizationId, orgData.organization.id))
      );

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ==================== ACTIVITY ROUTES ====================

// Get unified activity feed with full content (notes, files, emails embedded)
router.get('/activity-feed/:objectType/:objectId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { objectType, objectId } = req.params;
    const objId = parseInt(objectId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Fetch all activities
    const activities = await db
      .select({
        activity: crmActivities,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(crmActivities)
      .leftJoin(users, eq(users.id, crmActivities.performedBy))
      .where(
        and(
          eq(crmActivities.organizationId, orgData.organization.id),
          eq(crmActivities.objectType, objectType),
          eq(crmActivities.objectId, objId)
        )
      )
      .orderBy(desc(crmActivities.timestamp));

    // Fetch all notes for this object
    const notes = await db
      .select({
        note: crmNotes,
        author: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(crmNotes)
      .leftJoin(users, eq(users.id, crmNotes.authorId))
      .where(
        and(
          eq(crmNotes.organizationId, orgData.organization.id),
          eq(crmNotes.objectType, objectType),
          eq(crmNotes.objectId, objId)
        )
      );

    // Fetch all attachments for this object
    const attachments = await db
      .select({
        attachment: crmAttachments,
        uploader: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(crmAttachments)
      .leftJoin(users, eq(users.id, crmAttachments.uploadedBy))
      .where(
        and(
          eq(crmAttachments.organizationId, orgData.organization.id),
          eq(crmAttachments.objectType, objectType),
          eq(crmAttachments.objectId, objId)
        )
      );

    // Create lookup maps
    const notesMap = new Map(notes.map(n => [n.note.id, n]));
    const attachmentsMap = new Map(attachments.map(a => [a.attachment.id, a]));

    // Build unified feed with embedded content
    const feedItems = activities.map((a) => {
      const activity = { ...a.activity, performedByUser: a.user };
      const metadata = activity.metadata as Record<string, any> || {};

      // Enrich with actual content based on activity type
      if (activity.activityType === 'note' && metadata.noteId) {
        const noteData = notesMap.get(metadata.noteId);
        if (noteData) {
          return {
            ...activity,
            embeddedContent: {
              type: 'note',
              id: noteData.note.id,
              content: noteData.note.content,
              isPinned: noteData.note.isPinned,
              author: noteData.author,
              createdAt: noteData.note.createdAt,
            },
          };
        }
      }

      if (activity.activityType === 'file_uploaded' && metadata.attachmentId) {
        const attachmentData = attachmentsMap.get(metadata.attachmentId);
        if (attachmentData) {
          return {
            ...activity,
            embeddedContent: {
              type: 'file',
              id: attachmentData.attachment.id,
              fileName: attachmentData.attachment.fileName,
              fileSize: attachmentData.attachment.fileSize,
              mimeType: attachmentData.attachment.mimeType,
              uploader: attachmentData.uploader,
              createdAt: attachmentData.attachment.createdAt,
              downloadUrl: `/api/crm/attachments/${attachmentData.attachment.id}/download`,
            },
          };
        }
      }

      if (activity.activityType === 'task_created' && metadata.taskId) {
        return {
          ...activity,
          embeddedContent: {
            type: 'task',
            id: metadata.taskId,
            title: metadata.taskTitle,
          },
        };
      }

      if (activity.activityType === 'task_completed' && metadata.taskId) {
        return {
          ...activity,
          embeddedContent: {
            type: 'task_completed',
            id: metadata.taskId,
            title: metadata.taskTitle,
          },
        };
      }

      return activity;
    });

    // Also include notes that might not have activity records
    // (in case some were created before activity logging was added)
    const activityNoteIds = new Set(
      activities
        .filter(a => a.activity.activityType === 'note')
        .map(a => (a.activity.metadata as any)?.noteId)
        .filter(Boolean)
    );

    const orphanNotes = notes.filter(n => !activityNoteIds.has(n.note.id));
    for (const noteData of orphanNotes) {
      feedItems.push({
        id: `note-${noteData.note.id}`,
        activityType: 'note',
        objectType,
        objectId: objId,
        timestamp: noteData.note.createdAt,
        performedByUser: noteData.author,
        embeddedContent: {
          type: 'note',
          id: noteData.note.id,
          content: noteData.note.content,
          isPinned: noteData.note.isPinned,
          author: noteData.author,
          createdAt: noteData.note.createdAt,
        },
      } as any);
    }

    // Sort by timestamp descending
    feedItems.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    res.json(feedItems);
  } catch (error) {
    console.error('[CRM] Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

// Get activities for an object (legacy endpoint)
router.get('/activities/:objectType/:objectId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { objectType, objectId } = req.params;
    const { limit = '50' } = req.query;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const activities = await db
      .select({
        activity: crmActivities,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(crmActivities)
      .leftJoin(users, eq(users.id, crmActivities.performedBy))
      .where(
        and(
          eq(crmActivities.organizationId, orgData.organization.id),
          eq(crmActivities.objectType, objectType),
          eq(crmActivities.objectId, parseInt(objectId))
        )
      )
      .orderBy(desc(crmActivities.timestamp))
      .limit(parseInt(limit as string));

    res.json(activities.map((a) => ({ ...a.activity, performedByUser: a.user })));
  } catch (error) {
    console.error('[CRM] Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Log manual activity (call, meeting, etc.)
router.post('/activities', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const parsed = insertCrmActivitySchema.safeParse({
      ...req.body,
      organizationId: orgData.organization.id,
      performedBy: req.user!.id,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const [newActivity] = await db.insert(crmActivities).values(parsed.data).returning();

    // Update lastActivityDate on related object
    if (parsed.data.objectType === 'contact') {
      await db
        .update(crmContacts)
        .set({ lastActivityDate: new Date(), updatedAt: new Date() })
        .where(eq(crmContacts.id, parsed.data.objectId));
    }

    res.json(newActivity);
  } catch (error) {
    console.error('[CRM] Error creating activity:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// ==================== ATTACHMENTS ROUTES ====================

// Get attachments for an object
router.get('/attachments/:objectType/:objectId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { objectType, objectId } = req.params;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const attachments = await db
      .select()
      .from(crmAttachments)
      .where(
        and(
          eq(crmAttachments.organizationId, orgData.organization.id),
          eq(crmAttachments.objectType, objectType),
          eq(crmAttachments.objectId, parseInt(objectId))
        )
      )
      .orderBy(desc(crmAttachments.uploadedAt));

    res.json(attachments);
  } catch (error) {
    console.error('[CRM] Error fetching attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Upload attachment
router.post('/attachments', upload.single('file'), async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { objectType, objectId } = req.body;

    if (!objectType || !objectId) {
      return res.status(400).json({ error: 'objectType and objectId are required' });
    }

    // Generate unique filename
    const ext = path.extname(req.file.originalname);
    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filePath = path.join(crmUploadsDir, fileName);

    // Save file
    await fs.writeFile(filePath, req.file.buffer);

    const [newAttachment] = await db
      .insert(crmAttachments)
      .values({
        organizationId: orgData.organization.id,
        objectType,
        objectId: parseInt(objectId),
        fileName: req.file.originalname,
        filePath: fileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user!.id,
      })
      .returning();

    // Log activity
    await logActivity(
      orgData.organization.id,
      'file_uploaded',
      objectType,
      parseInt(objectId),
      req.user!.id,
      { fileName: req.file.originalname, attachmentId: newAttachment.id }
    );

    res.json(newAttachment);
  } catch (error) {
    console.error('[CRM] Error uploading attachment:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// Download attachment
router.get('/attachments/:id/download', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const attachmentId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [attachment] = await db
      .select()
      .from(crmAttachments)
      .where(
        and(
          eq(crmAttachments.id, attachmentId),
          eq(crmAttachments.organizationId, orgData.organization.id)
        )
      );

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Prevent path traversal attacks
    const filePath = sanitizeFilePath(attachment.filePath, crmUploadsDir);
    if (!filePath) {
      console.error('[CRM] Path traversal attempt detected for attachment:', attachmentId);
      return res.status(400).json({ error: 'Invalid file path' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
    res.setHeader('Content-Type', attachment.mimeType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('[CRM] Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// Delete attachment
router.delete('/attachments/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const attachmentId = parseInt(req.params.id);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [attachment] = await db
      .select()
      .from(crmAttachments)
      .where(
        and(
          eq(crmAttachments.id, attachmentId),
          eq(crmAttachments.organizationId, orgData.organization.id)
        )
      );

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Delete file with path traversal protection
    const filePath = sanitizeFilePath(attachment.filePath, crmUploadsDir);
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }

    await db.delete(crmAttachments).where(eq(crmAttachments.id, attachmentId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// ============================================
// TASK ENDPOINTS
// ============================================

// Get task counts (overdue, pending) for navigation badges
router.get('/tasks/counts', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const now = new Date();

    // Count overdue tasks assigned to current user (pending/in_progress with due date in the past)
    const overdueResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmTasks)
      .where(
        and(
          eq(crmTasks.organizationId, orgData.organization.id),
          eq(crmTasks.assignedTo, req.user!.id),
          inArray(crmTasks.status, ['pending', 'in_progress']),
          sql`${crmTasks.dueDate} < ${now}`
        )
      );

    // Count pending tasks (not completed)
    const pendingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmTasks)
      .where(
        and(
          eq(crmTasks.organizationId, orgData.organization.id),
          inArray(crmTasks.status, ['pending', 'in_progress'])
        )
      );

    res.json({
      overdueCount: overdueResult[0]?.count || 0,
      pendingCount: pendingResult[0]?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching task counts:', error);
    res.status(500).json({ error: 'Failed to fetch task counts' });
  }
});

// Get all tasks for the organization (with filters)
router.get('/tasks', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { status, priority, assignedTo, myTasks } = req.query;

    let query = db
      .select({
        task: crmTasks,
        assignee: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        creator: {
          id: sql<number>`creator.id`.as('creator_id'),
          email: sql<string>`creator.email`.as('creator_email'),
          firstName: sql<string>`creator.first_name`.as('creator_first_name'),
          lastName: sql<string>`creator.last_name`.as('creator_last_name'),
        },
      })
      .from(crmTasks)
      .leftJoin(users, eq(users.id, crmTasks.assignedTo))
      .leftJoin(
        sql`${users} as creator`,
        sql`creator.id = ${crmTasks.createdBy}`
      )
      .where(eq(crmTasks.organizationId, orgData.organization.id))
      .$dynamic();

    // Apply filters
    const conditions = [eq(crmTasks.organizationId, orgData.organization.id)];

    if (status && status !== 'all') {
      conditions.push(eq(crmTasks.status, status as string));
    }

    if (priority && priority !== 'all') {
      conditions.push(eq(crmTasks.priority, priority as string));
    }

    if (myTasks === 'true') {
      conditions.push(eq(crmTasks.assignedTo, req.user!.id));
    } else if (assignedTo) {
      conditions.push(eq(crmTasks.assignedTo, parseInt(assignedTo as string)));
    }

    const tasks = await db
      .select({
        task: crmTasks,
        assignee: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(crmTasks)
      .leftJoin(users, eq(users.id, crmTasks.assignedTo))
      .where(and(...conditions))
      .orderBy(
        asc(sql`CASE WHEN ${crmTasks.status} = 'completed' THEN 1 WHEN ${crmTasks.status} = 'cancelled' THEN 2 ELSE 0 END`),
        asc(crmTasks.dueDate),
        desc(crmTasks.createdAt)
      );

    // Get creator info separately to avoid complex join
    const taskIds = tasks.map(t => t.task.id);
    const creatorIds = [...new Set(tasks.map(t => t.task.createdBy))];

    const creators = creatorIds.length > 0 ? await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, creatorIds)) : [];

    const creatorsMap = new Map(creators.map(c => [c.id, c]));

    // Fetch associations (deals, contacts, companies) for tasks
    const dealIds = tasks.filter(t => t.task.objectType === 'deal' && t.task.objectId).map(t => t.task.objectId!);
    const contactIds = tasks.filter(t => t.task.objectType === 'contact' && t.task.objectId).map(t => t.task.objectId!);
    const companyIds = tasks.filter(t => t.task.objectType === 'company' && t.task.objectId).map(t => t.task.objectId!);

    const [dealsData, contactsData, companiesData] = await Promise.all([
      dealIds.length > 0 ? db.select({ id: deals.id, name: deals.name }).from(deals).where(inArray(deals.id, dealIds)) : [],
      contactIds.length > 0 ? db.select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName }).from(crmContacts).where(inArray(crmContacts.id, contactIds)) : [],
      companyIds.length > 0 ? db.select({ id: companies.id, name: companies.name }).from(companies).where(inArray(companies.id, companyIds)) : [],
    ]);

    const dealsMap = new Map(dealsData.map(d => [d.id, d]));
    const contactsMap = new Map(contactsData.map(c => [c.id, c]));
    const companiesMap = new Map(companiesData.map(c => [c.id, c]));

    res.json(tasks.map((t) => ({
      ...t.task,
      assignee: t.assignee?.id ? t.assignee : null,
      creator: creatorsMap.get(t.task.createdBy) || null,
      deal: t.task.objectType === 'deal' && t.task.objectId ? dealsMap.get(t.task.objectId) || null : null,
      contact: t.task.objectType === 'contact' && t.task.objectId ? contactsMap.get(t.task.objectId) || null : null,
      company: t.task.objectType === 'company' && t.task.objectId ? companiesMap.get(t.task.objectId) || null : null,
    })));
  } catch (error) {
    console.error('[CRM] Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get single task
router.get('/tasks/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const taskId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [result] = await db
      .select({
        task: crmTasks,
        assignee: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(crmTasks)
      .leftJoin(users, eq(users.id, crmTasks.assignedTo))
      .where(
        and(
          eq(crmTasks.id, taskId),
          eq(crmTasks.organizationId, orgData.organization.id)
        )
      );

    if (!result) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get creator info
    const [creator] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, result.task.createdBy));

    res.json({
      ...result.task,
      assignee: result.assignee?.id ? result.assignee : null,
      creator: creator || null,
    });
  } catch (error) {
    console.error('[CRM] Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Get tasks for a specific entity (deal, contact, company)
router.get('/tasks/:objectType/:objectId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { objectType, objectId } = req.params;
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const tasks = await db
      .select({
        task: crmTasks,
        assignee: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(crmTasks)
      .leftJoin(users, eq(users.id, crmTasks.assignedTo))
      .where(
        and(
          eq(crmTasks.organizationId, orgData.organization.id),
          eq(crmTasks.objectType, objectType),
          eq(crmTasks.objectId, parseInt(objectId))
        )
      )
      .orderBy(
        asc(sql`CASE WHEN ${crmTasks.status} = 'completed' THEN 1 WHEN ${crmTasks.status} = 'cancelled' THEN 2 ELSE 0 END`),
        asc(crmTasks.dueDate),
        desc(crmTasks.createdAt)
      );

    // Get creator info
    const creatorIds = [...new Set(tasks.map(t => t.task.createdBy))];
    const creators = creatorIds.length > 0 ? await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, creatorIds)) : [];

    const creatorsMap = new Map(creators.map(c => [c.id, c]));

    res.json(tasks.map((t) => ({
      ...t.task,
      assignee: t.assignee?.id ? t.assignee : null,
      creator: creatorsMap.get(t.task.createdBy) || null,
    })));
  } catch (error) {
    console.error('[CRM] Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/tasks', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const parsed = insertCrmTaskSchema.safeParse({
      ...req.body,
      organizationId: orgData.organization.id,
      createdBy: req.user!.id,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const [newTask] = await db.insert(crmTasks).values(parsed.data).returning();

    // Log activity if linked to an object
    if (newTask.objectType && newTask.objectId) {
      await logActivity(
        orgData.organization.id,
        'task_created',
        newTask.objectType,
        newTask.objectId,
        req.user!.id,
        { taskId: newTask.id, taskTitle: newTask.title },
        `Created task: ${newTask.title}`
      );
    }

    // Send notification if task is assigned to someone else
    if (newTask.assignedTo && newTask.assignedTo !== req.user!.id) {
      const assignerName = await getUserDisplayName(req.user!.id);
      await createNotification({
        organizationId: orgData.organization.id,
        userId: newTask.assignedTo,
        type: 'task_assigned',
        title: 'Task assigned to you',
        message: `${assignerName} assigned you a task: "${newTask.title}"`,
        entityType: newTask.objectType || 'task',
        entityId: newTask.objectId || newTask.id,
        actorId: req.user!.id,
      });
    }

    res.json(newTask);
  } catch (error) {
    console.error('[CRM] Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.patch('/tasks/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const taskId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(crmTasks)
      .where(
        and(
          eq(crmTasks.id, taskId),
          eq(crmTasks.organizationId, orgData.organization.id)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const parsed = updateCrmTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const updateData: Record<string, any> = {
      ...parsed.data,
      updatedAt: new Date(),
    };

    // Reset reminderSentAt if reminder-related fields change
    const reminderFieldsChanged =
      (parsed.data.reminder !== undefined && parsed.data.reminder !== existing.reminder) ||
      (parsed.data.dueDate !== undefined && parsed.data.dueDate?.toString() !== existing.dueDate?.toString()) ||
      (parsed.data.dueTime !== undefined && parsed.data.dueTime !== existing.dueTime);

    if (reminderFieldsChanged && parsed.data.reminder !== 'none') {
      updateData.reminderSentAt = null;
    }

    const [updated] = await db
      .update(crmTasks)
      .set(updateData)
      .where(eq(crmTasks.id, taskId))
      .returning();

    // Send notification if task assignment changed to someone new
    if (
      updated.assignedTo &&
      updated.assignedTo !== existing.assignedTo &&
      updated.assignedTo !== req.user!.id
    ) {
      const assignerName = await getUserDisplayName(req.user!.id);
      await createNotification({
        organizationId: orgData.organization.id,
        userId: updated.assignedTo,
        type: 'task_assigned',
        title: 'Task assigned to you',
        message: `${assignerName} assigned you a task: "${updated.title}"`,
        entityType: updated.objectType || 'task',
        entityId: updated.objectId || updated.id,
        actorId: req.user!.id,
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Mark task as complete
router.patch('/tasks/:id/complete', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const taskId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(crmTasks)
      .where(
        and(
          eq(crmTasks.id, taskId),
          eq(crmTasks.organizationId, orgData.organization.id)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const [updated] = await db
      .update(crmTasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy: req.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(crmTasks.id, taskId))
      .returning();

    // Log activity if linked to an object
    if (existing.objectType && existing.objectId) {
      await logActivity(
        orgData.organization.id,
        'task_completed',
        existing.objectType,
        existing.objectId,
        req.user!.id,
        { taskId: existing.id, taskTitle: existing.title },
        `Completed task: ${existing.title}`
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Uncomplete/reopen task
router.patch('/tasks/:id/uncomplete', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const taskId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [existing] = await db
      .select()
      .from(crmTasks)
      .where(
        and(
          eq(crmTasks.id, taskId),
          eq(crmTasks.organizationId, orgData.organization.id)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const [updated] = await db
      .update(crmTasks)
      .set({
        status: 'pending',
        completedAt: null,
        completedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(crmTasks.id, taskId))
      .returning();

    // Log activity if linked to an object
    if (existing.objectType && existing.objectId) {
      await logActivity(
        orgData.organization.id,
        'task_reopened',
        existing.objectType,
        existing.objectId,
        req.user!.id,
        { taskId: existing.id, taskTitle: existing.title },
        `Reopened task: ${existing.title}`
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error uncompleting task:', error);
    res.status(500).json({ error: 'Failed to uncomplete task' });
  }
});

// Delete task
router.delete('/tasks/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const taskId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await db
      .delete(crmTasks)
      .where(
        and(
          eq(crmTasks.id, taskId),
          eq(crmTasks.organizationId, orgData.organization.id)
        )
      );

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ============================================
// EMAIL INTEGRATION ENDPOINTS
// ============================================

// Helper: Get user's active email connection (Gmail or Microsoft)
async function getUserEmailConnection(userId: number) {
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.userId, userId),
        inArray(integrationConnections.provider, ['gmail', 'microsoft']),
        eq(integrationConnections.status, 'active')
      )
    )
    .limit(1);

  return connection;
}

// Check if user has email connection
router.get('/email-connection', async (req, res) => {
  try {
    const connection = await getUserEmailConnection(req.user!.id);

    if (!connection) {
      return res.json({
        connected: false,
        message: 'No email account connected. Connect Gmail or Outlook in Settings > Email Sync.'
      });
    }

    res.json({
      connected: true,
      provider: connection.provider,
      accountName: connection.providerAccountName || connection.providerAccountId,
      status: connection.status,
    });
  } catch (error) {
    console.error('[CRM] Error checking email connection:', error);
    res.status(500).json({ error: 'Failed to check email connection' });
  }
});

// Get emails for a contact
router.get('/contacts/:id/emails', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);

    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get the contact
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.id, contactId),
          eq(crmContacts.organizationId, orgData.organization.id)
        )
      );

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (!contact.email) {
      return res.json({
        emails: [],
        message: 'Contact has no email address'
      });
    }

    // Get user's email connection
    const connection = await getUserEmailConnection(req.user!.id);

    if (!connection) {
      return res.json({
        emails: [],
        connected: false,
        message: 'No email account connected'
      });
    }

    // Transform connection for provider (field name mapping)
    const connectionForProvider = {
      ...connection,
      accessToken: connection.accessTokenEncrypted,
      refreshToken: connection.refreshTokenEncrypted,
    };

    // Fetch emails based on provider
    let emails: any[] = [];
    const contactEmail = contact.email.toLowerCase();

    try {
      if (connection.provider === 'gmail') {
        // Gmail: Search for emails to/from this contact
        emails = await gmailProvider.getRecentEmails(connectionForProvider as any, {
          maxResults: 50,
          query: contactEmail, // Gmail search query
        });
      } else if (connection.provider === 'microsoft') {
        // Microsoft: Use OData filter
        const filter = `from/emailAddress/address eq '${contactEmail}' or toRecipients/any(r: r/emailAddress/address eq '${contactEmail}')`;
        emails = await microsoftProvider.getRecentEmails(connectionForProvider as any, {
          maxResults: 50,
          filter: filter,
        });
      }

      // Filter emails to only those involving this contact
      emails = emails.filter(email => {
        const fromMatch = email.from?.toLowerCase() === contactEmail;
        const toMatch = email.to?.toLowerCase().includes(contactEmail);
        return fromMatch || toMatch;
      });

      // Update last used timestamp
      await db
        .update(integrationConnections)
        .set({ lastUsedAt: new Date() })
        .where(eq(integrationConnections.id, connection.id));

    } catch (emailError: any) {
      console.error('[CRM] Error fetching emails:', emailError);

      // Check if it's a token expiry issue
      if (emailError.message?.includes('token') || emailError.message?.includes('unauthorized')) {
        await db
          .update(integrationConnections)
          .set({
            status: 'expired',
            lastError: emailError.message
          })
          .where(eq(integrationConnections.id, connection.id));

        return res.json({
          emails: [],
          connected: true,
          expired: true,
          message: 'Email connection expired. Please reconnect in Settings > Email Sync.'
        });
      }

      throw emailError;
    }

    res.json({
      emails,
      connected: true,
      provider: connection.provider,
      contactEmail: contact.email,
    });
  } catch (error) {
    console.error('[CRM] Error fetching contact emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// Send email to a contact
router.post('/contacts/:id/emails', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { subject, body, isHtml } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get the contact
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.id, contactId),
          eq(crmContacts.organizationId, orgData.organization.id)
        )
      );

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (!contact.email) {
      return res.status(400).json({ error: 'Contact has no email address' });
    }

    // Get user's email connection
    const connection = await getUserEmailConnection(req.user!.id);

    if (!connection) {
      return res.status(400).json({
        error: 'No email account connected. Connect Gmail or Outlook in Settings > Email Sync.'
      });
    }

    // Transform connection for provider
    const connectionForProvider = {
      ...connection,
      accessToken: connection.accessTokenEncrypted,
      refreshToken: connection.refreshTokenEncrypted,
    };

    // Send email based on provider
    let result: { success: boolean; messageId?: string; error?: string };

    if (connection.provider === 'gmail') {
      result = await gmailProvider.sendEmail(connectionForProvider as any, {
        to: contact.email,
        subject,
        body,
        isHtml: isHtml ?? false,
      });
    } else if (connection.provider === 'microsoft') {
      result = await microsoftProvider.sendEmail(connectionForProvider as any, {
        to: contact.email,
        subject,
        body,
        isHtml: isHtml ?? false,
      });
    } else {
      return res.status(400).json({ error: 'Unsupported email provider' });
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send email' });
    }

    // Log activity
    await db.insert(crmActivities).values({
      organizationId: orgData.organization.id,
      contactId: contactId,
      type: 'email',
      subject: `Sent: ${subject}`,
      description: `Email sent to ${contact.email}`,
      createdById: req.user!.id,
    });

    // Update last used timestamp
    await db
      .update(integrationConnections)
      .set({ lastUsedAt: new Date() })
      .where(eq(integrationConnections.id, connection.id));

    res.json({
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('[CRM] Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Get emails for a deal (all associated contacts)
router.get('/deals/:id/emails', async (req, res) => {
  try {
    const dealId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);

    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get the deal
    const [deal] = await db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.id, dealId),
          eq(deals.organizationId, orgData.organization.id)
        )
      );

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get all contacts associated with this deal
    const dealContactsResult = await db
      .select({ contact: crmContacts })
      .from(dealContacts)
      .innerJoin(crmContacts, eq(crmContacts.id, dealContacts.contactId))
      .where(eq(dealContacts.dealId, dealId));

    const contacts = dealContactsResult.map(dc => dc.contact);
    const contactEmails = contacts
      .filter(c => c.email)
      .map(c => c.email!.toLowerCase());

    if (contactEmails.length === 0) {
      return res.json({
        emails: [],
        message: 'No contacts with email addresses associated with this deal'
      });
    }

    // Get user's email connection
    const connection = await getUserEmailConnection(req.user!.id);

    if (!connection) {
      return res.json({
        emails: [],
        connected: false,
        message: 'No email account connected'
      });
    }

    // Transform connection for provider
    const connectionForProvider = {
      ...connection,
      accessToken: connection.accessTokenEncrypted,
      refreshToken: connection.refreshTokenEncrypted,
    };

    // Fetch emails for all contact emails
    let allEmails: any[] = [];

    try {
      for (const contactEmail of contactEmails) {
        let emails: any[] = [];

        if (connection.provider === 'gmail') {
          emails = await gmailProvider.getRecentEmails(connectionForProvider as any, {
            maxResults: 25,
            query: contactEmail,
          });
        } else if (connection.provider === 'microsoft') {
          const filter = `from/emailAddress/address eq '${contactEmail}' or toRecipients/any(r: r/emailAddress/address eq '${contactEmail}')`;
          emails = await microsoftProvider.getRecentEmails(connectionForProvider as any, {
            maxResults: 25,
            filter: filter,
          });
        }

        // Filter and tag emails with contact info
        emails = emails
          .filter(email => {
            const fromMatch = email.from?.toLowerCase() === contactEmail;
            const toMatch = email.to?.toLowerCase().includes(contactEmail);
            return fromMatch || toMatch;
          })
          .map(email => ({
            ...email,
            contactEmail,
            contactName: contacts.find(c => c.email?.toLowerCase() === contactEmail)?.name,
          }));

        allEmails = [...allEmails, ...emails];
      }

      // Sort all emails by date, newest first
      allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Deduplicate by message ID
      const seen = new Set();
      allEmails = allEmails.filter(email => {
        if (seen.has(email.id)) return false;
        seen.add(email.id);
        return true;
      });

      // Update last used timestamp
      await db
        .update(integrationConnections)
        .set({ lastUsedAt: new Date() })
        .where(eq(integrationConnections.id, connection.id));

    } catch (emailError: any) {
      console.error('[CRM] Error fetching deal emails:', emailError);

      if (emailError.message?.includes('token') || emailError.message?.includes('unauthorized')) {
        return res.json({
          emails: [],
          connected: true,
          expired: true,
          message: 'Email connection expired. Please reconnect in Settings > Email Sync.'
        });
      }

      throw emailError;
    }

    res.json({
      emails: allEmails.slice(0, 100), // Limit to 100 most recent
      connected: true,
      provider: connection.provider,
      contactCount: contactEmails.length,
    });
  } catch (error) {
    console.error('[CRM] Error fetching deal emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// ============================================
// EMAIL INBOX ENDPOINTS
// ============================================

import {
  getEmailConnection,
  getEmailsForContact,
  getEmailById,
  sendEmail as sendEmailService,
  sendReply,
  getConnectedEmailAddress,
} from '../services/email-sync';

/**
 * Get emails for a contact by contact ID
 */
router.get('/emails/contact/:contactId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const contactId = parseInt(req.params.contactId);
    const { maxResults = '30' } = req.query;

    // Get user's organization
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get contact email address
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.id, contactId),
          eq(crmContacts.organizationId, orgData.organization.id)
        )
      )
      .limit(1);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (!contact.email) {
      return res.json({ emails: [], connected: false, message: 'Contact has no email address' });
    }

    // Check if user has email connected
    const emailConn = await getEmailConnection(req.user!.id);
    if (!emailConn) {
      return res.json({
        emails: [],
        connected: false,
        message: 'No email account connected. Connect Gmail or Outlook in Settings > Integrations.',
      });
    }

    // Fetch emails for this contact
    const emails = await getEmailsForContact(req.user!.id, contact.email, {
      maxResults: parseInt(maxResults as string),
    });

    res.json({
      emails,
      connected: true,
      provider: emailConn.provider,
      contactEmail: contact.email,
    });
  } catch (error) {
    console.error('[CRM] Error fetching contact emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

/**
 * Get full email content by ID
 */
router.get('/emails/:emailId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { emailId } = req.params;
    const { provider } = req.query;

    if (!provider || (provider !== 'gmail' && provider !== 'microsoft')) {
      return res.status(400).json({ error: 'Provider must be specified (gmail or microsoft)' });
    }

    const email = await getEmailById(req.user!.id, emailId, provider as 'gmail' | 'microsoft');

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(email);
  } catch (error) {
    console.error('[CRM] Error fetching email:', error);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

/**
 * Send a new email
 */
router.post('/emails/send', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { to, subject, body, isHtml, contactId, dealId } = req.body;
    console.log('[CRM] /emails/send - request body:', { to, subject, bodyLength: body?.length, isHtml, contactId, dealId });

    if (!to || !subject || !body) {
      console.log('[CRM] /emails/send - missing fields:', { to: !!to, subject: !!subject, body: !!body });
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    console.log('[CRM] /emails/send - calling sendEmailService for user:', req.user!.id);
    const result = await sendEmailService(req.user!.id, {
      to,
      subject,
      body,
      isHtml: isHtml || false,
    });
    console.log('[CRM] /emails/send - result:', result);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to send email' });
    }

    // Log activity if contactId or dealId provided
    if (contactId || dealId) {
      // Get organization ID
      const orgData = await getUserOrganization(req.user!.id);
      if (orgData) {
        const activityData = {
          organizationId: orgData.organization.id,
          objectType: dealId ? 'deal' : 'contact',
          objectId: dealId || contactId,
          activityType: 'email',
          title: `Sent email: ${subject}`,
          description: `Email sent to ${to}`,
          metadata: { to, subject, direction: 'sent' },
          performedBy: req.user!.id,
        };

        await db.insert(crmActivities).values(activityData);
      }
    }

    res.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error('[CRM] Error sending email:', error);
    console.error('[CRM] Error stack:', error?.stack);
    res.status(500).json({ error: error?.message || 'Failed to send email' });
  }
});

/**
 * Reply to an email
 */
router.post('/emails/reply', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { emailId, provider, body, isHtml, contactId, dealId } = req.body;

    if (!emailId || !provider || !body) {
      return res.status(400).json({ error: 'emailId, provider, and body are required' });
    }

    // Fetch the original email
    const originalEmail = await getEmailById(req.user!.id, emailId, provider);
    if (!originalEmail) {
      return res.status(404).json({ error: 'Original email not found' });
    }

    // Send the reply
    const result = await sendReply(req.user!.id, originalEmail, body, isHtml || false);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to send reply' });
    }

    // Log activity if contactId or dealId provided
    if (contactId || dealId) {
      const orgData = await getUserOrganization(req.user!.id);
      if (orgData) {
        const activityData = {
          organizationId: orgData.organization.id,
          objectType: dealId ? 'deal' : 'contact',
          objectId: dealId || contactId,
          activityType: 'email',
          title: `Replied to: ${originalEmail.subject}`,
          description: `Reply sent to ${originalEmail.from}`,
          metadata: { to: originalEmail.from, subject: originalEmail.subject, direction: 'sent', replyTo: emailId },
          performedBy: req.user!.id,
        };

        await db.insert(crmActivities).values(activityData);
      }
    }

    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('[CRM] Error sending reply:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

/**
 * Get connected email info (for compose dialogs)
 */
router.get('/emails/connection/info', async (req, res) => {
  console.log('[CRM] /emails/connection/info called, user:', req.user?.id);
  if (!req.isAuthenticated()) {
    console.log('[CRM] /emails/connection/info - not authenticated');
    return res.sendStatus(401);
  }

  try {
    const emailConn = await getEmailConnection(req.user!.id);
    console.log('[CRM] /emails/connection/info - emailConn:', emailConn ? {
      provider: emailConn.provider,
      providerAccountId: emailConn.connection.providerAccountId,
      providerAccountName: emailConn.connection.providerAccountName
    } : null);

    if (!emailConn) {
      return res.json({
        connected: false,
        message: 'No email account connected',
      });
    }

    res.json({
      connected: true,
      provider: emailConn.provider,
      email: emailConn.connection.providerAccountId,
      accountName: emailConn.connection.providerAccountName,
    });
  } catch (error) {
    console.error('[CRM] Error getting email connection info:', error);
    res.status(500).json({ error: 'Failed to get email connection info' });
  }
});

// ============================================
// EMAIL TEMPLATES
// ============================================

// Get all email templates for organization
router.get('/email-templates', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const templates = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.organizationId, orgData.organization.id))
      .orderBy(desc(emailTemplates.updatedAt));

    res.json(templates);
  } catch (error) {
    console.error('[CRM] Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Create email template
router.post('/email-templates', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { name, subject, body, category } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ error: 'name, subject, and body are required' });
    }

    const [template] = await db
      .insert(emailTemplates)
      .values({
        organizationId: orgData.organization.id,
        name,
        subject,
        body,
        category: category || null,
        createdBy: req.user!.id,
      })
      .returning();

    res.json(template);
  } catch (error) {
    console.error('[CRM] Error creating email template:', error);
    res.status(500).json({ error: 'Failed to create email template' });
  }
});

// Update email template
router.patch('/email-templates/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const templateId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { name, subject, body, category } = req.body;

    const [updated] = await db
      .update(emailTemplates)
      .set({
        ...(name && { name }),
        ...(subject && { subject }),
        ...(body && { body }),
        ...(category !== undefined && { category: category || null }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailTemplates.id, templateId),
          eq(emailTemplates.organizationId, orgData.organization.id)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating email template:', error);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

// Delete email template
router.delete('/email-templates/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const templateId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [deleted] = await db
      .delete(emailTemplates)
      .where(
        and(
          eq(emailTemplates.id, templateId),
          eq(emailTemplates.organizationId, orgData.organization.id)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting email template:', error);
    res.status(500).json({ error: 'Failed to delete email template' });
  }
});

// Track template usage
router.post('/email-templates/:id/use', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const templateId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await db
      .update(emailTemplates)
      .set({
        usageCount: sql`${emailTemplates.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(
        and(
          eq(emailTemplates.id, templateId),
          eq(emailTemplates.organizationId, orgData.organization.id)
        )
      );

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error tracking template usage:', error);
    res.status(500).json({ error: 'Failed to track template usage' });
  }
});

// ============================================
// GLOBAL SEARCH ENDPOINT
// ============================================

// Search across deals, contacts, and companies
router.get('/search', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ results: [] });
    }

    const searchTerm = `%${q}%`;
    const limit = 10;

    // Search deals
    const dealResults = await db
      .select({
        id: deals.id,
        name: deals.name,
        companyName: companies.name,
      })
      .from(deals)
      .leftJoin(companies, eq(companies.id, deals.companyId))
      .where(
        and(
          eq(deals.organizationId, orgData.organization.id),
          isNull(deals.deletedAt),
          ilike(deals.name, searchTerm)
        )
      )
      .limit(limit);

    // Search contacts
    const contactResults = await db
      .select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
        companyName: companies.name,
      })
      .from(crmContacts)
      .leftJoin(companies, eq(companies.id, crmContacts.companyId))
      .where(
        and(
          eq(crmContacts.organizationId, orgData.organization.id),
          or(
            ilike(crmContacts.firstName, searchTerm),
            ilike(crmContacts.lastName, searchTerm),
            ilike(crmContacts.email, searchTerm)
          )
        )
      )
      .limit(limit);

    // Search companies
    const companyResults = await db
      .select({
        id: companies.id,
        name: companies.name,
        website: companies.website,
      })
      .from(companies)
      .where(
        and(
          eq(companies.organizationId, orgData.organization.id),
          or(
            ilike(companies.name, searchTerm),
            ilike(companies.website, searchTerm)
          )
        )
      )
      .limit(limit);

    // Format results
    const results = [
      ...dealResults.map(d => ({
        type: 'deal' as const,
        id: d.id,
        title: d.name,
        subtitle: d.companyName || undefined,
      })),
      ...contactResults.map(c => ({
        type: 'contact' as const,
        id: c.id,
        title: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email,
        subtitle: c.companyName || c.email,
      })),
      ...companyResults.map(c => ({
        type: 'company' as const,
        id: c.id,
        title: c.name,
        subtitle: c.website || undefined,
      })),
    ].slice(0, 15); // Limit total results

    res.json({ results });
  } catch (error) {
    console.error('Error in global search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ==================== NOTIFICATIONS ====================

// Get user's notifications
router.get('/notifications', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { unreadOnly } = req.query;
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const conditions = [
      eq(notifications.organizationId, orgData.organization.id),
      eq(notifications.userId, req.user!.id),
    ];

    if (unreadOnly === 'true') {
      conditions.push(eq(notifications.isRead, false));
    }

    const userNotifications = await db
      .select({
        notification: notifications,
        actor: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    // Get unread count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.organizationId, orgData.organization.id),
          eq(notifications.userId, req.user!.id),
          eq(notifications.isRead, false)
        )
      );

    res.json({
      notifications: userNotifications.map(n => ({
        ...n.notification,
        actor: n.actor,
      })),
      unreadCount: Number(count),
    });
  } catch (error) {
    console.error('[CRM] Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const notificationId = parseInt(req.params.id);

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, req.user!.id)
        )
      )
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
router.post('/notifications/mark-all-read', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.organizationId, orgData.organization.id),
          eq(notifications.userId, req.user!.id),
          eq(notifications.isRead, false)
        )
      );

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

export default router;
