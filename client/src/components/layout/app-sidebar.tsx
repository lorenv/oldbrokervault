import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Users,
  Signature,
  BarChart3,
  MessageCircle,
  LayoutList,
  WandSparkles,
  User,
  LogOut,
  HelpCircle,
  Shield,
  ChevronUp,
  PanelLeftClose,
  PanelLeft,
  Kanban,
  Building2,
  Contact,
  Settings,
  CheckSquare,
  LayoutDashboard,
  FolderLock,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SupportDialog } from "@/components/ui/support-dialog";

// Navigation item type
interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
  matchPaths?: string[];
}

// Main navigation items (top section - CRM)
const mainNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", matchPaths: ["/dashboard"] },
  { label: "Deals", icon: Kanban, href: "/deals", matchPaths: ["/deals"] },
  { label: "Buyers", icon: Users, href: "/buyers", matchPaths: ["/buyers"] },
  { label: "Sellers", icon: Contact, href: "/sellers", matchPaths: ["/sellers"] },
  { label: "Companies", icon: Building2, href: "/companies", matchPaths: ["/companies"] },
  { label: "Tasks", icon: CheckSquare, href: "/tasks", matchPaths: ["/tasks"] },
];

// Secondary navigation items (after gap - tools & documents)
const secondaryNavItems: NavItem[] = [
  { label: "AI CIMs", icon: FileText, href: "/documents", matchPaths: ["/documents"] },
  { label: "E-Signatures", icon: Signature, href: "/esign", matchPaths: ["/esign"] },
  { label: "NDAs", icon: Shield, href: "/ndas", matchPaths: ["/ndas"] },
  { label: "Data Room", icon: FolderLock, href: "/data-room", matchPaths: ["/data-room"] },
  { label: "Analytics", icon: BarChart3, href: "/analytics", matchPaths: ["/analytics"] },
  { label: "Messages", icon: MessageCircle, href: "/messages", matchPaths: ["/messages"] },
  { label: "Listings Page", icon: LayoutList, href: "/listings-settings", matchPaths: ["/listings-settings"] },
  { label: "SDE Analyzer", icon: WandSparkles, href: "/sde-analyzer", badge: "Beta", matchPaths: ["/sde-analyzer"] },
];


export function AppSidebar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Fetch profile data for profile picture
  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  // Fetch pending approvals count for Analytics badge
  const { data: pendingApprovalsData } = useQuery({
    queryKey: ["/api/analytics/pending-approvals"],
    enabled: !!user,
    staleTime: 1000 * 60 * 1, // 1 minute
  });

  const pendingApprovalsCount = Array.isArray(pendingApprovalsData) ? pendingApprovalsData.length : 0;

  // Fetch overdue/pending task count for Tasks badge
  const { data: taskCountData } = useQuery<{ overdueCount: number; pendingCount: number }>({
    queryKey: ["/api/crm/tasks/counts"],
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const overdueTaskCount = taskCountData?.overdueCount || 0;

  // Check if a nav item is active
  const isActive = (item: NavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.some(path =>
        location === path || location.startsWith(path + "/")
      );
    }
    return location === item.href || location.startsWith(item.href + "/");
  };

  // Check if we're on a settings page
  const isSettingsActive = location.startsWith('/settings');

  // Get sidebar context
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Close mobile drawer when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Get brand color from profile, fallback to primary blue if not set
  const brandColor = (profile as any)?.pdfPrimaryColor || (profile as any)?.brandColors?.[0] || '#3b82f6';

  // Render a navigation item
  const renderNavItem = (item: NavItem) => {
    const active = isActive(item);
    const Icon = item.icon;

    // Special handling for Analytics badge with pending approvals count
    const isAnalytics = item.label === "Analytics";
    const isNDAs = item.label === "NDAs";
    const showPendingBadge = (isAnalytics || isNDAs) && pendingApprovalsCount > 0;

    // Special handling for Tasks badge with overdue count
    const isTasks = item.label === "Tasks";
    const showTaskBadge = isTasks && overdueTaskCount > 0;

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.label}
          className={active && brandColor ? "!bg-opacity-20" : ""}
          style={active && brandColor ? {
            backgroundColor: `${brandColor}25`,
            borderLeft: `3px solid ${brandColor}`,
            marginLeft: '-3px',
            paddingLeft: 'calc(0.5rem + 3px)',
          } : undefined}
        >
          <Link href={item.href} onClick={handleNavClick}>
            <Icon className="h-4 w-4" style={active && brandColor ? { color: brandColor } : undefined} />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
        {/* Overdue tasks badge for Tasks */}
        {showTaskBadge && !isCollapsed && (
          <SidebarMenuBadge
            className="text-[10px] px-1.5 rounded-full bg-red-500 text-white"
            title={`${overdueTaskCount} overdue task${overdueTaskCount !== 1 ? 's' : ''}`}
          >
            {overdueTaskCount}
          </SidebarMenuBadge>
        )}
        {/* Pending approvals badge for Analytics */}
        {showPendingBadge && !isCollapsed && (
          <SidebarMenuBadge
            className="text-[10px] px-1.5 rounded-full bg-slate-500/70 text-white/90"
            title={`${pendingApprovalsCount} pending NDA approval${pendingApprovalsCount !== 1 ? 's' : ''}`}
          >
            {pendingApprovalsCount}
          </SidebarMenuBadge>
        )}
        {/* Regular badges (Beta, Upgrade, etc.) */}
        {item.badge && !isCollapsed && (
          <SidebarMenuBadge
            className={`text-[10px] px-1.5 rounded-full ${
              item.badge === "Upgrade"
                ? "bg-amber-500 text-white"
                : item.badge === "Beta"
                ? "bg-slate-500/60 text-white/90 font-normal"
                : "bg-blue-500 text-white"
            }`}
          >
            {item.badge}
          </SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <Sidebar
        collapsible="icon"
        style={{
          top: '4rem',
          height: 'calc(100vh - 4rem)',
        }}
      >
        <SidebarContent>
          {/* Main Navigation - Deal-centric */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Visual Separator / Gap */}
          <SidebarSeparator className="my-2 bg-sidebar-border/50" />

          {/* Secondary Navigation */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {secondaryNavItems.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Settings Link */}
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Settings"
                    isActive={isSettingsActive}
                    className={isSettingsActive && brandColor ? "!bg-opacity-20" : ""}
                    style={isSettingsActive && brandColor ? {
                      backgroundColor: `${brandColor}25`,
                      borderLeft: `3px solid ${brandColor}`,
                      marginLeft: '-3px',
                      paddingLeft: 'calc(0.5rem + 3px)',
                    } : undefined}
                  >
                    <Link href="/settings" onClick={handleNavClick}>
                      <Settings className="h-4 w-4" style={isSettingsActive && brandColor ? { color: brandColor } : undefined} />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* User Profile Footer */}
        <SidebarFooter className="border-t border-sidebar-border/50">
          <SidebarMenu>
            {/* Collapse Toggle - only on desktop */}
            {!isMobile && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={toggleSidebar}
                  tooltip={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  className="text-sidebar-foreground/70 hover:text-sidebar-foreground group/collapse"
                >
                  {isCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                  <span className="opacity-0 group-hover/collapse:opacity-100 transition-opacity duration-200">
                    {isCollapsed ? "Expand" : "Collapse"}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    {(profile as any)?.profilePhoto ? (
                      <img
                        src={(profile as any).profilePhoto}
                        alt="Profile"
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {(profile as any)?.name || user?.email?.split("@")[0] || "User"}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/60">
                        {user?.email}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  {user?.isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin" onClick={handleNavClick} className="flex items-center cursor-pointer w-full">
                          <Shield className="h-4 w-4 mr-2" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setIsSupportOpen(true)}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Support
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SupportDialog open={isSupportOpen} onOpenChange={setIsSupportOpen} />
    </>
  );
}

export default AppSidebar;
