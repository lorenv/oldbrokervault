import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function DocumentExport({ analysis }: { analysis: any }) {
  const { toast } = useToast();

  const copyToClipboard = () => {
    const text = formatTextContent(analysis);
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The CIM content has been copied to your clipboard",
    });
  };

  const downloadHtml = () => {
    const html = generateHtml(analysis);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cim-document.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    // Note: In a production environment, this would typically
    // make a request to the server to generate a PDF
    toast({
      title: "PDF Generation",
      description: "PDF download will be available in the next update",
    });
  };

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={copyToClipboard}>
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={downloadHtml}>
            <Download className="h-4 w-4 mr-2" />
            Download HTML
          </DropdownMenuItem>
          <DropdownMenuItem onClick={downloadPdf}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function formatTextContent(analysis: any): string {
  return `
CONFIDENTIAL INFORMATION MEMORANDUM

Business Summary
${analysis.summary}

Business Details
${analysis.businessDetails?.yearStarted ? `Year Started: ${analysis.businessDetails.yearStarted}\n` : ''}
${analysis.businessDetails?.businessModel ? `Business Model: ${analysis.businessDetails.businessModel}\n` : ''}
${analysis.businessDetails?.structure ? `Structure: ${analysis.businessDetails.structure}\n` : ''}

Market Analysis
Competitors: ${analysis.marketAnalysis?.competitors?.join(', ') || 'N/A'}
Strengths: ${analysis.marketAnalysis?.strengths?.join(', ') || 'N/A'}
Unique Features: ${analysis.marketAnalysis?.uniqueFeatures?.join(', ') || 'N/A'}

Team Structure
${analysis.team?.employees?.map((emp: any) => 
  `${emp.role}
   Tenure: ${emp.tenure}
   Description: ${emp.description}
  `).join('\n\n') || 'N/A'}
`;
}

function generateHtml(analysis: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>CIM Document</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1, h2 { color: #333; }
    .section { margin-bottom: 30px; }
    .employee { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>CONFIDENTIAL INFORMATION MEMORANDUM</h1>
  
  <div class="section">
    <h2>Business Summary</h2>
    <p>${analysis.summary}</p>
  </div>

  <div class="section">
    <h2>Business Details</h2>
    ${analysis.businessDetails?.yearStarted ? `<p>Year Started: ${analysis.businessDetails.yearStarted}</p>` : ''}
    ${analysis.businessDetails?.businessModel ? `<p>Business Model: ${analysis.businessDetails.businessModel}</p>` : ''}
    ${analysis.businessDetails?.structure ? `<p>Structure: ${analysis.businessDetails.structure}</p>` : ''}
  </div>

  <div class="section">
    <h2>Market Analysis</h2>
    <p><strong>Competitors:</strong> ${analysis.marketAnalysis?.competitors?.join(', ') || 'N/A'}</p>
    <p><strong>Strengths:</strong> ${analysis.marketAnalysis?.strengths?.join(', ') || 'N/A'}</p>
    <p><strong>Unique Features:</strong> ${analysis.marketAnalysis?.uniqueFeatures?.join(', ') || 'N/A'}</p>
  </div>

  <div class="section">
    <h2>Team Structure</h2>
    ${analysis.team?.employees?.map((emp: any) => `
      <div class="employee">
        <h3>${emp.role}</h3>
        <p><strong>Tenure:</strong> ${emp.tenure}</p>
        <p>${emp.description}</p>
      </div>
    `).join('') || 'N/A'}
  </div>
</body>
</html>
`;
}
