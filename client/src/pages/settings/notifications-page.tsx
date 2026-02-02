import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bell, Mail, AtSign, CheckSquare, Clock, Handshake, Users, FileSignature, Calendar, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface NotificationPreferences {
  id: number;
  userId: number;
  // Email preferences
  emailMentions: boolean;
  emailTaskAssigned: boolean;
  emailTaskReminder: boolean;
  emailDealUpdates: boolean;
  emailTeamInvites: boolean;
  emailEsignRequests: boolean;
  emailEsignCompleted: boolean;
  emailWeeklyDigest: boolean;
  // In-app preferences
  inappMentions: boolean;
  inappTaskAssigned: boolean;
  inappTaskReminder: boolean;
  inappDealUpdates: boolean;
  inappEsignRequests: boolean;
  inappEsignCompleted: boolean;
}

interface NotificationRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

function NotificationRow({ title, description, checked, onChange, icon, disabled }: NotificationRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 text-gray-500">
            {icon}
          </div>
        )}
        <div>
          <p className="font-medium text-gray-900">{title}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notification preferences
  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/user/notification-preferences"],
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const response = await apiRequest("PUT", "/api/user/notification-preferences", { body: updates });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notification-preferences"] });
    },
    onError: () => {
      toast({
        title: "Failed to update preferences",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <SettingsLayout
        title="Notifications"
        description="Manage your email and notification preferences"
      >
        <div className="max-w-4xl flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </SettingsLayout>
    );
  }

  // Use defaults if preferences not loaded
  const prefs = preferences || {
    emailMentions: true,
    emailTaskAssigned: true,
    emailTaskReminder: true,
    emailDealUpdates: false,
    emailTeamInvites: true,
    emailEsignRequests: true,
    emailEsignCompleted: true,
    emailWeeklyDigest: false,
    inappMentions: true,
    inappTaskAssigned: true,
    inappTaskReminder: true,
    inappDealUpdates: true,
    inappEsignRequests: true,
    inappEsignCompleted: true,
  } as NotificationPreferences;

  return (
    <SettingsLayout
      title="Notifications"
      description="Manage your email and notification preferences"
    >
      <div className="max-w-4xl space-y-6">
        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Mail className="h-5 w-5 text-gray-500" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Choose which emails you receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Team & Collaboration Section */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 pb-2 border-b border-gray-100">
                Team & Collaboration
              </h4>
              <div className="divide-y divide-gray-100">
                <NotificationRow
                  title="@Mentions"
                  description="When someone mentions you in a note or comment"
                  icon={<AtSign className="h-4 w-4" />}
                  checked={prefs.emailMentions}
                  onChange={(checked) => handleToggle("emailMentions", checked)}
                  disabled={updateMutation.isPending}
                />
                <NotificationRow
                  title="Team Invitations"
                  description="When you're invited to join a team"
                  icon={<Users className="h-4 w-4" />}
                  checked={prefs.emailTeamInvites}
                  onChange={(checked) => handleToggle("emailTeamInvites", checked)}
                  disabled={updateMutation.isPending}
                />
                <NotificationRow
                  title="Task Assignments"
                  description="When a task is assigned to you"
                  icon={<CheckSquare className="h-4 w-4" />}
                  checked={prefs.emailTaskAssigned}
                  onChange={(checked) => handleToggle("emailTaskAssigned", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>

            {/* Deals & Pipeline Section */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 pb-2 border-b border-gray-100">
                Deals & Pipeline
              </h4>
              <div className="divide-y divide-gray-100">
                <NotificationRow
                  title="Deal Stage Changes"
                  description="When a deal you own changes stages"
                  icon={<Handshake className="h-4 w-4" />}
                  checked={prefs.emailDealUpdates}
                  onChange={(checked) => handleToggle("emailDealUpdates", checked)}
                  disabled={updateMutation.isPending}
                />
                <NotificationRow
                  title="Task Reminders"
                  description="Reminders for upcoming task due dates"
                  icon={<Clock className="h-4 w-4" />}
                  checked={prefs.emailTaskReminder}
                  onChange={(checked) => handleToggle("emailTaskReminder", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>

            {/* E-Signatures Section */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 pb-2 border-b border-gray-100">
                E-Signatures
              </h4>
              <div className="divide-y divide-gray-100">
                <NotificationRow
                  title="Signature Requests"
                  description="When you receive a document to sign"
                  icon={<FileSignature className="h-4 w-4" />}
                  checked={prefs.emailEsignRequests}
                  onChange={(checked) => handleToggle("emailEsignRequests", checked)}
                  disabled={updateMutation.isPending}
                />
                <NotificationRow
                  title="Document Completed"
                  description="When a document you sent is fully signed"
                  icon={<FileSignature className="h-4 w-4" />}
                  checked={prefs.emailEsignCompleted}
                  onChange={(checked) => handleToggle("emailEsignCompleted", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>

            {/* Digests Section */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 pb-2 border-b border-gray-100">
                Digests
              </h4>
              <div className="divide-y divide-gray-100">
                <NotificationRow
                  title="Weekly Activity Summary"
                  description="A weekly email summarizing your deals and tasks"
                  icon={<Calendar className="h-4 w-4" />}
                  checked={prefs.emailWeeklyDigest}
                  onChange={(checked) => handleToggle("emailWeeklyDigest", checked)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* In-App Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Bell className="h-5 w-5 text-gray-500" />
              In-App Notifications
            </CardTitle>
            <CardDescription>
              Control notification bell alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              <NotificationRow
                title="@Mentions"
                description="When someone mentions you in a note or comment"
                icon={<AtSign className="h-4 w-4" />}
                checked={prefs.inappMentions}
                onChange={(checked) => handleToggle("inappMentions", checked)}
                disabled={updateMutation.isPending}
              />
              <NotificationRow
                title="Task Assignments"
                description="When a task is assigned to you"
                icon={<CheckSquare className="h-4 w-4" />}
                checked={prefs.inappTaskAssigned}
                onChange={(checked) => handleToggle("inappTaskAssigned", checked)}
                disabled={updateMutation.isPending}
              />
              <NotificationRow
                title="Task Reminders"
                description="Reminders for upcoming task due dates"
                icon={<Clock className="h-4 w-4" />}
                checked={prefs.inappTaskReminder}
                onChange={(checked) => handleToggle("inappTaskReminder", checked)}
                disabled={updateMutation.isPending}
              />
              <NotificationRow
                title="Deal Updates"
                description="Updates on deals you own or follow"
                icon={<Handshake className="h-4 w-4" />}
                checked={prefs.inappDealUpdates}
                onChange={(checked) => handleToggle("inappDealUpdates", checked)}
                disabled={updateMutation.isPending}
              />
              <NotificationRow
                title="E-Signature Activity"
                description="Signature requests and completed documents"
                icon={<FileSignature className="h-4 w-4" />}
                checked={prefs.inappEsignRequests && prefs.inappEsignCompleted}
                onChange={(checked) => {
                  handleToggle("inappEsignRequests", checked);
                  handleToggle("inappEsignCompleted", checked);
                }}
                disabled={updateMutation.isPending}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
