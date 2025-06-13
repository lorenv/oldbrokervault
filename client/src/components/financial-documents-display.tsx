import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { useFinancialFiles } from "@/hooks/use-cim-document";

interface FinancialDocumentsDisplayProps {
  cimId: number;
}

export function FinancialDocumentsDisplay({ cimId }: FinancialDocumentsDisplayProps) {
  const { data: files = [], isLoading } = useFinancialFiles(cimId);

  if (isLoading) {
    return (
      <div className="mt-8 p-6 bg-slate-50 rounded-xl">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Financial Documents</h4>
        <p className="text-gray-500">Loading documents...</p>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="mt-8 p-6 bg-slate-50 rounded-xl">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Financial Documents</h4>
        <p className="text-gray-500">No financial documents available</p>
      </div>
    );
  }

  return (
    <div className="mt-8 p-4 md:p-6 bg-slate-50 rounded-xl">
      <h4 className="text-lg font-semibold text-gray-800 mb-4">Financial Documents</h4>
      <div className="space-y-3">
        {files
          .filter((file: any) => file.included !== false)
          .map((file: any) => (
            <Button
              key={file.id}
              variant="outline"
              className="flex items-center gap-2 md:gap-3 justify-start h-auto p-3 md:p-4 w-full"
              onClick={() => window.open(`/api/cim/${cimId}/financial-files/${file.id}/download`, '_blank')}
            >
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium truncate">{file.originalName}</div>
                <div className="text-sm text-gray-500">
                  {(file.fileSize / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
              <Download className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </Button>
          ))}
        
        {files.filter((file: any) => file.included !== false).length > 1 && (
          <Button
            variant="outline"
            className="flex items-center gap-3 justify-center h-auto p-4 w-full border-2 border-dashed"
            onClick={() => window.open(`/api/cim/${cimId}/financial-files/bulk-download`, '_blank')}
          >
            <Download className="h-5 w-5 text-green-600" />
            <div className="font-medium">Download All Documents</div>
          </Button>
        )}
      </div>
    </div>
  );
}