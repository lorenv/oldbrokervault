import { EnhancedMessageCenter } from "@/components/enhanced-message-center";
import { PageHeader } from "@/components/layout/page-header";
import { MessageCircle } from "lucide-react";

export default function Messages() {
  return (
    <div className="p-6">
      <PageHeader
        title="Messages"
        description="Manage all communications with CIM inquirers in one place. Email replies sync automatically."
        icon={<MessageCircle className="h-5 w-5" />}
      />
      <EnhancedMessageCenter />
    </div>
  );
}
