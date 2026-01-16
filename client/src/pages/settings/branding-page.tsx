import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { UnifiedPdfTemplateSelector } from "@/components/unified-pdf-template-selector";
import { DocumentDefaultsSettings } from "@/components/document-defaults-settings";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileImage, Globe } from "lucide-react";

export default function BrandingPage() {
  const { user } = useAuth();

  // Get active tab from URL hash
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    if (['pdf', 'online'].includes(hash)) return hash;
    return 'pdf';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  return (
    <SettingsLayout
      title="Branding"
      description="Customize the appearance of your CIM documents"
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          window.history.replaceState({}, '', `/settings/branding#${v}`);
        }}
        className="max-w-4xl"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="pdf" className="gap-2">
            <FileImage className="h-4 w-4" />
            PDF Export
          </TabsTrigger>
          <TabsTrigger value="online" className="gap-2">
            <Globe className="h-4 w-4" />
            Online CIM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdf">
          <UnifiedPdfTemplateSelector />
        </TabsContent>

        <TabsContent value="online">
          <DocumentDefaultsSettings user={user} />
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  );
}
