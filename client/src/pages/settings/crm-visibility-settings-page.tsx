import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, Users, Building, Lock, Briefcase, User, Globe } from "lucide-react";
import { SettingsLayout, useSettingsAccess } from "@/components/layout/settings-layout";
import { Link } from "wouter";

type CrmVisibility = "owner_only" | "team" | "organization";

interface VisibilitySettings {
  deals: CrmVisibility;
  contacts: CrmVisibility;
  companies: CrmVisibility;
}

const visibilityOptions = [
  {
    value: "owner_only" as CrmVisibility,
    label: "Owner Only",
    description: "Users can only see records they own",
    icon: User,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    value: "team" as CrmVisibility,
    label: "Team",
    description: "Users can see records owned by anyone in their team(s)",
    icon: Users,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    value: "organization" as CrmVisibility,
    label: "Organization",
    description: "Everyone can see all records (current default)",
    icon: Globe,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
];

interface VisibilityCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  value: CrmVisibility;
  onChange: (value: CrmVisibility) => void;
  disabled?: boolean;
}

function VisibilityCard({
  title,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  value,
  onChange,
  disabled,
}: VisibilityCardProps) {
  return (
    <Card className={disabled ? "opacity-60" : ""}>
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as CrmVisibility)}
          disabled={disabled}
          className="space-y-3"
        >
          {visibilityOptions.map((option) => {
            const OptionIcon = option.icon;
            return (
              <div key={option.value} className="flex items-start space-x-3">
                <RadioGroupItem value={option.value} id={`${title}-${option.value}`} className="mt-1" />
                <Label
                  htmlFor={`${title}-${option.value}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded ${option.iconBg}`}>
                      <OptionIcon className={`h-3.5 w-3.5 ${option.iconColor}`} />
                    </div>
                    <span className="font-medium text-gray-900">{option.label}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 ml-7">{option.description}</p>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

export default function CrmVisibilitySettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = useSettingsAccess();

  const { data: settings, isLoading } = useQuery<VisibilitySettings>({
    queryKey: ["/api/crm/organization/visibility-settings"],
  });

  const { data: teams } = useQuery<any[]>({
    queryKey: ["/api/crm/teams"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<VisibilitySettings>) => {
      const response = await apiRequest("PATCH", "/api/crm/organization/visibility-settings", {
        body: data,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/organization/visibility-settings"] });
      toast({ title: "Settings updated", description: "Visibility settings have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleChange = (entity: keyof VisibilitySettings, value: CrmVisibility) => {
    updateMutation.mutate({ [entity]: value });
  };

  if (isLoading) {
    return (
      <SettingsLayout title="CRM Visibility" description="Control who can see CRM records">
        <div className="max-w-3xl space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </SettingsLayout>
    );
  }

  const hasTeams = teams && teams.length > 0;

  return (
    <SettingsLayout
      title="CRM Visibility"
      description="Control who can see CRM records based on ownership and team membership"
    >
      <div className="max-w-3xl space-y-6">
        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-blue-900">How Visibility Works</h3>
                <ul className="text-sm text-blue-800 mt-2 space-y-1">
                  <li>
                    <span className="font-medium">Owners & Admins</span> always see all records
                    regardless of visibility settings
                  </li>
                  <li>
                    <span className="font-medium">Deal Collaborators</span> can access specific deals
                    they've been added to
                  </li>
                  <li>
                    <span className="font-medium">Team visibility</span> requires users to be assigned
                    to teams
                  </li>
                </ul>
                {!hasTeams && (
                  <p className="text-sm text-blue-800 mt-3 border-t border-blue-200 pt-3">
                    <span className="font-medium">Tip:</span> To use Team visibility, first{" "}
                    <Link href="/settings/teams" className="underline font-medium">
                      create teams
                    </Link>{" "}
                    and add members.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {!canEdit && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-amber-600" />
                <p className="text-amber-800">
                  Only owners and admins can change visibility settings.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deals Visibility */}
        <VisibilityCard
          title="Deals"
          description="Control who can see deals in the CRM"
          icon={Briefcase}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          value={settings?.deals || "organization"}
          onChange={(value) => handleChange("deals", value)}
          disabled={!canEdit || updateMutation.isPending}
        />

        {/* Contacts Visibility */}
        <VisibilityCard
          title="Contacts"
          description="Control who can see contacts in the CRM"
          icon={Users}
          iconBg="bg-cyan-100"
          iconColor="text-cyan-600"
          value={settings?.contacts || "organization"}
          onChange={(value) => handleChange("contacts", value)}
          disabled={!canEdit || updateMutation.isPending}
        />

        {/* Companies Visibility */}
        <VisibilityCard
          title="Companies"
          description="Control who can see companies in the CRM"
          icon={Building}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          value={settings?.companies || "organization"}
          onChange={(value) => handleChange("companies", value)}
          disabled={!canEdit || updateMutation.isPending}
        />
      </div>
    </SettingsLayout>
  );
}
