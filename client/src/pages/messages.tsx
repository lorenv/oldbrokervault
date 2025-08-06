import { EnhancedMessageCenter } from "@/components/enhanced-message-center";

export default function Messages() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Message Center</h1>
          <p className="text-gray-600 mt-1">
            Manage all communications with CIM inquirers in one place. Email replies sync automatically.
          </p>
        </div>
        <EnhancedMessageCenter />
      </div>
    </div>
  );
}