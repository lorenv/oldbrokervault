import { EnhancedMessageCenter } from "@/components/enhanced-message-center";
import { PageHeader } from "@/components/layout/page-header";
import { MessageCircle } from "lucide-react";

export default function Messages() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto px-6 py-6">
        <PageHeader
          title="Messages"
          description="Manage communications with CIM inquirers. Email replies sync automatically."
          icon={<MessageCircle className="h-5 w-5" />}
        />
        <EnhancedMessageCenter />
      </div>
    </div>
  );
}
