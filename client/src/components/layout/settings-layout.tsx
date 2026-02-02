import { ReactNode, createContext, useContext } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { cn } from "@/lib/utils";
import {
  User,
  Users,
  Bell,
  Palette,
  Sliders,
  FileCheck,
  Workflow,
  Building2,
  Mail,
  ChevronLeft,
  Lock,
  Eye,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { PermissionKey } from "@shared/permissions";

// Settings access context for view-only mode
interface SettingsAccessContextType {
  canEdit: boolean;
  isViewOnly: boolean;
}

const SettingsAccessContext = createContext<SettingsAccessContextType>({
  canEdit: true,
  isViewOnly: false,
});

export function useSettingsAccess() {
  return useContext(SettingsAccessContext);
}

interface SettingsNavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  description?: string;
  // Permission required to see this item (null = always visible, e.g., profile)
  viewPermission?: PermissionKey | null;
  // Permission required to edit (if different from view)
  editPermission?: PermissionKey;
  // If true, this is a personal setting (always accessible)
  isPersonal?: boolean;
}

interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
}

const settingsNavSections: SettingsNavSection[] = [
  {
    title: "Personal",
    items: [
      {
        label: "Profile",
        icon: User,
        href: "/settings/profile",
        description: "Your personal information",
        isPersonal: true,
      },
      {
        label: "Notifications",
        icon: Bell,
        href: "/settings/notifications",
        description: "Email & notification preferences",
        isPersonal: true,
      },
    ],
  },
  {
    title: "Organization",
    items: [
      {
        label: "Manage Users",
        icon: Users,
        href: "/settings/manage-users",
        description: "Users, permissions & visibility",
        viewPermission: "settings.team.view",
        editPermission: "settings.team.manage",
      },
    ],
  },
  {
    title: "CRM",
    items: [
      {
        label: "Pipelines & Stages",
        icon: Sliders,
        href: "/settings/pipelines",
        description: "Deal and buyer pipelines",
        viewPermission: "settings.pipelines.edit",
        editPermission: "settings.pipelines.edit",
      },
      {
        label: "Custom Fields",
        icon: Building2,
        href: "/settings/custom-fields",
        description: "Custom properties for records",
        viewPermission: "settings.custom_fields.edit",
        editPermission: "settings.custom_fields.edit",
      },
      {
        label: "Data Management",
        icon: Upload,
        href: "/settings/data-management",
        description: "Import and deduplicate records",
        viewPermission: "settings.data_import.manage",
        editPermission: "settings.data_import.manage",
      },
    ],
  },
  {
    title: "Integrations",
    items: [
      {
        label: "Email Sync",
        icon: Mail,
        href: "/settings/email",
        description: "Connect your email account",
        viewPermission: "settings.integrations.manage",
        editPermission: "settings.integrations.manage",
      },
      {
        label: "Apps & Automations",
        icon: Workflow,
        href: "/settings/integrations",
        description: "Third-party integrations",
        viewPermission: "settings.integrations.manage",
        editPermission: "settings.integrations.manage",
      },
    ],
  },
  {
    title: "Branding",
    items: [
      {
        label: "Brand Settings",
        icon: Palette,
        href: "/settings/branding",
        description: "Colors, logo, and styling",
        viewPermission: "settings.branding.view",
        editPermission: "settings.branding.edit",
      },
      {
        label: "NDA Templates",
        icon: FileCheck,
        href: "/settings/nda-templates",
        description: "Manage NDA templates",
        viewPermission: "settings.branding.view",
        editPermission: "settings.branding.edit",
      },
    ],
  },
];

// Map routes to their required permissions
const routePermissions: Record<string, { view?: PermissionKey; edit?: PermissionKey; isPersonal?: boolean }> = {
  '/settings/profile': { isPersonal: true },
  '/settings/notifications': { isPersonal: true },
  '/settings/manage-users': { view: 'settings.team.view', edit: 'settings.team.manage' },
  // Legacy routes (redirect to manage-users)
  '/settings/team': { view: 'settings.team.view', edit: 'settings.team.manage' },
  '/settings/crm-visibility': { view: 'settings.team.view', edit: 'settings.team.manage' },
  '/settings/teams': { view: 'settings.team.view', edit: 'settings.team.manage' },
  '/settings/permissions': { view: 'settings.permissions.view', edit: 'settings.permissions.manage' },
  '/settings/billing': { view: 'settings.billing.view', edit: 'settings.billing.manage' },
  // Other settings
  '/settings/pipelines': { view: 'settings.pipelines.edit', edit: 'settings.pipelines.edit' },
  '/settings/custom-fields': { view: 'settings.custom_fields.edit', edit: 'settings.custom_fields.edit' },
  '/settings/data-management': { view: 'settings.data_import.manage', edit: 'settings.data_import.manage' },
  '/settings/email': { view: 'settings.integrations.manage', edit: 'settings.integrations.manage' },
  '/settings/integrations': { view: 'settings.integrations.manage', edit: 'settings.integrations.manage' },
  '/settings/branding': { view: 'settings.branding.view', edit: 'settings.branding.edit' },
  '/settings/nda-templates': { view: 'settings.branding.view', edit: 'settings.branding.edit' },
};

interface SettingsLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function SettingsLayout({ children, title, description }: SettingsLayoutProps) {
  const [location] = useLocation();
  const { hasPermission, isLoading, role, isOwner } = usePermissions();

  const isActive = (href: string) => {
    return location === href || location.startsWith(href + "/");
  };

  // Check if user can view a nav item
  const canViewItem = (item: SettingsNavItem): boolean => {
    if (item.isPersonal) return true;
    if (isOwner) return true;
    if (!item.viewPermission) return true;
    return hasPermission(item.viewPermission);
  };

  // Check if user can edit a nav item
  const canEditItem = (item: SettingsNavItem): boolean => {
    if (item.isPersonal) return true;
    if (isOwner) return true;
    if (!item.editPermission) return true;
    return hasPermission(item.editPermission);
  };

  // Filter sections based on permissions
  const filteredSections = settingsNavSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => canViewItem(item)),
    }))
    .filter(section => section.items.length > 0);

  // Check current route permissions
  const currentRouteConfig = routePermissions[location] || {};
  const canViewCurrentRoute = currentRouteConfig.isPersonal ||
    isOwner ||
    !currentRouteConfig.view ||
    hasPermission(currentRouteConfig.view);
  const canEditCurrentRoute = currentRouteConfig.isPersonal ||
    isOwner ||
    !currentRouteConfig.edit ||
    hasPermission(currentRouteConfig.edit);

  // If user doesn't have view permission for current route, redirect to profile
  if (!isLoading && !canViewCurrentRoute) {
    return <Redirect to="/settings/profile" />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)]">
        <aside className="w-64 border-r bg-gray-50/50 flex-shrink-0 hidden lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto p-4">
            <Skeleton className="h-8 w-24 mb-4" />
            <Skeleton className="h-6 w-32 mb-6" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </aside>
        <main className="flex-1 min-w-0 p-6 lg:p-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  return (
    <SettingsAccessContext.Provider value={{ canEdit: canEditCurrentRoute, isViewOnly: !canEditCurrentRoute }}>
      <div className="flex min-h-[calc(100vh-48px)]">
        {/* Secondary Sidebar */}
        <aside className="w-64 border-r bg-gray-50/50 flex-shrink-0 hidden lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto">
            {/* Back to app link */}
            <div className="p-4 border-b">
              <Button variant="ghost" size="sm" asChild className="gap-2 text-gray-600 hover:text-gray-900">
                <Link href="/dashboard">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Link>
              </Button>
              <h1 className="text-lg font-semibold text-gray-900 mt-3">Settings</h1>
            </div>

            {/* Navigation sections */}
            <nav className="p-2">
              {filteredSections.map((section) => (
                <div key={section.title} className="mb-4">
                  <h2 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {section.title}
                  </h2>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      const isViewOnly = !canEditItem(item);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                              active
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                            )}
                          >
                            <Icon className={cn("h-4 w-4", active ? "text-blue-600" : "text-gray-500")} />
                            <span className="flex-1">{item.label}</span>
                            {isViewOnly && (
                              <Eye className="h-3 w-3 text-gray-400" title="View only" />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* Page Header */}
          {title && (
            <div className="border-b bg-white px-6 py-4 lg:px-8">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                {!canEditCurrentRoute && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
                    <Eye className="h-3 w-3 mr-1" />
                    View Only
                  </Badge>
                )}
              </div>
              {description && (
                <p className="text-sm text-gray-500 mt-1">{description}</p>
              )}
            </div>
          )}

          {/* Page Content */}
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </SettingsAccessContext.Provider>
  );
}

export default SettingsLayout;
