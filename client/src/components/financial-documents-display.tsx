import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { useFinancialFiles } from "@/hooks/use-cim-document";
import { useQuery } from "@tanstack/react-query";

interface FinancialDocumentsDisplayProps {
  cimId: number;
  shareSlug?: string; // If provided, use share endpoints instead of authenticated endpoints
}

export function FinancialDocumentsDisplay({ cimId, shareSlug }: FinancialDocumentsDisplayProps) {
  // Use different endpoint depending on context
  const { data: files = [], isLoading } = shareSlug 
    ? useQuery({
        queryKey: [`/api/share/${shareSlug}/financial-files`],
        queryFn: async () => {
          const response = await fetch(`/api/share/${shareSlug}/financial-files`);
          if (!response.ok) throw new Error('Failed to fetch financial files');
          return response.json();
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
      })
    : useFinancialFiles(cimId);

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
          .filter((file: any) => {
            console.log('Financial file filter check:', file.filename, 'included:', file.included, 'passes filter:', file.included !== false);
            return file.included !== false;
          })
          .map((file: any) => (
            <Button
              key={file.id}
              variant="outline"
              className="flex items-center gap-2 md:gap-3 justify-start h-auto p-3 md:p-4 w-full"
              onClick={() => window.open(
                shareSlug 
                  ? `/api/share/${shareSlug}/financial-files/${file.id}/download`
                  : `/api/cim/${cimId}/financial-files/${file.id}/download`, 
                '_blank'
              )}
            >
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium truncate">{file.filename}</div>
                <div className="text-sm text-gray-500">
                  {file.fileSize >= 1024 * 1024 ? 
                    `${(file.fileSize / 1024 / 1024).toFixed(2)} MB` : 
                    `${(file.fileSize / 1024).toFixed(1)} KB`}
                </div>
              </div>
              <Download className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </Button>
          ))}
        
        {files.filter((file: any) => file.included !== false).length > 1 && (
          <Button
            variant="outline"
            className="flex items-center gap-3 justify-center h-auto p-4 w-full border-2 border-dashed"
            onClick={() => window.open(
              shareSlug 
                ? `/api/share/${shareSlug}/financial-files/bulk-download`
                : `/api/cim/${cimId}/financial-files/bulk-download`, 
              '_blank'
            )}
          >
            <Download className="h-5 w-5 text-green-600" />
            <div className="font-medium">Download All Documents</div>
          </Button>
        )}
      </div>
    </div>
  );
}