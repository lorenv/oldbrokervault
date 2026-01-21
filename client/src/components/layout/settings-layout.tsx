import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  User,
  Users,
  CreditCard,
  Bell,
  Palette,
  Sliders,
  FileCheck,
  Workflow,
  Building2,
  Shield,
  Key,
  Mail,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsNavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  description?: string;
}

interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
}

const settingsNavSections: SettingsNavSection[] = [
  {
    title: "Account",
    items: [
      { label: "Profile", icon: User, href: "/settings/profile", description: "Your personal information" },
      { label: "Billing & Subscription", icon: CreditCard, href: "/settings/billing", description: "Manage your plan" },
      { label: "Notifications", icon: Bell, href: "/settings/notifications", description: "Email & notification preferences" },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Members & Roles", icon: Users, href: "/settings/team", description: "Manage team members" },
      { label: "Permissions", icon: Shield, href: "/settings/permissions", description: "Role-based access control" },
    ],
  },
  {
    title: "CRM",
    items: [
      { label: "Pipelines & Stages", icon: Sliders, href: "/settings/pipelines", description: "Deal and buyer pipelines" },
      { label: "Custom Fields", icon: Building2, href: "/settings/custom-fields", description: "Custom properties for records" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { label: "Email", icon: Mail, href: "/settings/email", description: "Connect your email account" },
      { label: "Apps & Automations", icon: Workflow, href: "/settings/integrations", description: "Third-party integrations" },
    ],
  },
  {
    title: "Branding",
    items: [
      { label: "Brand Settings", icon: Palette, href: "/settings/branding", description: "Colors, logo, and styling" },
      { label: "NDA Templates", icon: FileCheck, href: "/settings/nda-templates", description: "Manage NDA templates" },
    ],
  },
];

interface SettingsLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function SettingsLayout({ children, title, description }: SettingsLayoutProps) {
  const [location] = useLocation();

  const isActive = (href: string) => {
    return location === href || location.startsWith(href + "/");
  };

  return (
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
            {settingsNavSections.map((section) => (
              <div key={section.title} className="mb-4">
                <h2 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </h2>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
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
                          <span>{item.label}</span>
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
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
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
  );
}

export default SettingsLayout;
