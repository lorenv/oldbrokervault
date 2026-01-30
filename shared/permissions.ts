// Permission definitions for role-based access control

export const PERMISSION_CATEGORIES = {
  CRM: 'crm',
  DOCUMENTS: 'documents',
  ESIGN: 'esign',
  ANALYTICS: 'analytics',
  MESSAGES: 'messages',
  SDE_ANALYZER: 'sde_analyzer',
  SETTINGS: 'settings',
} as const;

export type PermissionCategory = typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES];

// All permission keys organized by category
export const PERMISSION_KEYS = {
  // CRM - Deals
  'crm.deals.view': { category: 'crm', label: 'View deals', group: 'Deals' },
  'crm.deals.create': { category: 'crm', label: 'Create deals', group: 'Deals' },
  'crm.deals.edit': { category: 'crm', label: 'Edit deals', group: 'Deals' },
  'crm.deals.delete': { category: 'crm', label: 'Delete deals', group: 'Deals' },

  // CRM - Contacts
  'crm.contacts.view': { category: 'crm', label: 'View contacts', group: 'Contacts' },
  'crm.contacts.create': { category: 'crm', label: 'Create contacts', group: 'Contacts' },
  'crm.contacts.edit': { category: 'crm', label: 'Edit contacts', group: 'Contacts' },
  'crm.contacts.delete': { category: 'crm', label: 'Delete contacts', group: 'Contacts' },

  // CRM - Companies
  'crm.companies.view': { category: 'crm', label: 'View companies', group: 'Companies' },
  'crm.companies.create': { category: 'crm', label: 'Create companies', group: 'Companies' },
  'crm.companies.edit': { category: 'crm', label: 'Edit companies', group: 'Companies' },
  'crm.companies.delete': { category: 'crm', label: 'Delete companies', group: 'Companies' },

  // CRM - Tasks
  'crm.tasks.view': { category: 'crm', label: 'View tasks', group: 'Tasks' },
  'crm.tasks.create': { category: 'crm', label: 'Create tasks', group: 'Tasks' },
  'crm.tasks.edit': { category: 'crm', label: 'Edit tasks', group: 'Tasks' },
  'crm.tasks.delete': { category: 'crm', label: 'Delete tasks', group: 'Tasks' },

  // Documents
  'documents.view': { category: 'documents', label: 'View documents', group: 'Documents' },
  'documents.create': { category: 'documents', label: 'Upload documents', group: 'Documents' },
  'documents.edit': { category: 'documents', label: 'Edit documents', group: 'Documents' },
  'documents.delete': { category: 'documents', label: 'Delete documents', group: 'Documents' },
  'documents.share': { category: 'documents', label: 'Share documents', group: 'Documents' },
  'documents.download': { category: 'documents', label: 'Download documents', group: 'Documents' },

  // E-Signatures
  'esign.view': { category: 'esign', label: 'View envelopes', group: 'Envelopes' },
  'esign.send': { category: 'esign', label: 'Send for signature', group: 'Envelopes' },
  'esign.templates.view': { category: 'esign', label: 'View templates', group: 'Templates' },
  'esign.templates.create': { category: 'esign', label: 'Create templates', group: 'Templates' },
  'esign.templates.edit': { category: 'esign', label: 'Edit templates', group: 'Templates' },
  'esign.templates.delete': { category: 'esign', label: 'Delete templates', group: 'Templates' },

  // Analytics
  'analytics.view': { category: 'analytics', label: 'View analytics', group: 'Analytics' },
  'analytics.export': { category: 'analytics', label: 'Export reports', group: 'Analytics' },

  // Messages
  'messages.view': { category: 'messages', label: 'View messages', group: 'Messages' },
  'messages.reply': { category: 'messages', label: 'Reply to messages', group: 'Messages' },

  // SDE Analyzer
  'sde_analyzer.view': { category: 'sde_analyzer', label: 'View SDE Analyzer', group: 'SDE Analyzer' },
  'sde_analyzer.analyze': { category: 'sde_analyzer', label: 'Run analysis', group: 'SDE Analyzer' },

  // Settings
  'settings.team.view': { category: 'settings', label: 'View team members', group: 'Team' },
  'settings.team.manage': { category: 'settings', label: 'Manage team members', group: 'Team' },
  'settings.permissions.view': { category: 'settings', label: 'View permissions', group: 'Team' },
  'settings.permissions.manage': { category: 'settings', label: 'Manage permissions', group: 'Team' },
  'settings.pipelines.edit': { category: 'settings', label: 'Edit pipelines', group: 'Configuration' },
  'settings.custom_fields.edit': { category: 'settings', label: 'Edit custom fields', group: 'Configuration' },
  'settings.billing.view': { category: 'settings', label: 'View billing', group: 'Billing' },
  'settings.billing.manage': { category: 'settings', label: 'Manage billing', group: 'Billing' },
  'settings.branding.view': { category: 'settings', label: 'View branding', group: 'Branding' },
  'settings.branding.edit': { category: 'settings', label: 'Edit branding', group: 'Branding' },
  'settings.integrations.manage': { category: 'settings', label: 'Manage integrations', group: 'Integrations' },
  'settings.data_import.manage': { category: 'settings', label: 'Import & dedupe data', group: 'Data Management' },
} as const;

export type PermissionKey = keyof typeof PERMISSION_KEYS;

// Roles that can be customized
export const CUSTOMIZABLE_ROLES = ['admin', 'member'] as const;
export type CustomizableRole = typeof CUSTOMIZABLE_ROLES[number];

// All roles including locked ones
export const ALL_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type Role = typeof ALL_ROLES[number];

// Default permissions for each role
// Owner: Full access (locked)
// Viewer: Read-only (locked)
// Admin/Member: Customizable defaults
export const DEFAULT_PERMISSIONS: Record<Role, Record<PermissionKey, boolean>> = {
  // Owner has full access to everything (cannot be modified)
  owner: Object.keys(PERMISSION_KEYS).reduce((acc, key) => {
    acc[key as PermissionKey] = true;
    return acc;
  }, {} as Record<PermissionKey, boolean>),

  // Admin defaults: Almost everything except billing.manage
  admin: {
    // CRM - Deals
    'crm.deals.view': true,
    'crm.deals.create': true,
    'crm.deals.edit': true,
    'crm.deals.delete': true,
    // CRM - Contacts
    'crm.contacts.view': true,
    'crm.contacts.create': true,
    'crm.contacts.edit': true,
    'crm.contacts.delete': true,
    // CRM - Companies
    'crm.companies.view': true,
    'crm.companies.create': true,
    'crm.companies.edit': true,
    'crm.companies.delete': true,
    // CRM - Tasks
    'crm.tasks.view': true,
    'crm.tasks.create': true,
    'crm.tasks.edit': true,
    'crm.tasks.delete': true,
    // Documents
    'documents.view': true,
    'documents.create': true,
    'documents.edit': true,
    'documents.delete': true,
    'documents.share': true,
    'documents.download': true,
    // E-Signatures
    'esign.view': true,
    'esign.send': true,
    'esign.templates.view': true,
    'esign.templates.create': true,
    'esign.templates.edit': true,
    'esign.templates.delete': true,
    // Analytics
    'analytics.view': true,
    'analytics.export': true,
    // Messages
    'messages.view': true,
    'messages.reply': true,
    // SDE Analyzer
    'sde_analyzer.view': true,
    'sde_analyzer.analyze': true,
    // Settings
    'settings.team.view': true,
    'settings.team.manage': true,
    'settings.permissions.view': true,
    'settings.permissions.manage': true,
    'settings.pipelines.edit': true,
    'settings.custom_fields.edit': true,
    'settings.billing.view': true,
    'settings.billing.manage': false, // Admins cannot manage billing by default
    'settings.branding.view': true,
    'settings.branding.edit': true,
    'settings.integrations.manage': true,
    'settings.data_import.manage': true,
  },

  // Member defaults: Can view/create/edit but not delete or manage
  member: {
    // CRM - Deals
    'crm.deals.view': true,
    'crm.deals.create': true,
    'crm.deals.edit': true,
    'crm.deals.delete': false,
    // CRM - Contacts
    'crm.contacts.view': true,
    'crm.contacts.create': true,
    'crm.contacts.edit': true,
    'crm.contacts.delete': false,
    // CRM - Companies
    'crm.companies.view': true,
    'crm.companies.create': true,
    'crm.companies.edit': true,
    'crm.companies.delete': false,
    // CRM - Tasks
    'crm.tasks.view': true,
    'crm.tasks.create': true,
    'crm.tasks.edit': true,
    'crm.tasks.delete': false,
    // Documents
    'documents.view': true,
    'documents.create': true,
    'documents.edit': true,
    'documents.delete': false,
    'documents.share': true,
    'documents.download': true,
    // E-Signatures
    'esign.view': true,
    'esign.send': true,
    'esign.templates.view': true,
    'esign.templates.create': true,
    'esign.templates.edit': true,
    'esign.templates.delete': false,
    // Analytics
    'analytics.view': true,
    'analytics.export': false,
    // Messages
    'messages.view': true,
    'messages.reply': true,
    // SDE Analyzer
    'sde_analyzer.view': true,
    'sde_analyzer.analyze': true,
    // Settings
    'settings.team.view': false,
    'settings.team.manage': false,
    'settings.permissions.view': false,
    'settings.permissions.manage': false,
    'settings.pipelines.edit': false,
    'settings.custom_fields.edit': false,
    'settings.billing.view': false,
    'settings.billing.manage': false,
    'settings.branding.view': true,
    'settings.branding.edit': false,
    'settings.integrations.manage': false,
    'settings.data_import.manage': false,
  },

  // Viewer has read-only access (cannot be modified)
  viewer: {
    // CRM - Deals
    'crm.deals.view': true,
    'crm.deals.create': false,
    'crm.deals.edit': false,
    'crm.deals.delete': false,
    // CRM - Contacts
    'crm.contacts.view': true,
    'crm.contacts.create': false,
    'crm.contacts.edit': false,
    'crm.contacts.delete': false,
    // CRM - Companies
    'crm.companies.view': true,
    'crm.companies.create': false,
    'crm.companies.edit': false,
    'crm.companies.delete': false,
    // CRM - Tasks
    'crm.tasks.view': true,
    'crm.tasks.create': false,
    'crm.tasks.edit': false,
    'crm.tasks.delete': false,
    // Documents
    'documents.view': true,
    'documents.create': false,
    'documents.edit': false,
    'documents.delete': false,
    'documents.share': false,
    'documents.download': true,
    // E-Signatures
    'esign.view': true,
    'esign.send': false,
    'esign.templates.view': true,
    'esign.templates.create': false,
    'esign.templates.edit': false,
    'esign.templates.delete': false,
    // Analytics
    'analytics.view': true,
    'analytics.export': false,
    // Messages
    'messages.view': true,
    'messages.reply': false,
    // SDE Analyzer
    'sde_analyzer.view': true,
    'sde_analyzer.analyze': false,
    // Settings
    'settings.team.view': false,
    'settings.team.manage': false,
    'settings.permissions.view': false,
    'settings.permissions.manage': false,
    'settings.pipelines.edit': false,
    'settings.custom_fields.edit': false,
    'settings.billing.view': false,
    'settings.billing.manage': false,
    'settings.branding.view': false,
    'settings.branding.edit': false,
    'settings.integrations.manage': false,
    'settings.data_import.manage': false,
  },
};

// Category display info
export const CATEGORY_INFO: Record<PermissionCategory, { label: string; description: string }> = {
  crm: { label: 'CRM', description: 'Deals, contacts, companies, and tasks' },
  documents: { label: 'Documents', description: 'Document management and sharing' },
  esign: { label: 'E-Signatures', description: 'Electronic signatures and templates' },
  analytics: { label: 'Analytics', description: 'Reports and data exports' },
  messages: { label: 'Messages', description: 'Communication and messaging' },
  sde_analyzer: { label: 'SDE Analyzer', description: 'Financial analysis tools' },
  settings: { label: 'Settings', description: 'Organization settings and configuration' },
};

// Helper to get permissions by category
export function getPermissionsByCategory(category: PermissionCategory): Array<{ key: PermissionKey; label: string; group: string }> {
  return Object.entries(PERMISSION_KEYS)
    .filter(([_, info]) => info.category === category)
    .map(([key, info]) => ({
      key: key as PermissionKey,
      label: info.label,
      group: info.group,
    }));
}

// Helper to check if a role is locked (owner/viewer)
export function isRoleLocked(role: Role): boolean {
  return role === 'owner' || role === 'viewer';
}

// Helper to check if a permission is customizable for a role
export function isPermissionCustomizable(role: Role): boolean {
  return CUSTOMIZABLE_ROLES.includes(role as CustomizableRole);
}
