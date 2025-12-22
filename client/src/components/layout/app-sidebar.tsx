import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
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
  Plus,
  FileText,
  Users,
  Signature,
  BarChart3,
  MessageCircle,
  LayoutList,
  WandSparkles,
  User,
  CreditCard,
  FileImage,
  Globe,
  FileCheck,
  Workflow,
  LogOut,
  HelpCircle,
  Shield,
  ChevronUp,
  PanelLeftClose,
  PanelLeft,
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

// Main navigation items (top section, no header)
const mainNavItems: NavItem[] = [
  { label: "Create CIM", icon: Plus, href: "/dashboard", matchPaths: ["/dashboard"] },
  { label: "My CIMs", icon: FileText, href: "/documents", matchPaths: ["/documents"] },
  { label: "CRM", icon: Users, href: "/investor-database", matchPaths: ["/investor-database"] },
  { label: "Sign", icon: Signature, href: "/esign", matchPaths: ["/esign"] },
];

// Secondary navigation items (after gap)
const secondaryNavItems: NavItem[] = [
  { label: "Analytics", icon: BarChart3, href: "/analytics", matchPaths: ["/analytics"] },
  { label: "Messages", icon: MessageCircle, href: "/messages", matchPaths: ["/messages"] },
  { label: "Listings", icon: LayoutList, href: "/listings-settings", matchPaths: ["/listings-settings"] },
  { label: "SDE Analyzer", icon: WandSparkles, href: "/sde-analyzer", badge: "Beta", matchPaths: ["/sde-analyzer"] },
];

// Settings navigation items (Billing badge is dynamic based on subscription)
const getSettingsNavItems = (showUpgradeBadge: boolean): NavItem[] => [
  { label: "Account", icon: User, href: "/settings/account", matchPaths: ["/settings/account"] },
  { label: "Billing", icon: CreditCard, href: "/settings/billing", matchPaths: ["/settings/billing"], badge: showUpgradeBadge ? "Upgrade" : undefined },
  { label: "PDF Branding", icon: FileImage, href: "/settings/pdf-branding", matchPaths: ["/settings/pdf-branding"] },
  { label: "Online CIM Branding", icon: Globe, href: "/settings/online-branding", matchPaths: ["/settings/online-branding"] },
  { label: "NDA Templates", icon: FileCheck, href: "/nda-templates", matchPaths: ["/nda-templates", "/template-editor"] },
  { label: "Integrations", icon: Workflow, href: "/integrations", matchPaths: ["/integrations"] },
];

export function AppSidebar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Check if user is on free tier (show upgrade badge on Billing)
  const isFreeTier = !user?.subscriptionStatus || user.subscriptionStatus === 'free';
  const settingsNavItems = getSettingsNavItems(isFreeTier);

  // Fetch profile data for profile picture
  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  // Check if a nav item is active
  const isActive = (item: NavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.some(path =>
        location === path || location.startsWith(path + "/")
      );
    }
    return location === item.href || location.startsWith(item.href + "/");
  };

  // Render a navigation item
  const renderNavItem = (item: NavItem) => {
    const active = isActive(item);
    const Icon = item.icon;

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.label}
        >
          <Link href={item.href}>
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
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
      <Sidebar collapsible="icon">
        {/* Logo Header - aligned with page header */}
        <Link href="/dashboard" className="block">
          <div
            className={`bg-white hover:bg-slate-50 transition-all flex items-center justify-center ${
              isCollapsed ? 'p-2 min-h-[52px]' : 'py-6 px-4 min-h-[80px]'
            }`}
            style={{
              borderBottom: `2px solid ${(profile as any)?.brandColors?.[0] || '#e2e8f0'}`
            }}
          >
            <img
              src={(profile as any)?.businessLogo || "/cim-share-logo.png"}
              alt={(profile as any)?.businessName || "CIM Share"}
              className={`object-contain transition-all ${
                isCollapsed ? 'h-6 max-w-[40px]' : 'h-12 max-w-[180px]'
              }`}
            />
          </div>
        </Link>

        <SidebarContent>
          {/* Main Navigation */}
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

          {/* Settings Section */}
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsNavItems.map(renderNavItem)}
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
                  className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
                >
                  {isCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                  <span>{isCollapsed ? "Expand" : "Collapse"}</span>
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
                        <Link href="/admin" className="flex items-center cursor-pointer w-full">
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
