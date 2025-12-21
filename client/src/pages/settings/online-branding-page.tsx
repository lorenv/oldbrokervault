import { useAuth } from "@/hooks/use-auth";
import { DocumentDefaultsSettings } from "@/components/document-defaults-settings";
import { PageHeader } from "@/components/layout/page-header";
import { Globe } from "lucide-react";

export default function OnlineBrandingPage() {
  const { user } = useAuth();

  return (
    <div className="p-6">
      <PageHeader
        title="Online CIM Branding"
        description="Customize the appearance of your online CIM share pages"
        icon={<Globe className="h-5 w-5" />}
      />

      <div className="max-w-4xl">
        <DocumentDefaultsSettings user={user} />
      </div>
    </div>
  );
}
