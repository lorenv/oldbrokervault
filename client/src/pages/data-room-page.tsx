import { Card, CardContent } from "@/components/ui/card";
import { FolderLock } from "lucide-react";

export default function DataRoomPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Data Room</h1>
        <p className="text-gray-600 mt-1">Secure document management and sharing</p>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderLock className="h-8 w-8 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Integration with{" "}
              <a
                href="https://vettingvault.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-700 underline"
              >
                VettingVault.com
              </a>{" "}
              coming soon
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
