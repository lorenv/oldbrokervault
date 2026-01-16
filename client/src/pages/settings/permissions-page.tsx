import { SettingsLayout } from "@/components/layout/settings-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Clock } from "lucide-react";

export default function PermissionsPage() {
  return (
    <SettingsLayout
      title="Permissions"
      description="Manage role-based access control and permissions"
    >
      <div className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Shield className="h-5 w-5 text-gray-500" />
              Role Permissions
            </CardTitle>
            <CardDescription>
              Configure granular permissions for different team roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Coming Soon
              </h3>
              <p className="text-gray-600 max-w-sm">
                Advanced permission management is currently in development.
                Check back soon to configure custom access controls for your team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
