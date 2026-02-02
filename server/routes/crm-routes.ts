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
  esignEnvelopes,
  crmImports,
  userNotificationPreferences,
  teams,
  teamMembers,
  dealCollaborators,
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
  insertTeamSchema,
  insertTeamMemberSchema,
  insertDealCollaboratorSchema,
  ORGANIZATION_ROLES,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_OBJECT_TYPES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_REMINDER_OPTIONS,
  CRM_IMPORT_ENTITY_TYPES,
  type OrganizationRole,
  type CrmVisibility,
  type CrmVisibilitySettings,
} from '@shared/schema';
import XLSX from 'xlsx';
import { eq, and, or, desc, asc, sql, isNull, inArray, ilike, ne } from 'drizzle-orm';
import * as crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { gmailProvider } from '../integrations/providers/gmail';
import { microsoftProvider } from '../integrations/providers/microsoft';
import {
  getUserPermissions,
  getPermissionsMatrix,
  updatePermission,
  canManagePermissions,
} from '../middleware/permissions';
import { PERMISSION_KEYS, CATEGORY_INFO, ALL_ROLES, DEFAULT_PERMISSIONS } from '@shared/permissions';
import { sendTeamInviteEmail, sendMentionNotificationEmail } from '../email';
import { queueLogoFetch, shouldFetchLogo } from '../services/company-logo-service';
import { sanitizeFilename, sanitizeExtension } from '../utils/sanitize-filename';

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

      // Collect unique companies for batch insert
      const uniqueCompanyNames = [...new Set(
        existingInvestorContacts
          .filter(contact => contact.company)
          .map(contact => contact.company!)
      )];

      if (uniqueCompanyNames.length > 0) {
        const companyValues = uniqueCompanyNames.map(companyName => ({
          organizationId: newOrg.id,
          name: companyName,
        }));
        const insertedCompanies = await db
          .insert(companies)
          .values(companyValues)
          .returning();

        // Build the map from company name to ID
        for (const company of insertedCompanies) {
          companiesMap.set(company.name, company.id);
        }
      }

      // Collect all contact values for batch insert
      const contactValues = existingInvestorContacts.map(contact => {
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

        return {
          organizationId: newOrg.id,
          email: contact.email,
          firstName,
          lastName,
          companyId: contact.company ? companiesMap.get(contact.company) : null,
          notes: contact.notes,
          tags: contact.tags,
          contactType: 'buyer' as const, // Set contact type to buyer for migrated investor contacts
          leadStatus: contact.status === 'new' ? 'new' as const :
                      contact.status === 'contacted' ? 'contacted' as const :
                      contact.status === 'interested' ? 'qualified' as const : 'new' as const,
          source: 'investor_database_migration',
          lastActivityDate: contact.lastSeenAt || contact.lastContactDate,
          customProperties,
          createdAt: contact.createdAt,
        };
      });

      // Batch insert all contacts
      if (contactValues.length > 0) {
        await db.insert(crmContacts).values(contactValues);
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

// ==================== VISIBILITY HELPER FUNCTIONS ====================

// Get user's team IDs
async function getUserTeamIds(memberId: number): Promise<number[]> {
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.organizationMemberId, memberId));
  return memberships.map(m => m.teamId);
}

// Get all member IDs in user's teams (for team visibility)
async function getTeammateIds(memberId: number): Promise<number[]> {
  const teamIds = await getUserTeamIds(memberId);
  if (teamIds.length === 0) return [memberId]; // Just self if no teams

  const teammates = await db
    .selectDistinct({ memberId: teamMembers.organizationMemberId })
    .from(teamMembers)
    .where(inArray(teamMembers.teamId, teamIds));
  return teammates.map(t => t.memberId);
}

// Get visibility settings from organization
async function getCrmVisibilitySettings(orgId: number): Promise<CrmVisibilitySettings> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  const settings = (org?.settings as any) || {};
  return {
    deals: settings.crmVisibility?.deals || 'organization',
    contacts: settings.crmVisibility?.contacts || 'organization',
    companies: settings.crmVisibility?.companies || 'organization',
  };
}

// Build visibility filter condition for CRM entities
async function buildVisibilityFilter(
  visibility: CrmVisibility,
  memberId: number,
  memberRole: string,
  entityOwnerId: any, // The ownerId column reference
  entityId?: any, // The deal id column for collaborator check
  checkCollaborators: boolean = false
): Promise<any | undefined> {
  // Owner/admin bypass - see all records
  if (memberRole === 'owner' || memberRole === 'admin') {
    return undefined; // No additional filter
  }

  // Organization visibility - everyone sees all
  if (visibility === 'organization') {
    return undefined;
  }

  // Owner only - user sees only their records + collaborator access
  if (visibility === 'owner_only') {
    if (checkCollaborators && entityId) {
      // Include deals where user is owner OR collaborator
      const isCollaborator = sql`EXISTS (
        SELECT 1 FROM deal_collaborators dc
        WHERE dc.deal_id = ${entityId}
        AND dc.organization_member_id = ${memberId}
      )`;
      return or(eq(entityOwnerId, memberId), isCollaborator);
    }
    return eq(entityOwnerId, memberId);
  }

  // Team visibility - user sees records from teammates + collaborator access
  if (visibility === 'team') {
    const teammateIds = await getTeammateIds(memberId);
    if (checkCollaborators && entityId) {
      const isCollaborator = sql`EXISTS (
        SELECT 1 FROM deal_collaborators dc
        WHERE dc.deal_id = ${entityId}
        AND dc.organization_member_id = ${memberId}
      )`;
      return or(inArray(entityOwnerId, teammateIds), isCollaborator);
    }
    return inArray(entityOwnerId, teammateIds);
  }

  return undefined;
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

    // Get total member count
    const memberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgData.organization.id),
          eq(organizationMembers.status, 'active')
        )
      );

    // Get paid member count (non-viewer roles)
    const paidMemberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgData.organization.id),
          eq(organizationMembers.status, 'active'),
          ne(organizationMembers.role, 'viewer')
        )
      );

    // Get viewer count
    const viewerCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgData.organization.id),
          eq(organizationMembers.status, 'active'),
          eq(organizationMembers.role, 'viewer')
        )
      );

    res.json({
      ...orgData.organization,
      membership: orgData.membership,
      memberCount: Number(memberCount[0]?.count || 0),
      // License information
      licenses: {
        totalSeats: orgData.organization.seatCount || 1,
        usedSeats: Number(paidMemberCount[0]?.count || 0),
        availableSeats: Math.max(0, (orgData.organization.seatCount || 1) - Number(paidMemberCount[0]?.count || 0)),
        viewerCount: Number(viewerCount[0]?.count || 0),
      },
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

// Get CRM visibility settings
router.get('/organization/visibility-settings', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const settings = await getCrmVisibilitySettings(orgData.organization.id);
    res.json(settings);
  } catch (error) {
    console.error('[CRM] Error fetching visibility settings:', error);
    res.status(500).json({ error: 'Failed to fetch visibility settings' });
  }
});

// Update CRM visibility settings (owner/admin only)
router.patch('/organization/visibility-settings', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Only owners and admins can change visibility settings
    if (!['owner', 'admin'].includes(orgData.membership.role)) {
      return res.status(403).json({ error: 'Only owners and admins can change visibility settings' });
    }

    const { deals: dealsVisibility, contacts: contactsVisibility, companies: companiesVisibility } = req.body;

    // Validate visibility values
    const validOptions = ['owner_only', 'team', 'organization'];
    if (dealsVisibility && !validOptions.includes(dealsVisibility)) {
      return res.status(400).json({ error: 'Invalid deals visibility option' });
    }
    if (contactsVisibility && !validOptions.includes(contactsVisibility)) {
      return res.status(400).json({ error: 'Invalid contacts visibility option' });
    }
    if (companiesVisibility && !validOptions.includes(companiesVisibility)) {
      return res.status(400).json({ error: 'Invalid companies visibility option' });
    }

    // Get current settings and merge
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgData.organization.id));
    const currentSettings = (org?.settings as any) || {};
    const currentVisibility = currentSettings.crmVisibility || {};

    const updatedSettings = {
      ...currentSettings,
      crmVisibility: {
        deals: dealsVisibility || currentVisibility.deals || 'organization',
        contacts: contactsVisibility || currentVisibility.contacts || 'organization',
        companies: companiesVisibility || currentVisibility.companies || 'organization',
      },
    };

    const [updated] = await db
      .update(organizations)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgData.organization.id))
      .returning();

    res.json({
      deals: updatedSettings.crmVisibility.deals,
      contacts: updatedSettings.crmVisibility.contacts,
      companies: updatedSettings.crmVisibility.companies,
    });
  } catch (error) {
    console.error('[CRM] Error updating visibility settings:', error);
    res.status(500).json({ error: 'Failed to update visibility settings' });
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

    // Get active members (with user accounts)
    const activeMembers = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        status: organizationMembers.status,
        joinedAt: organizationMembers.joinedAt,
        invitedAt: organizationMembers.invitedAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePhoto: users.profilePhoto,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(
        and(
          eq(organizationMembers.organizationId, orgData.organization.id),
          ne(organizationMembers.status, 'pending'),
          ne(organizationMembers.status, 'deactivated')
        )
      )
      .orderBy(asc(organizationMembers.createdAt));

    // Get pending invitations (users who haven't created accounts yet)
    const pendingInvitations = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        status: organizationMembers.status,
        joinedAt: organizationMembers.joinedAt,
        invitedAt: organizationMembers.invitedAt,
        inviteeEmail: organizationMembers.inviteeEmail,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgData.organization.id),
          eq(organizationMembers.status, 'pending'),
          isNull(organizationMembers.userId)
        )
      )
      .orderBy(asc(organizationMembers.createdAt));

    // Format pending invitations to match active member structure
    const formattedPending = pendingInvitations.map(inv => ({
      id: inv.id,
      userId: null,
      role: inv.role,
      status: inv.status,
      joinedAt: inv.joinedAt,
      invitedAt: inv.invitedAt,
      email: inv.inviteeEmail,
      firstName: null,
      lastName: null,
      profilePhoto: null,
      isPending: true,
    }));

    res.json([...activeMembers, ...formattedPending]);
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
    const assignedRole = role || 'member';
    const normalizedEmail = email.toLowerCase().trim();

    // Check license availability for paid roles (owner, admin, member)
    // Viewer role is free and unlimited
    if (assignedRole !== 'viewer') {
      // Count current paid members (non-viewer roles) - both active and pending
      const paidMembers = await db
        .select({ count: sql<number>`count(*)` })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, orgData.organization.id),
            or(
              eq(organizationMembers.status, 'active'),
              eq(organizationMembers.status, 'pending')
            ),
            ne(organizationMembers.role, 'viewer')
          )
        );

      const currentPaidCount = Number(paidMembers[0]?.count || 0);
      const availableSeats = orgData.organization.seatCount || 1;

      if (currentPaidCount >= availableSeats) {
        return res.status(403).json({
          error: 'No available licenses',
          message: `You have ${availableSeats} Pro license(s) and all are in use. Purchase additional licenses in Settings > Billing to invite more team members, or invite them as a free Viewer (read-only access).`,
          currentUsed: currentPaidCount,
          totalSeats: availableSeats,
        });
      }
    }

    // Check if user exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail));

    // Get inviter's info for the email
    const [inviter] = await db.select().from(users).where(eq(users.id, req.user!.id));
    const inviterName = inviter?.firstName
      ? `${inviter.firstName} ${inviter.lastName || ''}`.trim()
      : inviter?.email || 'A team member';

    if (existingUser) {
      // User exists - check if already a member
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

      // Add as active member (user already has account)
      const [newMember] = await db
        .insert(organizationMembers)
        .values({
          organizationId: orgData.organization.id,
          userId: existingUser.id,
          role: assignedRole,
          status: 'active',
          invitedBy: req.user!.id,
          invitedAt: new Date(),
          joinedAt: new Date(),
        })
        .returning();

      // Send invitation email notification
      try {
        await sendTeamInviteEmail({
          inviteeEmail: existingUser.email,
          inviteeName: existingUser.firstName || '',
          inviterName,
          organizationName: orgData.organization.name,
          role: assignedRole,
        });
        console.log(`[CRM] Team invite email sent to ${existingUser.email}`);
      } catch (emailError) {
        console.error('[CRM] Failed to send team invite email:', emailError);
      }

      res.json({
        ...newMember,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        isPending: false,
      });
    } else {
      // User doesn't exist - create pending invitation
      // Check if there's already a pending invitation for this email
      const [existingPendingInvite] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, orgData.organization.id),
            eq(organizationMembers.inviteeEmail, normalizedEmail),
            eq(organizationMembers.status, 'pending')
          )
        );

      if (existingPendingInvite) {
        return res.status(400).json({ error: 'An invitation has already been sent to this email address' });
      }

      // Generate a secure invite token
      const inviteToken = crypto.randomBytes(32).toString('hex');

      // Create pending invitation (no userId yet)
      const [newMember] = await db
        .insert(organizationMembers)
        .values({
          organizationId: orgData.organization.id,
          userId: null, // No user yet
          inviteeEmail: normalizedEmail,
          inviteToken,
          role: assignedRole,
          status: 'pending',
          invitedBy: req.user!.id,
          invitedAt: new Date(),
        })
        .returning();

      // Send invitation email with signup link
      try {
        await sendTeamInviteEmail({
          inviteeEmail: normalizedEmail,
          inviteeName: '',
          inviterName,
          organizationName: orgData.organization.name,
          role: assignedRole,
          inviteToken, // Include token for signup URL
        });
        console.log(`[CRM] Team invite email (pending) sent to ${normalizedEmail}`);
      } catch (emailError) {
        console.error('[CRM] Failed to send team invite email:', emailError);
      }

      res.json({
        ...newMember,
        email: normalizedEmail,
        isPending: true,
        message: 'Invitation sent. The user will be added to your team when they create their account.',
      });
    }
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

    // Batch load all stages for all pipelines in ONE query (fixes N+1)
    const pipelineIds = pipelineList.map(p => p.id);
    let allStages: any[] = [];
    if (pipelineIds.length > 0) {
      allStages = await db
        .select()
        .from(pipelineStages)
        .where(inArray(pipelineStages.pipelineId, pipelineIds))
        .orderBy(asc(pipelineStages.displayOrder));
    }

    // Group stages by pipelineId in memory
    const stagesByPipeline = new Map<number, typeof allStages>();
    for (const stage of allStages) {
      if (!stagesByPipeline.has(stage.pipelineId)) {
        stagesByPipeline.set(stage.pipelineId, []);
      }
      stagesByPipeline.get(stage.pipelineId)!.push(stage);
    }

    // Combine pipelines with their stages
    const pipelinesWithStages = pipelineList.map(pipeline => ({
      ...pipeline,
      stages: stagesByPipeline.get(pipeline.id) || [],
    }));

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

// ==================== TEAM ROUTES ====================

// Get all teams in organization
router.get('/teams', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get teams with member counts
    const teamList = await db
      .select({
        team: teams,
        memberCount: sql<number>`count(${teamMembers.id})::int`,
      })
      .from(teams)
      .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
      .where(eq(teams.organizationId, orgData.organization.id))
      .groupBy(teams.id)
      .orderBy(asc(teams.name));

    // Get member previews for each team (first 5 members with profile photos)
    const teamIds = teamList.map(t => t.team.id);
    const memberPreviews = teamIds.length > 0 ? await db
      .select({
        teamId: teamMembers.teamId,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePhoto: users.profilePhoto,
      })
      .from(teamMembers)
      .innerJoin(organizationMembers, eq(organizationMembers.id, teamMembers.organizationMemberId))
      .leftJoin(users, eq(users.id, organizationMembers.userId))
      .where(inArray(teamMembers.teamId, teamIds))
      .orderBy(asc(teamMembers.createdAt)) : [];

    // Group previews by team ID and limit to 5 per team
    const previewsByTeam = new Map<number, Array<{ firstName: string | null; lastName: string | null; profilePhoto: string | null }>>();
    for (const preview of memberPreviews) {
      const existing = previewsByTeam.get(preview.teamId) || [];
      if (existing.length < 5) {
        existing.push({
          firstName: preview.firstName,
          lastName: preview.lastName,
          profilePhoto: preview.profilePhoto,
        });
        previewsByTeam.set(preview.teamId, existing);
      }
    }

    res.json(teamList.map(t => ({
      ...t.team,
      memberCount: t.memberCount || 0,
      memberPreviews: previewsByTeam.get(t.team.id) || [],
    })));
  } catch (error) {
    console.error('[CRM] Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create a new team (owner/admin only)
router.post('/teams', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Only owners and admins can create teams
    if (!['owner', 'admin'].includes(orgData.membership.role)) {
      return res.status(403).json({ error: 'Only owners and admins can create teams' });
    }

    const validatedData = insertTeamSchema.parse({
      ...req.body,
      organizationId: orgData.organization.id,
      createdBy: orgData.membership.id,
    });

    const [newTeam] = await db
      .insert(teams)
      .values(validatedData)
      .returning();

    res.status(201).json(newTeam);
  } catch (error) {
    console.error('[CRM] Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Get team details with members
router.get('/teams/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const teamId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get team
    const [team] = await db
      .select()
      .from(teams)
      .where(and(
        eq(teams.id, teamId),
        eq(teams.organizationId, orgData.organization.id)
      ));

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get team members with user info
    const members = await db
      .select({
        teamMember: teamMembers,
        member: organizationMembers,
        user: users,
      })
      .from(teamMembers)
      .innerJoin(organizationMembers, eq(organizationMembers.id, teamMembers.organizationMemberId))
      .leftJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(teamMembers.teamId, teamId));

    res.json({
      ...team,
      members: members.map(m => ({
        id: m.teamMember.id,
        organizationMemberId: m.member.id,
        userId: m.user?.id,
        email: m.user?.email || m.member.inviteeEmail,
        firstName: m.user?.firstName,
        lastName: m.user?.lastName,
        profilePhoto: m.user?.profilePhoto,
        role: m.member.role,
        addedAt: m.teamMember.createdAt,
      })),
    });
  } catch (error) {
    console.error('[CRM] Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Update team (owner/admin only)
router.patch('/teams/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const teamId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!['owner', 'admin'].includes(orgData.membership.role)) {
      return res.status(403).json({ error: 'Only owners and admins can update teams' });
    }

    // Verify team belongs to org
    const [existingTeam] = await db
      .select()
      .from(teams)
      .where(and(
        eq(teams.id, teamId),
        eq(teams.organizationId, orgData.organization.id)
      ));

    if (!existingTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const { name, description } = req.body;
    const [updatedTeam] = await db
      .update(teams)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    res.json(updatedTeam);
  } catch (error) {
    console.error('[CRM] Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete team (owner/admin only)
router.delete('/teams/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const teamId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!['owner', 'admin'].includes(orgData.membership.role)) {
      return res.status(403).json({ error: 'Only owners and admins can delete teams' });
    }

    // Verify team belongs to org
    const [existingTeam] = await db
      .select()
      .from(teams)
      .where(and(
        eq(teams.id, teamId),
        eq(teams.organizationId, orgData.organization.id)
      ));

    if (!existingTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Delete team (cascades to team_members)
    await db.delete(teams).where(eq(teams.id, teamId));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Add member to team
router.post('/teams/:id/members', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const teamId = parseInt(req.params.id);
    const { organizationMemberId } = req.body;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!['owner', 'admin'].includes(orgData.membership.role)) {
      return res.status(403).json({ error: 'Only owners and admins can manage team members' });
    }

    // Verify team belongs to org
    const [team] = await db
      .select()
      .from(teams)
      .where(and(
        eq(teams.id, teamId),
        eq(teams.organizationId, orgData.organization.id)
      ));

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Verify member belongs to org
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.id, organizationMemberId),
        eq(organizationMembers.organizationId, orgData.organization.id),
        eq(organizationMembers.status, 'active')
      ));

    if (!member) {
      return res.status(404).json({ error: 'Organization member not found' });
    }

    // Check if already a member
    const [existing] = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.organizationMemberId, organizationMemberId)
      ));

    if (existing) {
      return res.status(400).json({ error: 'Member is already in this team' });
    }

    const [newTeamMember] = await db
      .insert(teamMembers)
      .values({
        teamId,
        organizationMemberId,
        addedBy: orgData.membership.id,
      })
      .returning();

    res.status(201).json(newTeamMember);
  } catch (error) {
    console.error('[CRM] Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove member from team
router.delete('/teams/:teamId/members/:memberId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const teamId = parseInt(req.params.teamId);
    const memberId = parseInt(req.params.memberId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!['owner', 'admin'].includes(orgData.membership.role)) {
      return res.status(403).json({ error: 'Only owners and admins can manage team members' });
    }

    // Verify team belongs to org
    const [team] = await db
      .select()
      .from(teams)
      .where(and(
        eq(teams.id, teamId),
        eq(teams.organizationId, orgData.organization.id)
      ));

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Delete team member
    await db
      .delete(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.organizationMemberId, memberId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Get current user's teams
router.get('/my-teams', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const myTeams = await db
      .select({
        team: teams,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.organizationMemberId, orgData.membership.id));

    res.json(myTeams.map(t => t.team));
  } catch (error) {
    console.error('[CRM] Error fetching my teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
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

    const {
      search,
      industry,
      city,
      state,
      hasDeals,
      hasContacts,
      createdFrom,
      createdTo,
      sortField = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '50'
    } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let conditions: any[] = [eq(companies.organizationId, orgData.organization.id)];

    // Apply visibility filtering for companies
    const visibilitySettings = await getCrmVisibilitySettings(orgData.organization.id);
    const visibilityFilter = await buildVisibilityFilter(
      visibilitySettings.companies,
      orgData.membership.id,
      orgData.membership.role,
      companies.ownerId
    );
    if (visibilityFilter) {
      conditions.push(visibilityFilter);
    }

    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          ilike(companies.name, searchTerm),
          ilike(companies.industry, searchTerm),
          ilike(companies.website, searchTerm)
        )!
      );
    }

    // Filter by industry
    if (industry) {
      conditions.push(ilike(companies.industry, `%${industry}%`));
    }

    // Filter by city
    if (city) {
      conditions.push(ilike(companies.city, `%${city}%`));
    }

    // Filter by state
    if (state) {
      conditions.push(ilike(companies.state, `%${state}%`));
    }

    // Filter by created date range
    if (createdFrom) {
      conditions.push(sql`${companies.createdAt} >= ${createdFrom}::timestamp`);
    }
    if (createdTo) {
      conditions.push(sql`${companies.createdAt} <= ${createdTo}::timestamp + interval '1 day'`);
    }

    // Determine sort order
    let orderClause;
    const sortDir = sortOrder === 'asc' ? asc : desc;
    switch (sortField) {
      case 'name':
        orderClause = sortDir(companies.name);
        break;
      case 'industry':
        orderClause = sortDir(companies.industry);
        break;
      case 'website':
        orderClause = sortDir(companies.website);
        break;
      case 'location':
        orderClause = sortDir(companies.city);
        break;
      default:
        orderClause = sortDir(companies.createdAt);
    }

    // For hasDeals and hasContacts, we need subqueries
    // These are post-filtered for now to keep the query simpler
    let companyList = await db
      .select()
      .from(companies)
      .where(and(...conditions))
      .orderBy(orderClause)
      .limit(parseInt(limit as string) * 2) // Fetch extra to account for hasDeals/hasContacts filtering
      .offset(offset);

    // Get contact and deal counts for each company
    const companyIds = companyList.map(c => c.id);

    let contactCounts: Record<number, number> = {};
    let dealCounts: Record<number, number> = {};

    if (companyIds.length > 0) {
      const contactCountResults = await db
        .select({
          companyId: crmContacts.companyId,
          count: sql<number>`count(*)`,
        })
        .from(crmContacts)
        .where(inArray(crmContacts.companyId, companyIds))
        .groupBy(crmContacts.companyId);

      contactCounts = Object.fromEntries(
        contactCountResults.map(r => [r.companyId, Number(r.count)])
      );

      const dealCountResults = await db
        .select({
          companyId: deals.companyId,
          count: sql<number>`count(*)`,
        })
        .from(deals)
        .where(and(
          inArray(deals.companyId, companyIds),
          isNull(deals.deletedAt)
        ))
        .groupBy(deals.companyId);

      dealCounts = Object.fromEntries(
        dealCountResults.map(r => [r.companyId, Number(r.count)])
      );
    }

    // Apply hasDeals and hasContacts filters
    if (hasDeals === 'true') {
      companyList = companyList.filter(c => (dealCounts[c.id] || 0) > 0);
    } else if (hasDeals === 'false') {
      companyList = companyList.filter(c => (dealCounts[c.id] || 0) === 0);
    }

    if (hasContacts === 'true') {
      companyList = companyList.filter(c => (contactCounts[c.id] || 0) > 0);
    } else if (hasContacts === 'false') {
      companyList = companyList.filter(c => (contactCounts[c.id] || 0) === 0);
    }

    // Trim to requested limit
    companyList = companyList.slice(0, parseInt(limit as string));

    // Get total count for base conditions
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(and(...conditions));

    res.json({
      companies: companyList.map(c => ({
        ...c,
        contactCount: contactCounts[c.id] || 0,
        dealCount: dealCounts[c.id] || 0,
      })),
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

    // Queue logo fetch if website provided (non-blocking background task)
    if (newCompany.website && shouldFetchLogo({}, newCompany.website)) {
      queueLogoFetch(newCompany.id, orgData.organization.id, newCompany.website, { isNewCompany: true });
    }

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
      logoUrl,
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

    // Track if logo is being manually set
    const isManualLogoUpload = logoUrl !== undefined && logoUrl !== null && logoUrl !== existing.logoUrl;

    const [updated] = await db
      .update(companies)
      .set({
        ...(name && { name }),
        ...(domain !== undefined && { domain }),
        ...(website !== undefined && { website }),
        ...(logoUrl !== undefined && { logoUrl }),
        // Mark logo as manual if user is explicitly setting it
        ...(isManualLogoUpload && { logoSource: 'manual' }),
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

    // Queue logo fetch if website changed and not manually setting logo
    const newWebsite = website !== undefined ? website : existing.website;
    if (!isManualLogoUpload && newWebsite && shouldFetchLogo(existing, newWebsite, existing.website)) {
      queueLogoFetch(updated.id, orgData.organization.id, newWebsite, { previousWebsite: existing.website });
    }

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

    const {
      search,
      companyId,
      contactType,
      leadStatus,
      source,
      tags,
      hasEmail,
      hasPhone,
      createdFrom,
      createdTo,
      companies: companiesFilter,
      sortField = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '50'
    } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let conditions: any[] = [eq(crmContacts.organizationId, orgData.organization.id)];

    // Apply visibility filtering for contacts
    const visibilitySettings = await getCrmVisibilitySettings(orgData.organization.id);
    const visibilityFilter = await buildVisibilityFilter(
      visibilitySettings.contacts,
      orgData.membership.id,
      orgData.membership.role,
      crmContacts.ownerId
    );
    if (visibilityFilter) {
      conditions.push(visibilityFilter);
    }

    if (companyId) {
      conditions.push(eq(crmContacts.companyId, parseInt(companyId as string)));
    }

    // Filter by companies (comma-separated IDs)
    if (companiesFilter) {
      const companyIds = (companiesFilter as string).split(',').map(id => parseInt(id.trim()));
      if (companyIds.length === 1) {
        conditions.push(eq(crmContacts.companyId, companyIds[0]));
      } else {
        conditions.push(inArray(crmContacts.companyId, companyIds));
      }
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

    // Filter by lead status(es)
    if (leadStatus) {
      const statuses = (leadStatus as string).split(',').map(s => s.trim());
      if (statuses.length === 1) {
        conditions.push(eq(crmContacts.leadStatus, statuses[0]));
      } else {
        conditions.push(inArray(crmContacts.leadStatus, statuses));
      }
    }

    // Filter by source(s)
    if (source) {
      const sources = (source as string).split(',').map(s => s.trim());
      if (sources.length === 1) {
        conditions.push(eq(crmContacts.source, sources[0]));
      } else {
        conditions.push(inArray(crmContacts.source, sources));
      }
    }

    // Filter by tags (comma-separated - checks if contact's tags array contains any of these)
    if (tags) {
      const tagList = (tags as string).split(',').map(t => t.trim());
      // Use JSON array containment to check if any tag matches
      const tagConditions = tagList.map(tag =>
        sql`${crmContacts.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`
      );
      if (tagConditions.length === 1) {
        conditions.push(tagConditions[0]);
      } else {
        conditions.push(or(...tagConditions)!);
      }
    }

    // Filter by hasEmail
    if (hasEmail === 'true') {
      conditions.push(and(
        sql`${crmContacts.email} IS NOT NULL`,
        sql`${crmContacts.email} != ''`
      )!);
    } else if (hasEmail === 'false') {
      conditions.push(or(
        sql`${crmContacts.email} IS NULL`,
        sql`${crmContacts.email} = ''`
      )!);
    }

    // Filter by hasPhone
    if (hasPhone === 'true') {
      conditions.push(and(
        sql`${crmContacts.phone} IS NOT NULL`,
        sql`${crmContacts.phone} != ''`
      )!);
    } else if (hasPhone === 'false') {
      conditions.push(or(
        sql`${crmContacts.phone} IS NULL`,
        sql`${crmContacts.phone} = ''`
      )!);
    }

    // Filter by created date range
    if (createdFrom) {
      conditions.push(sql`${crmContacts.createdAt} >= ${createdFrom}::timestamp`);
    }
    if (createdTo) {
      conditions.push(sql`${crmContacts.createdAt} <= ${createdTo}::timestamp + interval '1 day'`);
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

    // Determine sort order
    let orderClause;
    const sortDir = sortOrder === 'asc' ? asc : desc;
    switch (sortField) {
      case 'name':
        orderClause = sortDir(crmContacts.firstName);
        break;
      case 'email':
        orderClause = sortDir(crmContacts.email);
        break;
      case 'phone':
        orderClause = sortDir(crmContacts.phone);
        break;
      case 'contactType':
        orderClause = sortDir(crmContacts.contactType);
        break;
      case 'leadStatus':
        orderClause = sortDir(crmContacts.leadStatus);
        break;
      default:
        orderClause = sortDir(crmContacts.createdAt);
    }

    const contactList = await db
      .select({
        contact: crmContacts,
        company: companies,
      })
      .from(crmContacts)
      .leftJoin(companies, eq(companies.id, crmContacts.companyId))
      .where(and(...conditions))
      .orderBy(orderClause)
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
      'avatarUrl',
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

    // Apply visibility filtering
    const visibilitySettings = await getCrmVisibilitySettings(orgData.organization.id);
    const visibilityFilter = await buildVisibilityFilter(
      visibilitySettings.deals,
      orgData.membership.id,
      orgData.membership.role,
      deals.ownerId,
      deals.id,
      true // Include collaborator access
    );
    if (visibilityFilter) {
      conditions.push(visibilityFilter);
    }

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

    // Get visibility filter for this user
    const visibilitySettings = await getCrmVisibilitySettings(orgData.organization.id);
    const visibilityFilter = await buildVisibilityFilter(
      visibilitySettings.deals,
      orgData.membership.id,
      orgData.membership.role,
      deals.ownerId,
      deals.id,
      true // Include collaborator access
    );

    // Get stages for this pipeline
    const stages = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipelineId))
      .orderBy(asc(pipelineStages.displayOrder));

    // Get all stage IDs for batch query
    const stageIds = stages.map(s => s.id);

    // Batch load all deals for all stages in ONE query (fixes N+1 problem)
    const baseConditions = [
      inArray(deals.stageId, stageIds),
      eq(deals.organizationId, orgData.organization.id),
      isNull(deals.deletedAt),
    ];
    if (visibilityFilter) {
      baseConditions.push(visibilityFilter);
    }

    const allDeals = await db
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
      .where(and(...baseConditions))
      .orderBy(desc(deals.updatedAt))
      .limit(500); // Safety limit per stage batch

    // Group deals by stageId in memory (much faster than N separate queries)
    const dealsByStage = new Map<number, typeof allDeals>();
    for (const dealRow of allDeals) {
      const stageId = dealRow.deal.stageId;
      if (stageId) {
        if (!dealsByStage.has(stageId)) {
          dealsByStage.set(stageId, []);
        }
        dealsByStage.get(stageId)!.push(dealRow);
      }
    }

    // Combine stages with their deals
    const stagesWithDeals = stages.map(stage => ({
      ...stage,
      deals: (dealsByStage.get(stage.id) || []).map((d) => ({
        ...d.deal,
        company: d.company,
        owner: d.owner?.id ? d.owner : null,
      })),
    }));

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

    // Check visibility access
    const visibilitySettings = await getCrmVisibilitySettings(orgData.organization.id);
    if (orgData.membership.role !== 'owner' && orgData.membership.role !== 'admin') {
      const dealOwnerId = result.deal.ownerId;

      if (visibilitySettings.deals === 'owner_only') {
        const isOwner = dealOwnerId === orgData.membership.id;
        const [isCollaborator] = await db
          .select()
          .from(dealCollaborators)
          .where(and(
            eq(dealCollaborators.dealId, dealId),
            eq(dealCollaborators.organizationMemberId, orgData.membership.id)
          ))
          .limit(1);

        if (!isOwner && !isCollaborator) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else if (visibilitySettings.deals === 'team') {
        const teammateIds = await getTeammateIds(orgData.membership.id);
        const isTeammate = dealOwnerId ? teammateIds.includes(dealOwnerId) : false;
        const [isCollaborator] = await db
          .select()
          .from(dealCollaborators)
          .where(and(
            eq(dealCollaborators.dealId, dealId),
            eq(dealCollaborators.organizationMemberId, orgData.membership.id)
          ))
          .limit(1);

        if (!isTeammate && !isCollaborator) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
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

// ==================== DEAL COLLABORATORS ====================

// Get deal collaborators
router.get('/deals/:dealId/collaborators', async (req, res) => {
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
      .where(and(
        eq(deals.id, dealId),
        eq(deals.organizationId, orgData.organization.id)
      ));

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Get collaborators with user info
    const collaborators = await db
      .select({
        collaborator: dealCollaborators,
        member: organizationMembers,
        user: users,
      })
      .from(dealCollaborators)
      .innerJoin(organizationMembers, eq(organizationMembers.id, dealCollaborators.organizationMemberId))
      .leftJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(dealCollaborators.dealId, dealId));

    res.json(collaborators.map(c => ({
      id: c.collaborator.id,
      organizationMemberId: c.member.id,
      userId: c.user?.id,
      email: c.user?.email || c.member.inviteeEmail,
      firstName: c.user?.firstName,
      lastName: c.user?.lastName,
      profilePhoto: c.user?.profilePhoto,
      permission: c.collaborator.permission,
      createdAt: c.collaborator.createdAt,
    })));
  } catch (error) {
    console.error('[CRM] Error fetching deal collaborators:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// Add collaborator to deal
router.post('/deals/:dealId/collaborators', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);
    const { organizationMemberId, permission = 'view' } = req.body;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify deal belongs to org
    const [deal] = await db
      .select()
      .from(deals)
      .where(and(
        eq(deals.id, dealId),
        eq(deals.organizationId, orgData.organization.id)
      ));

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Only deal owner or admin can add collaborators
    const isOwner = deal.ownerId === orgData.membership.id;
    const isAdmin = ['owner', 'admin'].includes(orgData.membership.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only deal owner or admin can add collaborators' });
    }

    // Verify member belongs to org
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.id, organizationMemberId),
        eq(organizationMembers.organizationId, orgData.organization.id),
        eq(organizationMembers.status, 'active')
      ));

    if (!member) {
      return res.status(404).json({ error: 'Organization member not found' });
    }

    // Check if already a collaborator
    const [existing] = await db
      .select()
      .from(dealCollaborators)
      .where(and(
        eq(dealCollaborators.dealId, dealId),
        eq(dealCollaborators.organizationMemberId, organizationMemberId)
      ));

    if (existing) {
      return res.status(400).json({ error: 'Member is already a collaborator on this deal' });
    }

    const [newCollaborator] = await db
      .insert(dealCollaborators)
      .values({
        dealId,
        organizationMemberId,
        permission,
        invitedBy: orgData.membership.id,
      })
      .returning();

    res.status(201).json(newCollaborator);
  } catch (error) {
    console.error('[CRM] Error adding deal collaborator:', error);
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

// Update collaborator permission
router.patch('/deals/:dealId/collaborators/:collaboratorId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);
    const collaboratorId = parseInt(req.params.collaboratorId);
    const { permission } = req.body;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify deal belongs to org
    const [deal] = await db
      .select()
      .from(deals)
      .where(and(
        eq(deals.id, dealId),
        eq(deals.organizationId, orgData.organization.id)
      ));

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Only deal owner or admin can update collaborators
    const isOwner = deal.ownerId === orgData.membership.id;
    const isAdmin = ['owner', 'admin'].includes(orgData.membership.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only deal owner or admin can update collaborators' });
    }

    const [updated] = await db
      .update(dealCollaborators)
      .set({ permission })
      .where(and(
        eq(dealCollaborators.id, collaboratorId),
        eq(dealCollaborators.dealId, dealId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[CRM] Error updating deal collaborator:', error);
    res.status(500).json({ error: 'Failed to update collaborator' });
  }
});

// Remove collaborator from deal
router.delete('/deals/:dealId/collaborators/:collaboratorId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const dealId = parseInt(req.params.dealId);
    const collaboratorId = parseInt(req.params.collaboratorId);

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify deal belongs to org
    const [deal] = await db
      .select()
      .from(deals)
      .where(and(
        eq(deals.id, dealId),
        eq(deals.organizationId, orgData.organization.id)
      ));

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Only deal owner or admin can remove collaborators
    const isOwner = deal.ownerId === orgData.membership.id;
    const isAdmin = ['owner', 'admin'].includes(orgData.membership.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only deal owner or admin can remove collaborators' });
    }

    await db
      .delete(dealCollaborators)
      .where(and(
        eq(dealCollaborators.id, collaboratorId),
        eq(dealCollaborators.dealId, dealId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('[CRM] Error removing deal collaborator:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
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
        const [notification] = await db.insert(notifications).values({
          organizationId: orgData.organization.id,
          userId: mentionedUserId,
          type: 'mention',
          title: `${authorName} mentioned you`,
          message: `You were mentioned in a note on ${entityName}`,
          entityType: parsed.data.objectType,
          entityId: parsed.data.objectId,
          actorId: req.user!.id,
        }).returning();

        // Send email notification for the mention (if user has enabled it)
        try {
          // Check user's notification preferences
          const [notifPrefs] = await db
            .select({ emailMentions: userNotificationPreferences.emailMentions })
            .from(userNotificationPreferences)
            .where(eq(userNotificationPreferences.userId, mentionedUserId));

          // Default to true if no preferences set (emailMentions defaults to true in schema)
          const shouldSendEmail = notifPrefs?.emailMentions !== false;

          if (shouldSendEmail) {
            // Get mentioned user's email
            const [mentionedUserData] = await db
              .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
              .from(users)
              .where(eq(users.id, mentionedUserId));

            if (mentionedUserData?.email) {
              const mentionedUserName = mentionedUserData.firstName
                ? `${mentionedUserData.firstName} ${mentionedUserData.lastName || ''}`.trim()
                : '';

              await sendMentionNotificationEmail({
                mentionedUserEmail: mentionedUserData.email,
                mentionedUserName,
                mentionerName: authorName,
                entityType: parsed.data.objectType,
                entityName,
                entityId: parsed.data.objectId,
                noteContent: parsed.data.content,
              });

              // Mark email as sent in notification
              await db.update(notifications)
                .set({ emailSent: true, emailSentAt: new Date() })
                .where(eq(notifications.id, notification.id));

              console.log(`[CRM] Mention notification email sent to ${mentionedUserData.email}`);
            }
          } else {
            console.log(`[CRM] Mention email skipped for user ${mentionedUserId} - notifications disabled`);
          }
        } catch (emailError) {
          console.error('[CRM] Failed to send mention notification email:', emailError);
          // Don't fail the request if email fails
        }
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

      // Enrich email activities from database with embeddedContent
      if (activity.activityType === 'email') {
        // Extract subject from title if it contains "Sent email:" or "Replied to:"
        let subject = metadata.subject || '';
        if (!subject && activity.title) {
          if (activity.title.startsWith('Sent email: ')) {
            subject = activity.title.replace('Sent email: ', '');
          } else if (activity.title.startsWith('Replied to: ')) {
            subject = activity.title.replace('Replied to: ', '');
          }
        }

        return {
          ...activity,
          embeddedContent: {
            type: 'email',
            subject: subject,
            snippet: activity.description || '',
            from: metadata.direction === 'sent' ? (a.user?.email || 'You') : metadata.to,
            to: metadata.to || '',
            direction: metadata.direction || 'sent',
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

    // Fetch emails for deals and add to activity feed
    if (objectType === 'deal') {
      try {
        // Get the deal's contacts
        const dealContactsResult = await db
          .select({ contact: crmContacts })
          .from(dealContacts)
          .innerJoin(crmContacts, eq(crmContacts.id, dealContacts.contactId))
          .where(eq(dealContacts.dealId, objId));

        const contacts = dealContactsResult.map(dc => dc.contact);
        const contactEmails = contacts
          .filter(c => c.email)
          .map(c => c.email!.toLowerCase());

        if (contactEmails.length > 0) {
          // Get user's email connection
          const connection = await getUserEmailConnection(req.user!.id);

          if (connection && connection.status === 'active') {
            const connectionForProvider = {
              ...connection,
              accessToken: connection.accessTokenEncrypted,
              refreshToken: connection.refreshTokenEncrypted,
            };

            let allEmails: any[] = [];

            for (const contactEmail of contactEmails) {
              try {
                let emails: any[] = [];

                if (connection.provider === 'gmail') {
                  emails = await gmailProvider.getRecentEmails(connectionForProvider as any, {
                    maxResults: 15,
                    query: contactEmail,
                  });
                } else if (connection.provider === 'microsoft') {
                  emails = await microsoftProvider.getRecentEmails(connectionForProvider as any, {
                    maxResults: 15,
                    query: contactEmail,
                  });
                }

                // Filter to only include emails actually involving the contact
                emails = emails.filter(email => {
                  const fromMatch = email.from?.toLowerCase() === contactEmail;
                  const toMatch = email.to?.toLowerCase().includes(contactEmail);
                  return fromMatch || toMatch;
                });

                allEmails = [...allEmails, ...emails];
              } catch (fetchError: any) {
                console.error('[CRM] Error fetching emails for activity feed:', fetchError.message);
                continue;
              }
            }

            // Deduplicate by message ID
            const seen = new Set();
            allEmails = allEmails.filter(email => {
              if (seen.has(email.id)) return false;
              seen.add(email.id);
              return true;
            });

            // Convert emails to activity feed items
            for (const email of allEmails) {
              const isOutgoing = !contactEmails.includes(email.from?.toLowerCase());
              feedItems.push({
                id: `email-${email.id}`,
                activityType: 'email',
                objectType: 'deal',
                objectId: objId,
                timestamp: email.date,
                title: isOutgoing ? 'Sent an email' : 'Received an email',
                description: email.subject,
                performedByUser: isOutgoing ? { email: email.from } : null,
                metadata: {
                  direction: isOutgoing ? 'sent' : 'received',
                  emailId: email.id,
                  provider: connection.provider,
                },
                embeddedContent: {
                  type: 'email',
                  id: email.id,
                  subject: email.subject,
                  snippet: email.snippet,
                  body: email.body,
                  from: email.from,
                  fromName: email.fromName,
                  to: email.to,
                  date: email.date,
                  direction: isOutgoing ? 'sent' : 'received',
                  provider: connection.provider,
                },
              } as any);
            }
          }
        }
      } catch (emailError) {
        // Log but don't fail the entire activity feed if emails fail
        console.error('[CRM] Error adding emails to activity feed:', emailError);
      }
    }

    // Fetch emails for contacts and add to activity feed
    if (objectType === 'contact') {
      try {
        // Get the contact's email
        const contact = await db
          .select()
          .from(crmContacts)
          .where(eq(crmContacts.id, objId))
          .limit(1);

        if (contact.length > 0 && contact[0].email) {
          const contactEmail = contact[0].email.toLowerCase();

          // Get user's email connection
          const connection = await getUserEmailConnection(req.user!.id);

          if (connection && connection.status === 'active') {
            const connectionForProvider = {
              ...connection,
              accessToken: connection.accessTokenEncrypted,
              refreshToken: connection.refreshTokenEncrypted,
            };

            let emails: any[] = [];

            try {
              if (connection.provider === 'gmail') {
                emails = await gmailProvider.getRecentEmails(connectionForProvider as any, {
                  maxResults: 25,
                  query: contactEmail,
                });
              } else if (connection.provider === 'microsoft') {
                emails = await microsoftProvider.getRecentEmails(connectionForProvider as any, {
                  maxResults: 25,
                  query: contactEmail,
                });
              }

              // Filter to only include emails actually involving the contact
              emails = emails.filter(email => {
                const fromMatch = email.from?.toLowerCase() === contactEmail;
                const toMatch = email.to?.toLowerCase().includes(contactEmail);
                return fromMatch || toMatch;
              });

              // Convert emails to activity feed items
              for (const email of emails) {
                const isOutgoing = email.from?.toLowerCase() !== contactEmail;
                feedItems.push({
                  id: `email-${email.id}`,
                  activityType: 'email',
                  objectType: 'contact',
                  objectId: objId,
                  timestamp: email.date,
                  title: isOutgoing ? 'Sent an email' : 'Received an email',
                  description: email.subject,
                  performedByUser: isOutgoing ? { email: email.from } : null,
                  metadata: {
                    direction: isOutgoing ? 'sent' : 'received',
                    emailId: email.id,
                    provider: connection.provider,
                  },
                  embeddedContent: {
                    type: 'email',
                    id: email.id,
                    subject: email.subject,
                    snippet: email.snippet,
                    body: email.body,
                    from: email.from,
                    fromName: email.fromName,
                    to: email.to,
                    date: email.date,
                    direction: isOutgoing ? 'sent' : 'received',
                    provider: connection.provider,
                  },
                } as any);
              }
            } catch (fetchError: any) {
              console.error('[CRM] Error fetching emails for contact activity feed:', fetchError.message);
            }
          }
        }
      } catch (emailError) {
        // Log but don't fail the entire activity feed if emails fail
        console.error('[CRM] Error adding emails to contact activity feed:', emailError);
      }
    }

    // Fetch emails for companies and add to activity feed
    if (objectType === 'company') {
      try {
        // Get all contacts for this company
        const companyContacts = await db
          .select()
          .from(crmContacts)
          .where(eq(crmContacts.companyId, objId));

        const contactEmails = companyContacts
          .filter(c => c.email)
          .map(c => c.email!.toLowerCase());

        if (contactEmails.length > 0) {
          // Get user's email connection
          const connection = await getUserEmailConnection(req.user!.id);

          if (connection && connection.status === 'active') {
            const connectionForProvider = {
              ...connection,
              accessToken: connection.accessTokenEncrypted,
              refreshToken: connection.refreshTokenEncrypted,
            };

            let allEmails: any[] = [];

            for (const contactEmail of contactEmails) {
              try {
                let emails: any[] = [];

                if (connection.provider === 'gmail') {
                  emails = await gmailProvider.getRecentEmails(connectionForProvider as any, {
                    maxResults: 15,
                    query: contactEmail,
                  });
                } else if (connection.provider === 'microsoft') {
                  emails = await microsoftProvider.getRecentEmails(connectionForProvider as any, {
                    maxResults: 15,
                    query: contactEmail,
                  });
                }

                // Filter to only include emails actually involving the contact
                emails = emails.filter(email => {
                  const fromMatch = email.from?.toLowerCase() === contactEmail;
                  const toMatch = email.to?.toLowerCase().includes(contactEmail);
                  return fromMatch || toMatch;
                });

                allEmails = [...allEmails, ...emails];
              } catch (fetchError: any) {
                console.error('[CRM] Error fetching emails for company activity feed:', fetchError.message);
                continue;
              }
            }

            // Deduplicate by message ID
            const seen = new Set();
            allEmails = allEmails.filter(email => {
              if (seen.has(email.id)) return false;
              seen.add(email.id);
              return true;
            });

            // Convert emails to activity feed items
            for (const email of allEmails) {
              const isOutgoing = !contactEmails.includes(email.from?.toLowerCase());
              feedItems.push({
                id: `email-${email.id}`,
                activityType: 'email',
                objectType: 'company',
                objectId: objId,
                timestamp: email.date,
                title: isOutgoing ? 'Sent an email' : 'Received an email',
                description: email.subject,
                performedByUser: isOutgoing ? { email: email.from } : null,
                metadata: {
                  direction: isOutgoing ? 'sent' : 'received',
                  emailId: email.id,
                  provider: connection.provider,
                },
                embeddedContent: {
                  type: 'email',
                  id: email.id,
                  subject: email.subject,
                  snippet: email.snippet,
                  body: email.body,
                  from: email.from,
                  fromName: email.fromName,
                  to: email.to,
                  date: email.date,
                  direction: isOutgoing ? 'sent' : 'received',
                  provider: connection.provider,
                },
              } as any);
            }
          }
        }
      } catch (emailError) {
        // Log but don't fail the entire activity feed if emails fail
        console.error('[CRM] Error adding emails to company activity feed:', emailError);
      }
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

    // Sanitize filename to prevent path traversal attacks
    const safeOriginalName = sanitizeFilename(req.file.originalname);
    const ext = sanitizeExtension(req.file.originalname);

    // Generate unique filename for storage
    const storageFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filePath = path.join(crmUploadsDir, storageFileName);

    // Save file
    await fs.writeFile(filePath, req.file.buffer);

    const [newAttachment] = await db
      .insert(crmAttachments)
      .values({
        organizationId: orgData.organization.id,
        objectType,
        objectId: parseInt(objectId),
        fileName: safeOriginalName,
        filePath: storageFileName,
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
      { fileName: safeOriginalName, attachmentId: newAttachment.id }
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

// Helper: Get user's email connection (Gmail or Microsoft) - returns any status
async function getUserEmailConnection(userId: number) {
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.userId, userId),
        inArray(integrationConnections.provider, ['gmail', 'microsoft'])
      )
    )
    .orderBy(desc(integrationConnections.lastUsedAt))
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
        // Microsoft: Use query parameter which uses $search (more reliable than $filter)
        emails = await microsoftProvider.getRecentEmails(connectionForProvider as any, {
          maxResults: 50,
          query: contactEmail,
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

    // Get user's email connection first to know the connection status
    const connection = await getUserEmailConnection(req.user!.id);

    if (!connection) {
      return res.json({
        emails: [],
        connected: false,
        message: 'No email account connected'
      });
    }

    // Check if connection is active - if not, return appropriate status
    if (connection.status !== 'active') {
      return res.json({
        emails: [],
        connected: true,
        expired: connection.status === 'expired' || connection.status === 'error',
        provider: connection.provider,
        message: connection.status === 'expired'
          ? 'Email connection expired. Please reconnect in Settings > Email Sync.'
          : `Email connection status: ${connection.status}. Please reconnect in Settings > Email Sync.`
      });
    }

    if (contactEmails.length === 0) {
      return res.json({
        emails: [],
        connected: true,
        provider: connection.provider,
        message: 'No contacts with email addresses associated with this deal'
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

        try {
          if (connection.provider === 'gmail') {
            emails = await gmailProvider.getRecentEmails(connectionForProvider as any, {
              maxResults: 25,
              query: contactEmail,
            });
          } else if (connection.provider === 'microsoft') {
            // Use query parameter which uses $search (more reliable than $filter for recipients)
            emails = await microsoftProvider.getRecentEmails(connectionForProvider as any, {
              maxResults: 25,
              query: contactEmail,
            });
          }
        } catch (fetchError: any) {
          console.error('[CRM] Error fetching emails for contact:', fetchError.message);
          // Continue with other contacts instead of failing entirely
          continue;
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

// Get emails for a company (all associated contacts)
router.get('/companies/:id/emails', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const companyId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);

    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get the company
    const [company] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          eq(companies.organizationId, orgData.organization.id)
        )
      );

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get all contacts associated with this company
    const companyContacts = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.companyId, companyId));

    const contactEmails = companyContacts
      .filter(c => c.email)
      .map(c => ({ email: c.email!.toLowerCase(), name: c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : c.firstName || c.lastName || c.email }));

    // Get user's email connection first to know the connection status
    const connection = await getUserEmailConnection(req.user!.id);

    if (!connection) {
      return res.json({
        emails: [],
        connected: false,
        message: 'No email account connected'
      });
    }

    // Check if connection is active - if not, return appropriate status
    if (connection.status !== 'active') {
      return res.json({
        emails: [],
        connected: true,
        expired: connection.status === 'expired' || connection.status === 'error',
        provider: connection.provider,
        message: connection.status === 'expired'
          ? 'Email connection expired. Please reconnect in Settings > Email Sync.'
          : `Email connection status: ${connection.status}. Please reconnect in Settings > Email Sync.`
      });
    }

    if (contactEmails.length === 0) {
      return res.json({
        emails: [],
        connected: true,
        provider: connection.provider,
        contactCount: 0,
        noContacts: true,
        message: 'No contacts with email addresses associated with this company'
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
      for (const contactInfo of contactEmails) {
        let emails: any[] = [];

        try {
          if (connection.provider === 'gmail') {
            emails = await gmailProvider.getRecentEmails(connectionForProvider as any, {
              maxResults: 25,
              query: contactInfo.email,
            });
          } else if (connection.provider === 'microsoft') {
            // Use query parameter which uses $search (more reliable than $filter)
            emails = await microsoftProvider.getRecentEmails(connectionForProvider as any, {
              maxResults: 25,
              query: contactInfo.email,
            });
          }
        } catch (fetchError: any) {
          console.error('[CRM] Error fetching emails for contact:', fetchError.message);
          // Continue with other contacts instead of failing entirely
          continue;
        }

        // Filter and tag emails with contact info
        emails = emails
          .filter(email => {
            const fromMatch = email.from?.toLowerCase() === contactInfo.email;
            const toMatch = email.to?.toLowerCase().includes(contactInfo.email);
            return fromMatch || toMatch;
          })
          .map(email => ({
            ...email,
            contactEmail: contactInfo.email,
            contactName: contactInfo.name,
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
      console.error('[CRM] Error fetching company emails:', emailError);

      if (emailError.message?.includes('token') || emailError.message?.includes('unauthorized')) {
        return res.json({
          emails: [],
          connected: true,
          expired: true,
          message: 'Email connection expired. Please reconnect in Settings > Email Sync.'
        });
      }

      // Return partial results with error flag
      return res.json({
        emails: allEmails.slice(0, 100),
        connected: true,
        provider: connection.provider,
        contactCount: contactEmails.length,
        error: 'Some emails could not be fetched',
      });
    }

    res.json({
      emails: allEmails.slice(0, 100), // Limit to 100 most recent
      connected: true,
      provider: connection.provider,
      contactCount: contactEmails.length,
    });
  } catch (error) {
    console.error('[CRM] Error fetching company emails:', error);
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
    const { maxResults = '30', debug } = req.query;

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
    try {
      const emails = await getEmailsForContact(req.user!.id, contact.email, {
        maxResults: parseInt(maxResults as string),
      });

      res.json({
        emails,
        connected: true,
        provider: emailConn.provider,
        contactEmail: contact.email,
        ...(debug ? { debug: { userId: req.user!.id, contactId, connectedAccount: emailConn.connection.providerAccountId } } : {}),
      });
    } catch (emailError: any) {
      // Check if it's a token expiry issue
      const isExpired = emailError.message?.includes('expired') ||
                        emailError.message?.includes('token') ||
                        emailError.message?.includes('unauthorized');

      res.json({
        emails: [],
        connected: true,
        expired: isExpired,
        provider: emailConn.provider,
        error: emailError.message || 'Failed to fetch emails',
      });
    }
  } catch (error) {
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

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    const result = await sendEmailService(req.user!.id, {
      to,
      subject,
      body,
      isHtml: isHtml || false,
    });

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
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

/**
 * Get connected email info (for compose dialogs)
 */
router.get('/emails/connection/info', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }

  try {
    const emailConn = await getEmailConnection(req.user!.id);

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

// Search across deals, contacts, companies, CIMs, and e-signatures
// type filter: "all" | "deal" | "contact" | "company" | "cim" | "esign"
router.get('/search', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { q, type } = req.query;
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ results: [] });
    }

    const searchTerm = `%${q}%`;
    const limit = 10;
    const searchType = type && typeof type === 'string' ? type : 'all';

    let results: any[] = [];

    // Search deals
    if (searchType === 'all' || searchType === 'deal') {
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

      results.push(
        ...dealResults.map(d => ({
          type: 'deal' as const,
          id: d.id,
          title: d.name,
          subtitle: d.companyName || undefined,
        }))
      );
    }

    // Search contacts
    if (searchType === 'all' || searchType === 'contact') {
      const contactResults = await db
        .select({
          id: crmContacts.id,
          firstName: crmContacts.firstName,
          lastName: crmContacts.lastName,
          email: crmContacts.email,
          companyName: companies.name,
          avatarUrl: crmContacts.avatarUrl,
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

      results.push(
        ...contactResults.map(c => ({
          type: 'contact' as const,
          id: c.id,
          title: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email,
          subtitle: c.companyName || c.email,
          imageUrl: c.avatarUrl || undefined,
        }))
      );
    }

    // Search companies
    if (searchType === 'all' || searchType === 'company') {
      const companyResults = await db
        .select({
          id: companies.id,
          name: companies.name,
          website: companies.website,
          logoUrl: companies.logoUrl,
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

      results.push(
        ...companyResults.map(c => ({
          type: 'company' as const,
          id: c.id,
          title: c.name,
          subtitle: c.website || undefined,
          imageUrl: c.logoUrl || undefined,
        }))
      );
    }

    // Search CIM documents
    if (searchType === 'all' || searchType === 'cim') {
      const cimResults = await db
        .select({
          id: cimDocuments.id,
          title: cimDocuments.title,
        })
        .from(cimDocuments)
        .where(
          and(
            eq(cimDocuments.userId, req.user!.id),
            isNull(cimDocuments.deletedAt),
            ilike(cimDocuments.title, searchTerm)
          )
        )
        .limit(limit);

      results.push(
        ...cimResults.map(c => ({
          type: 'cim' as const,
          id: c.id,
          title: c.title,
          subtitle: 'CIM Document',
        }))
      );
    }

    // Search e-signature envelopes
    if (searchType === 'all' || searchType === 'esign') {
      const esignResults = await db
        .select({
          id: esignEnvelopes.id,
          title: esignEnvelopes.title,
          status: esignEnvelopes.status,
          envelopeId: esignEnvelopes.envelopeId,
        })
        .from(esignEnvelopes)
        .where(
          and(
            eq(esignEnvelopes.userId, req.user!.id),
            ilike(esignEnvelopes.title, searchTerm)
          )
        )
        .limit(limit);

      results.push(
        ...esignResults.map(e => ({
          type: 'esign' as const,
          id: e.id,
          title: e.title,
          subtitle: e.status.charAt(0).toUpperCase() + e.status.slice(1),
          envelopeId: e.envelopeId,
        }))
      );
    }

    // Limit total results
    results = results.slice(0, 20);

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

// ============================================
// PERMISSIONS ENDPOINTS
// ============================================

// Get permissions matrix for all roles (for settings page)
router.get('/organization/permissions', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if user can view permissions (owner or admin)
    const canView = await canManagePermissions(req.user!.id);
    if (!canView) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const matrix = await getPermissionsMatrix(orgData.organization.id);

    res.json({
      matrix,
      permissionKeys: PERMISSION_KEYS,
      categoryInfo: CATEGORY_INFO,
      roles: ALL_ROLES,
    });
  } catch (error) {
    console.error('[CRM] Error fetching permissions matrix:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Update a single permission
router.put('/organization/permissions', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if user can manage permissions (owner or admin)
    const canManage = await canManagePermissions(req.user!.id);
    if (!canManage) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { permissionKey, role, granted } = req.body;

    if (!permissionKey || !role || typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'Missing required fields: permissionKey, role, granted' });
    }

    const result = await updatePermission(
      orgData.organization.id,
      permissionKey,
      role,
      granted
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Return updated matrix
    const matrix = await getPermissionsMatrix(orgData.organization.id);
    res.json({ success: true, matrix });
  } catch (error) {
    console.error('[CRM] Error updating permission:', error);
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

// Get current user's effective permissions
router.get('/organization/my-permissions', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const userPerms = await getUserPermissions(req.user!.id);
    if (!userPerms) {
      return res.status(404).json({ error: 'No organization membership found' });
    }

    res.json({
      role: userPerms.role,
      permissions: userPerms.permissions,
    });
  } catch (error) {
    console.error('[CRM] Error fetching user permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// ==================== DATA IMPORT ROUTES ====================

// Standard field definitions for each entity type
const IMPORT_FIELD_DEFINITIONS = {
  contact: {
    standard: [
      { key: 'firstName', label: 'First Name', required: true },
      { key: 'lastName', label: 'Last Name', required: true },
      { key: 'email', label: 'Email', required: true, unique: true },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'title', label: 'Title', required: false },
      { key: 'department', label: 'Department', required: false },
      { key: 'lifecycleStage', label: 'Lifecycle Stage', required: false },
      { key: 'contactType', label: 'Contact Type', required: false },
      { key: 'linkedinUrl', label: 'LinkedIn URL', required: false },
      { key: 'source', label: 'Source', required: false },
      { key: 'notes', label: 'Notes', required: false },
      { key: 'tags', label: 'Tags', required: false },
    ],
    associations: [
      { key: 'companyName', label: 'Company Name', required: false },
      { key: 'companyDomain', label: 'Company Domain', required: false },
    ],
  },
  company: {
    standard: [
      { key: 'name', label: 'Name', required: true },
      { key: 'domain', label: 'Domain', required: false, unique: true },
      { key: 'website', label: 'Website', required: false },
      { key: 'industry', label: 'Industry', required: false },
      { key: 'size', label: 'Company Size', required: false },
      { key: 'annualRevenue', label: 'Annual Revenue', required: false },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'address', label: 'Address', required: false },
      { key: 'city', label: 'City', required: false },
      { key: 'state', label: 'State', required: false },
      { key: 'country', label: 'Country', required: false },
      { key: 'linkedinUrl', label: 'LinkedIn URL', required: false },
      { key: 'description', label: 'Description', required: false },
    ],
    associations: [],
  },
  deal: {
    standard: [
      { key: 'name', label: 'Name', required: true },
      { key: 'amount', label: 'Amount', required: false },
      { key: 'currency', label: 'Currency', required: false },
      { key: 'closeDate', label: 'Close Date', required: false },
      { key: 'probability', label: 'Probability', required: false },
      { key: 'priority', label: 'Priority', required: false },
      { key: 'source', label: 'Source', required: false },
      { key: 'description', label: 'Description', required: false },
    ],
    associations: [
      { key: 'companyName', label: 'Company Name', required: false },
      { key: 'companyDomain', label: 'Company Domain', required: false },
      { key: 'contactEmails', label: 'Contact Emails', required: false },
      { key: 'pipelineName', label: 'Pipeline', required: false },
      { key: 'stageName', label: 'Stage', required: false },
      { key: 'ownerEmail', label: 'Owner Email', required: false },
    ],
  },
};

// Get import template for an entity type (includes custom fields)
router.get('/import/template/:entityType', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { entityType } = req.params;
    if (!['contact', 'company', 'deal'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get custom fields for this entity type
    const customFields = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, orgData.organization.id),
          eq(customFieldDefinitions.objectType, entityType)
        )
      )
      .orderBy(customFieldDefinitions.displayOrder);

    const fieldDef = IMPORT_FIELD_DEFINITIONS[entityType as keyof typeof IMPORT_FIELD_DEFINITIONS];

    // Build headers: standard fields + associations + custom fields
    const headers = [
      ...fieldDef.standard.map(f => f.label + (f.required ? '*' : '')),
      ...fieldDef.associations.map(f => f.label),
      ...customFields.map(f => `[Custom] ${f.label}`),
    ];

    // Build example row
    const exampleRow: string[] = [];
    fieldDef.standard.forEach(f => {
      switch (f.key) {
        case 'firstName': exampleRow.push('John'); break;
        case 'lastName': exampleRow.push('Smith'); break;
        case 'email': exampleRow.push('john@example.com'); break;
        case 'phone': exampleRow.push('555-0100'); break;
        case 'title': exampleRow.push('VP Sales'); break;
        case 'name': exampleRow.push(entityType === 'company' ? 'Acme Corporation' : 'Enterprise Deal'); break;
        case 'domain': exampleRow.push('acme.com'); break;
        case 'website': exampleRow.push('https://acme.com'); break;
        case 'industry': exampleRow.push('Technology'); break;
        case 'size': exampleRow.push('51-200'); break;
        case 'amount': exampleRow.push('150000'); break;
        case 'currency': exampleRow.push('USD'); break;
        case 'closeDate': exampleRow.push('2026-03-15'); break;
        case 'probability': exampleRow.push('60'); break;
        case 'priority': exampleRow.push('high'); break;
        case 'lifecycleStage': exampleRow.push('qualified'); break;
        case 'contactType': exampleRow.push('buyer'); break;
        case 'tags': exampleRow.push('enterprise,priority'); break;
        default: exampleRow.push('');
      }
    });

    fieldDef.associations.forEach(f => {
      switch (f.key) {
        case 'companyName': exampleRow.push('Acme Corporation'); break;
        case 'companyDomain': exampleRow.push('acme.com'); break;
        case 'contactEmails': exampleRow.push('john@acme.com,jane@acme.com'); break;
        case 'pipelineName': exampleRow.push('Sales Pipeline'); break;
        case 'stageName': exampleRow.push('Proposal'); break;
        case 'ownerEmail': exampleRow.push('owner@yourcompany.com'); break;
        default: exampleRow.push('');
      }
    });

    // Empty values for custom fields in example
    customFields.forEach(() => exampleRow.push(''));

    // Create CSV content
    const csvContent = [
      headers.join(','),
      exampleRow.map(v => `"${v.replace(/"/g, '""')}"`).join(','),
    ].join('\n');

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${entityType}s-import-template.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('[CRM] Error generating import template:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// Get field definitions for import mapping UI
router.get('/import/fields/:entityType', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { entityType } = req.params;
    if (!['contact', 'company', 'deal'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get custom fields for this entity type
    const customFields = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, orgData.organization.id),
          eq(customFieldDefinitions.objectType, entityType)
        )
      )
      .orderBy(customFieldDefinitions.displayOrder);

    const fieldDef = IMPORT_FIELD_DEFINITIONS[entityType as keyof typeof IMPORT_FIELD_DEFINITIONS];

    res.json({
      standard: fieldDef.standard,
      associations: fieldDef.associations,
      custom: customFields.map(f => ({
        key: `custom_${f.name}`,
        label: f.label,
        fieldType: f.fieldType,
        required: f.isRequired,
      })),
    });
  } catch (error) {
    console.error('[CRM] Error fetching import fields:', error);
    res.status(500).json({ error: 'Failed to fetch import fields' });
  }
});

// Upload and parse import file
router.post('/import/upload', upload.single('file'), async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { entityType } = req.body;
    if (!['contact', 'company', 'deal'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check permission
    const userPerms = await getUserPermissions(req.user!.id);
    if (!userPerms?.permissions['settings.data_import.manage']) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Parse the file
    let data: any[][] = [];
    const fileExt = req.file.originalname.toLowerCase().split('.').pop();

    if (fileExt === 'csv') {
      // Parse CSV
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
      data = lines.map(line => {
        // Handle quoted CSV fields
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      // Parse Excel
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Use CSV or XLSX.' });
    }

    if (data.length < 2) {
      return res.status(400).json({ error: 'File must contain a header row and at least one data row' });
    }

    const headers = data[0].map((h: any) => String(h).trim());
    const rows = data.slice(1).filter(row => row.some((cell: any) => cell !== ''));

    // Get field definitions for auto-mapping
    const fieldDef = IMPORT_FIELD_DEFINITIONS[entityType as keyof typeof IMPORT_FIELD_DEFINITIONS];
    const allFields = [...fieldDef.standard, ...fieldDef.associations];

    // Get custom fields
    const customFields = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, orgData.organization.id),
          eq(customFieldDefinitions.objectType, entityType)
        )
      );

    // Auto-map headers to fields
    const suggestedMapping: Record<string, string> = {};
    headers.forEach((header: string, index: number) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Try to match standard/association fields
      for (const field of allFields) {
        const normalizedLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedKey = field.key.toLowerCase();
        if (normalizedHeader === normalizedLabel || normalizedHeader === normalizedKey) {
          suggestedMapping[header] = field.key;
          break;
        }
      }

      // Try to match custom fields
      if (!suggestedMapping[header]) {
        for (const cf of customFields) {
          const normalizedLabel = cf.label.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedKey = cf.name.toLowerCase();
          if (normalizedHeader === normalizedLabel || normalizedHeader === normalizedKey ||
              normalizedHeader === `custom${normalizedLabel}` || normalizedHeader === `custom${normalizedKey}`) {
            suggestedMapping[header] = `custom_${cf.name}`;
            break;
          }
        }
      }
    });

    // Sanitize filename for response
    const safeFileName = sanitizeFilename(req.file.originalname);

    // Return parsed data with preview
    res.json({
      fileName: safeFileName,
      fileSize: req.file.size,
      headers,
      totalRows: rows.length,
      preview: rows.slice(0, 5).map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((h: string, i: number) => {
          obj[h] = row[i] ?? '';
        });
        return obj;
      }),
      suggestedMapping,
      rawData: rows.map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((h: string, i: number) => {
          obj[h] = row[i] ?? '';
        });
        return obj;
      }),
    });
  } catch (error) {
    console.error('[CRM] Error parsing import file:', error);
    res.status(500).json({ error: 'Failed to parse file' });
  }
});

// Preview import with duplicate detection and association matching
router.post('/import/preview', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { entityType, data, mapping } = req.body;
    if (!['contact', 'company', 'deal'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    if (!Array.isArray(data) || !mapping) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check permission
    const userPerms = await getUserPermissions(req.user!.id);
    if (!userPerms?.permissions['settings.data_import.manage']) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Get existing records for duplicate detection
    let existingRecords: any[] = [];
    if (entityType === 'contact') {
      existingRecords = await db
        .select({ id: crmContacts.id, email: crmContacts.email, firstName: crmContacts.firstName, lastName: crmContacts.lastName })
        .from(crmContacts)
        .where(eq(crmContacts.organizationId, orgData.organization.id));
    } else if (entityType === 'company') {
      existingRecords = await db
        .select({ id: companies.id, name: companies.name, domain: companies.domain })
        .from(companies)
        .where(eq(companies.organizationId, orgData.organization.id));
    } else if (entityType === 'deal') {
      existingRecords = await db
        .select({
          id: deals.id,
          name: deals.name,
          companyId: deals.companyId
        })
        .from(deals)
        .where(and(
          eq(deals.organizationId, orgData.organization.id),
          isNull(deals.deletedAt)
        ));
    }

    // Get all companies for association matching
    const allCompanies = await db
      .select({ id: companies.id, name: companies.name, domain: companies.domain })
      .from(companies)
      .where(eq(companies.organizationId, orgData.organization.id));

    // Get all contacts for deal association matching
    const allContacts = entityType === 'deal' ? await db
      .select({ id: crmContacts.id, email: crmContacts.email })
      .from(crmContacts)
      .where(eq(crmContacts.organizationId, orgData.organization.id)) : [];

    // Get pipelines and stages for deal association
    const allPipelines = entityType === 'deal' ? await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.organizationId, orgData.organization.id)) : [];

    const pipelineIds = allPipelines.map(p => p.id);
    const allStages = entityType === 'deal' && pipelineIds.length > 0 ? await db
      .select()
      .from(pipelineStages)
      .where(inArray(pipelineStages.pipelineId, pipelineIds)) : [];

    // Get team members for owner matching
    const teamMembers = entityType === 'deal' ? await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        email: users.email
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgData.organization.id)) : [];

    // Process each row
    const preview = data.map((row: any, index: number) => {
      const mappedRow: Record<string, any> = {};
      const errors: string[] = [];
      let duplicateOf: any = null;
      const associations: Record<string, any> = {};

      // Apply mapping
      Object.entries(mapping).forEach(([csvCol, fieldKey]) => {
        if (fieldKey && row[csvCol] !== undefined) {
          mappedRow[fieldKey as string] = row[csvCol];
        }
      });

      // Validate required fields
      const fieldDef = IMPORT_FIELD_DEFINITIONS[entityType as keyof typeof IMPORT_FIELD_DEFINITIONS];
      fieldDef.standard.forEach(field => {
        if (field.required && !mappedRow[field.key]) {
          errors.push(`Missing required field: ${field.label}`);
        }
      });

      // Check for duplicates (exact + case-insensitive)
      if (entityType === 'contact' && mappedRow.email) {
        const normalizedEmail = mappedRow.email.toLowerCase().trim();
        const match = existingRecords.find(r => r.email?.toLowerCase() === normalizedEmail);
        if (match) {
          duplicateOf = { id: match.id, displayName: `${match.firstName || ''} ${match.lastName || ''} (${match.email})`.trim() };
        }
      } else if (entityType === 'company') {
        // Match by domain first, then by name
        if (mappedRow.domain) {
          const normalizedDomain = mappedRow.domain.toLowerCase().trim();
          const match = existingRecords.find(r => r.domain?.toLowerCase() === normalizedDomain);
          if (match) {
            duplicateOf = { id: match.id, displayName: match.name };
          }
        }
        if (!duplicateOf && mappedRow.name) {
          const normalizedName = mappedRow.name.toLowerCase().trim();
          const match = existingRecords.find(r => r.name?.toLowerCase() === normalizedName);
          if (match) {
            duplicateOf = { id: match.id, displayName: match.name };
          }
        }
      } else if (entityType === 'deal' && mappedRow.name) {
        // For deals: exact name match + same company = duplicate
        const normalizedName = mappedRow.name.toLowerCase().trim();
        // First resolve company association
        let companyId: number | null = null;
        if (mappedRow.companyDomain) {
          const company = allCompanies.find(c => c.domain?.toLowerCase() === mappedRow.companyDomain.toLowerCase());
          if (company) companyId = company.id;
        } else if (mappedRow.companyName) {
          const company = allCompanies.find(c => c.name?.toLowerCase() === mappedRow.companyName.toLowerCase());
          if (company) companyId = company.id;
        }

        const match = existingRecords.find(r =>
          r.name?.toLowerCase() === normalizedName &&
          (companyId === null || r.companyId === companyId)
        );
        if (match) {
          duplicateOf = { id: match.id, displayName: match.name };
        }
      }

      // Resolve associations
      if (entityType === 'contact' || entityType === 'deal') {
        // Company association
        if (mappedRow.companyDomain || mappedRow.companyName) {
          let matchedCompany = null;
          if (mappedRow.companyDomain) {
            matchedCompany = allCompanies.find(c => c.domain?.toLowerCase() === mappedRow.companyDomain.toLowerCase());
          }
          if (!matchedCompany && mappedRow.companyName) {
            matchedCompany = allCompanies.find(c => c.name?.toLowerCase() === mappedRow.companyName.toLowerCase());
          }

          associations.company = {
            inputValue: mappedRow.companyDomain || mappedRow.companyName,
            match: matchedCompany ? { id: matchedCompany.id, name: matchedCompany.name } : null,
            action: matchedCompany ? 'link' : 'create', // Default action
          };
        }
      }

      if (entityType === 'deal') {
        // Contact associations
        if (mappedRow.contactEmails) {
          const emails = mappedRow.contactEmails.split(',').map((e: string) => e.trim().toLowerCase());
          const contactMatches = emails.map((email: string) => {
            const match = allContacts.find(c => c.email?.toLowerCase() === email);
            return {
              email,
              match: match ? { id: match.id, email: match.email } : null,
            };
          });
          associations.contacts = contactMatches;
        }

        // Pipeline/Stage association
        if (mappedRow.pipelineName || mappedRow.stageName) {
          let matchedPipeline = allPipelines.find(p =>
            p.name?.toLowerCase() === (mappedRow.pipelineName || '').toLowerCase()
          ) || allPipelines[0]; // Default to first pipeline

          let matchedStage = null;
          if (matchedPipeline) {
            const pipelineStagesFiltered = allStages.filter(s => s.pipelineId === matchedPipeline!.id);
            matchedStage = pipelineStagesFiltered.find(s =>
              s.name?.toLowerCase() === (mappedRow.stageName || '').toLowerCase()
            ) || pipelineStagesFiltered[0]; // Default to first stage
          }

          associations.pipeline = {
            inputValue: mappedRow.pipelineName,
            match: matchedPipeline ? { id: matchedPipeline.id, name: matchedPipeline.name } : null,
          };
          associations.stage = {
            inputValue: mappedRow.stageName,
            match: matchedStage ? { id: matchedStage.id, name: matchedStage.name } : null,
          };
        }

        // Owner association
        if (mappedRow.ownerEmail) {
          const matchedMember = teamMembers.find(m =>
            m.email?.toLowerCase() === mappedRow.ownerEmail.toLowerCase()
          );
          associations.owner = {
            inputValue: mappedRow.ownerEmail,
            match: matchedMember ? { id: matchedMember.id, email: matchedMember.email } : null,
          };
        }
      }

      return {
        rowIndex: index,
        originalData: row,
        mappedData: mappedRow,
        errors,
        duplicateOf,
        associations,
        action: duplicateOf ? 'skip' : (errors.length > 0 ? 'error' : 'create'), // Default action
      };
    });

    // Summary statistics
    const summary = {
      total: preview.length,
      valid: preview.filter(r => r.errors.length === 0 && !r.duplicateOf).length,
      duplicates: preview.filter(r => r.duplicateOf).length,
      errors: preview.filter(r => r.errors.length > 0).length,
      newCompanies: entityType !== 'company' ?
        new Set(preview.filter(r => r.associations.company?.action === 'create').map(r => r.associations.company?.inputValue?.toLowerCase())).size : 0,
    };

    res.json({ preview, summary });
  } catch (error) {
    console.error('[CRM] Error generating import preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// Execute the import
router.post('/import/execute', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { entityType, rows, mapping, fileName, fileSize } = req.body;
    if (!['contact', 'company', 'deal'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to import' });
    }

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check permission
    const userPerms = await getUserPermissions(req.user!.id);
    if (!userPerms?.permissions['settings.data_import.manage']) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Get custom fields for this entity type
    const customFields = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, orgData.organization.id),
          eq(customFieldDefinitions.objectType, entityType)
        )
      );

    const customFieldMap = new Map(customFields.map(f => [f.name, f]));

    // Create import record
    const [importRecord] = await db
      .insert(crmImports)
      .values({
        organizationId: orgData.organization.id,
        entityType,
        fileName: fileName || 'import.csv',
        fileSize: fileSize || 0,
        totalRows: rows.length,
        status: 'processing',
        columnMapping: mapping || {},
        createdBy: req.user!.id,
      })
      .returning();

    // Track results
    let importedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Cache for created companies (to avoid creating duplicates within same import)
    const createdCompanies = new Map<string, number>();

    // Get default pipeline and stage for deals
    let defaultPipeline: any = null;
    let defaultStage: any = null;
    if (entityType === 'deal') {
      [defaultPipeline] = await db
        .select()
        .from(pipelines)
        .where(eq(pipelines.organizationId, orgData.organization.id))
        .limit(1);

      if (defaultPipeline) {
        [defaultStage] = await db
          .select()
          .from(pipelineStages)
          .where(eq(pipelineStages.pipelineId, defaultPipeline.id))
          .orderBy(pipelineStages.displayOrder)
          .limit(1);
      }
    }

    // Process each row
    for (const row of rows) {
      try {
        // Skip rows marked for skipping
        if (row.action === 'skip') {
          if (row.duplicateOf) {
            duplicateCount++;
          } else {
            skippedCount++;
          }
          continue;
        }

        // Skip rows with errors that aren't resolved
        if (row.action === 'error' || row.errors?.length > 0) {
          errorCount++;
          errors.push({ row: row.rowIndex, errors: row.errors });
          continue;
        }

        const mappedData = row.mappedData;
        const associations = row.associations || {};

        // Extract custom properties
        const customProperties: Record<string, any> = {};
        Object.entries(mappedData).forEach(([key, value]) => {
          if (key.startsWith('custom_')) {
            const fieldName = key.replace('custom_', '');
            if (customFieldMap.has(fieldName)) {
              customProperties[fieldName] = value;
            }
          }
        });

        if (entityType === 'company') {
          // Create company
          await db.insert(companies).values({
            organizationId: orgData.organization.id,
            name: mappedData.name,
            domain: mappedData.domain || null,
            website: mappedData.website || null,
            industry: mappedData.industry || null,
            size: mappedData.size || null,
            annualRevenue: mappedData.annualRevenue || null,
            phone: mappedData.phone || null,
            address: mappedData.address || null,
            city: mappedData.city || null,
            state: mappedData.state || null,
            country: mappedData.country || null,
            linkedinUrl: mappedData.linkedinUrl || null,
            description: mappedData.description || null,
            customProperties,
            ownerId: orgData.membership.id,
          });
          importedCount++;
        } else if (entityType === 'contact') {
          // Resolve company association
          let companyId: number | null = null;
          if (associations.company) {
            if (associations.company.action === 'link' && associations.company.match) {
              companyId = associations.company.match.id;
            } else if (associations.company.action === 'create' && associations.company.inputValue) {
              // Check cache first
              const cacheKey = associations.company.inputValue.toLowerCase();
              if (createdCompanies.has(cacheKey)) {
                companyId = createdCompanies.get(cacheKey)!;
              } else {
                // Create new company
                const [newCompany] = await db.insert(companies).values({
                  organizationId: orgData.organization.id,
                  name: associations.company.inputValue,
                  domain: mappedData.companyDomain || null,
                  ownerId: orgData.membership.id,
                }).returning();
                companyId = newCompany.id;
                createdCompanies.set(cacheKey, companyId);
              }
            }
          }

          // Parse tags
          let tags: string[] = [];
          if (mappedData.tags) {
            tags = mappedData.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
          }

          // Create contact
          await db.insert(crmContacts).values({
            organizationId: orgData.organization.id,
            email: mappedData.email,
            firstName: mappedData.firstName || null,
            lastName: mappedData.lastName || null,
            phone: mappedData.phone || null,
            title: mappedData.title || null,
            department: mappedData.department || null,
            companyId,
            lifecycleStage: mappedData.lifecycleStage || null,
            contactType: mappedData.contactType || null,
            linkedinUrl: mappedData.linkedinUrl || null,
            source: mappedData.source || 'import',
            notes: mappedData.notes || null,
            tags,
            customProperties,
            ownerId: orgData.membership.id,
          });
          importedCount++;
        } else if (entityType === 'deal') {
          // Resolve company association
          let companyId: number | null = null;
          if (associations.company) {
            if (associations.company.action === 'link' && associations.company.match) {
              companyId = associations.company.match.id;
            } else if (associations.company.action === 'create' && associations.company.inputValue) {
              const cacheKey = associations.company.inputValue.toLowerCase();
              if (createdCompanies.has(cacheKey)) {
                companyId = createdCompanies.get(cacheKey)!;
              } else {
                const [newCompany] = await db.insert(companies).values({
                  organizationId: orgData.organization.id,
                  name: associations.company.inputValue,
                  domain: mappedData.companyDomain || null,
                  ownerId: orgData.membership.id,
                }).returning();
                companyId = newCompany.id;
                createdCompanies.set(cacheKey, companyId);
              }
            }
          }

          // Resolve pipeline and stage
          const pipelineId = associations.pipeline?.match?.id || defaultPipeline?.id;
          const stageId = associations.stage?.match?.id || defaultStage?.id;

          if (!pipelineId || !stageId) {
            errorCount++;
            errors.push({ row: row.rowIndex, errors: ['No pipeline or stage available'] });
            continue;
          }

          // Resolve owner
          let ownerId = orgData.membership.id;
          if (associations.owner?.match) {
            ownerId = associations.owner.match.id;
          }

          // Parse amount
          let amount: number | null = null;
          if (mappedData.amount) {
            amount = parseFloat(String(mappedData.amount).replace(/[^0-9.-]/g, ''));
            if (isNaN(amount)) amount = null;
          }

          // Parse close date
          let closeDate: Date | null = null;
          if (mappedData.closeDate) {
            closeDate = new Date(mappedData.closeDate);
            if (isNaN(closeDate.getTime())) closeDate = null;
          }

          // Parse probability
          let probability: number | null = null;
          if (mappedData.probability) {
            probability = parseInt(mappedData.probability);
            if (isNaN(probability) || probability < 0 || probability > 100) probability = null;
          }

          // Create deal
          const [newDeal] = await db.insert(deals).values({
            organizationId: orgData.organization.id,
            name: mappedData.name,
            amount: amount !== null ? String(amount) : null,
            currency: mappedData.currency || 'USD',
            pipelineId,
            stageId,
            closeDate,
            probability,
            priority: ['low', 'normal', 'high'].includes(mappedData.priority) ? mappedData.priority : 'normal',
            source: mappedData.source || 'import',
            description: mappedData.description || null,
            companyId,
            ownerId,
            customProperties,
          }).returning();

          // Link contacts to deal
          if (associations.contacts) {
            for (const contactAssoc of associations.contacts) {
              if (contactAssoc.match) {
                await db.insert(dealContacts).values({
                  dealId: newDeal.id,
                  contactId: contactAssoc.match.id,
                });
              }
            }
          }

          importedCount++;
        }
      } catch (rowError: any) {
        console.error(`[CRM] Error importing row ${row.rowIndex}:`, rowError);
        errorCount++;
        errors.push({ row: row.rowIndex, errors: [rowError.message || 'Unknown error'] });
      }
    }

    // Update import record with results
    await db
      .update(crmImports)
      .set({
        status: 'completed',
        importedCount,
        skippedCount,
        duplicateCount,
        errorCount,
        errors,
        completedAt: new Date(),
      })
      .where(eq(crmImports.id, importRecord.id));

    res.json({
      success: true,
      importId: importRecord.id,
      summary: {
        total: rows.length,
        imported: importedCount,
        skipped: skippedCount,
        duplicates: duplicateCount,
        errors: errorCount,
      },
      errors: errors.slice(0, 50), // Return first 50 errors
    });
  } catch (error) {
    console.error('[CRM] Error executing import:', error);
    res.status(500).json({ error: 'Failed to execute import' });
  }
});

// Get import history
router.get('/import/history', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const imports = await db
      .select({
        id: crmImports.id,
        entityType: crmImports.entityType,
        fileName: crmImports.fileName,
        totalRows: crmImports.totalRows,
        importedCount: crmImports.importedCount,
        skippedCount: crmImports.skippedCount,
        duplicateCount: crmImports.duplicateCount,
        errorCount: crmImports.errorCount,
        status: crmImports.status,
        createdAt: crmImports.createdAt,
        completedAt: crmImports.completedAt,
        createdByName: users.name,
        createdByEmail: users.email,
      })
      .from(crmImports)
      .innerJoin(users, eq(crmImports.createdBy, users.id))
      .where(eq(crmImports.organizationId, orgData.organization.id))
      .orderBy(desc(crmImports.createdAt))
      .limit(50);

    res.json(imports);
  } catch (error) {
    console.error('[CRM] Error fetching import history:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

// Get import details (including errors)
router.get('/import/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const importId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [importRecord] = await db
      .select()
      .from(crmImports)
      .where(
        and(
          eq(crmImports.id, importId),
          eq(crmImports.organizationId, orgData.organization.id)
        )
      );

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    res.json(importRecord);
  } catch (error) {
    console.error('[CRM] Error fetching import details:', error);
    res.status(500).json({ error: 'Failed to fetch import details' });
  }
});

export default router;
