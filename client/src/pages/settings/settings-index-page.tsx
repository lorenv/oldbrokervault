import { Link } from "wouter";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { Card, CardContent } from "@/components/ui/card";
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
  ChevronRight,
  Eye,
  UsersRound,
} from "lucide-react";

interface SettingsCard {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  iconBg: string;
  iconColor: string;
}

const settingsCards: SettingsCard[] = [
  {
    title: "Profile",
    description: "Manage your personal information and preferences",
    icon: User,
    href: "/settings/profile",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    title: "Billing & Subscription",
    description: "View your plan, billing history, and payment methods",
    icon: CreditCard,
    href: "/settings/billing",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    title: "Team Members",
    description: "Invite team members and manage roles",
    icon: Users,
    href: "/settings/team",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    title: "Visibility Teams",
    description: "Create teams for CRM visibility groupings",
    icon: UsersRound,
    href: "/settings/teams",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
  },
  {
    title: "CRM Visibility",
    description: "Control who can see deals, contacts, and companies",
    icon: Eye,
    href: "/settings/crm-visibility",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
  },
  {
    title: "Pipelines & Stages",
    description: "Configure deal and buyer pipeline stages",
    icon: Sliders,
    href: "/settings/pipelines",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    title: "Custom Fields",
    description: "Create custom properties for deals, contacts, and companies",
    icon: Building2,
    href: "/settings/custom-fields",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-600",
  },
  {
    title: "Branding",
    description: "Customize your brand colors, logo, and PDF styling",
    icon: Palette,
    href: "/settings/branding",
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
  },
  {
    title: "Apps & Automations",
    description: "Connect third-party apps and services",
    icon: Workflow,
    href: "/settings/integrations",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
  {
    title: "NDA Templates",
    description: "Create and manage NDA templates",
    icon: FileCheck,
    href: "/settings/nda-templates",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    title: "Notifications",
    description: "Configure email and notification preferences",
    icon: Bell,
    href: "/settings/notifications",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
  },
];

export function SettingsIndexPage() {
  return (
    <SettingsLayout
      title="Settings"
      description="Manage your account, team, and application preferences"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {settingsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer group h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg ${card.iconBg}`}>
                      <Icon className={`h-5 w-5 ${card.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {card.title}
                        </h3>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </SettingsLayout>
  );
}

export default SettingsIndexPage;
