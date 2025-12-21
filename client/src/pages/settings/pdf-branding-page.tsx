import { UnifiedPdfTemplateSelector } from "@/components/unified-pdf-template-selector";
import { PageHeader } from "@/components/layout/page-header";
import { FileImage } from "lucide-react";

export default function PdfBrandingPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="PDF Branding"
        description="Customize the appearance of your exported PDF documents"
        icon={<FileImage className="h-5 w-5" />}
      />

      <div className="max-w-4xl">
        <UnifiedPdfTemplateSelector />
      </div>
    </div>
  );
}
