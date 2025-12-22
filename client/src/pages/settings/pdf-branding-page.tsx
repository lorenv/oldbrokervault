import { UnifiedPdfTemplateSelector } from "@/components/unified-pdf-template-selector";
import { PageHeader } from "@/components/layout/page-header";
import { FileImage } from "lucide-react";

export default function PdfBrandingPage() {
  return (
    <div className="px-4 md:px-6 py-4 md:py-6 overflow-x-hidden">
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
