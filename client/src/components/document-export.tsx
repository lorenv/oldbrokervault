import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Download, FileText, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function DocumentExport({ analysis, docId, user }: { analysis: any; docId: number; user: any }) {
  const { toast } = useToast();

  const copyToClipboard = () => {
    const text = formatTextContent(analysis);
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The CIM content has been copied to your clipboard",
    });
  };

  const downloadWord = async () => {
    try {
      const response = await fetch(`/api/cim/export/word/${docId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to generate Word document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cim-${docId}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export to Word",
        variant: "destructive"
      });
    }
  };

  const downloadPdf = async () => {
    try {
      const response = await fetch(`/api/cim/export/pdf/${docId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cim-${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export to PDF",
        variant: "destructive"
      });
    }
  };

  const exportToGoogleDocs = async () => {
    try {
      const response = await fetch(`/api/cim/export/gdocs/${docId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.needsAuth) {
          // Redirect to Google OAuth flow
          const authResponse = await fetch('/api/auth/google');
          const { url } = await authResponse.json();
          window.location.href = url;
          return;
        }
        throw new Error(error.error || 'Failed to export to Google Docs');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export to Google Docs",
        variant: "destructive"
      });
    }
  };

  const canAccessPremiumFeatures = user?.isAdmin || user?.subscriptionStatus === "premium";

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
          {canAccessPremiumFeatures && (
            <>
              <DropdownMenuItem onClick={downloadWord}>
                <File className="h-4 w-4 mr-2" />
                Export to Word
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadPdf}>
                <FileText className="h-4 w-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToGoogleDocs}>
                <Download className="h-4 w-4 mr-2" />
                Export to Google Docs
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function formatTextContent(analysis: any): string {
  return `
CONFIDENTIAL INFORMATION MEMORANDUM

BUSINESS OVERVIEW
================
Background
----------
Founded: ${analysis.story.yearStarted}
Structure: ${analysis.story.businessStructure}

Business Description
------------------
${analysis.story.businessModel}

Growth History
-------------
${analysis.story.growthHistory}

INVESTMENT HIGHLIGHTS
===================
Key Attractions
--------------
${analysis.executiveSummary.buyerAttractions.map((item: string) => `• ${item}`).join('\n')}

Growth Opportunities
------------------
${analysis.executiveSummary.growthOpportunities.map((item: string) => `• ${item}`).join('\n')}

MARKET POSITION
=============
Target Market
------------
${analysis.marketAnalysis.customerProfile}

Competitive Landscape
-------------------
Competitors:
${analysis.marketAnalysis.competitors.map((item: string) => `• ${item}`).join('\n')}

Business Strengths:
${analysis.marketAnalysis.strengths.map((item: string) => `• ${item}`).join('\n')}
`.trim();
}

function generateHtml(analysis: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>CIM Document</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 1000px;
      margin: 40px auto;
      padding: 0 20px;
      color: #333;
    }
    h1 { 
      font-size: 28px;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-top: 40px;
    }
    h2 {
      font-size: 22px;
      color: #444;
      margin-top: 30px;
    }
    .section {
      margin-bottom: 40px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      border: 1px solid #ddd;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .info-card {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
    }
    ul {
      margin: 0;
      padding-left: 20px;
    }
    .employee {
      background: #f5f5f5;
      padding: 15px;
      margin: 10px 0;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <h1>CONFIDENTIAL INFORMATION MEMORANDUM</h1>

  <section class="section">
    <h1>BUSINESS OVERVIEW</h1>
    <h2>Background</h2>
    <div class="info-grid">
      <div class="info-card">
        <strong>Founded:</strong> ${analysis.story.yearStarted}
      </div>
      <div class="info-card">
        <strong>Structure:</strong> ${analysis.story.businessStructure}
      </div>
    </div>

    <h2>Business Description</h2>
    <p>${analysis.story.businessModel}</p>

    <h2>Growth History</h2>
    <p>${analysis.story.growthHistory}</p>
  </section>

  <section class="section">
    <h1>INVESTMENT HIGHLIGHTS</h1>
    <h2>Key Attractions</h2>
    <ul>
      ${analysis.executiveSummary.buyerAttractions.map((item: string) => `<li>${item}</li>`).join('')}
    </ul>

    <h2>Growth Opportunities</h2>
    <ul>
      ${analysis.executiveSummary.growthOpportunities.map((item: string) => `<li>${item}</li>`).join('')}
    </ul>
  </section>

  <section class="section">
    <h1>MARKET POSITION</h1>
    <h2>Target Market</h2>
    <p>${analysis.marketAnalysis.customerProfile}</p>

    <h2>Competitive Landscape</h2>
    <div class="info-grid">
      <div class="info-card">
        <h3>Competitors</h3>
        <ul>
          ${analysis.marketAnalysis.competitors.map((item: string) => `<li>${item}</li>`).join('')}
        </ul>
      </div>
      <div class="info-card">
        <h3>Business Strengths</h3>
        <ul>
          ${analysis.marketAnalysis.strengths.map((item: string) => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    </div>
  </section>

  <section class="section">
    <h1>OPERATIONS</h1>
    <h2>Customer Relationships</h2>
    <table>
      <tr>
        <th>Aspect</th>
        <th>Details</th>
      </tr>
      <tr>
        <td>Recurring Revenue</td>
        <td>${analysis.operations.customers.recurring}</td>
      </tr>
      <tr>
        <td>Customer Base</td>
        <td>${analysis.operations.customers.relationships}</td>
      </tr>
      <tr>
        <td>Revenue Concentration</td>
        <td>${analysis.operations.customers.concentration}</td>
      </tr>
      <tr>
        <td>Contract Terms</td>
        <td>${analysis.operations.customers.contracts}</td>
      </tr>
    </table>

    <h2>Supply Chain</h2>
    <table>
      <tr>
        <th>Aspect</th>
        <th>Details</th>
      </tr>
      <tr>
        <td>Number of Suppliers</td>
        <td>${analysis.operations.suppliers.count}</td>
      </tr>
      <tr>
        <td>Supplier Terms</td>
        <td>${analysis.operations.suppliers.terms}</td>
      </tr>
      <tr>
        <td>Concentration</td>
        <td>${analysis.operations.suppliers.concentration}</td>
      </tr>
      <tr>
        <td>Relationship Transfer</td>
        <td>${analysis.operations.suppliers.transferability}</td>
      </tr>
    </table>
  </section>

  <section class="section">
    <h1>TEAM STRUCTURE</h1>
    <h2>Ownership & Management</h2>
    <div class="info-card">
      <p><strong>Owner's Role:</strong> ${analysis.team.ownerResponsibilities}</p>
      <p><strong>Required Hours:</strong> ${analysis.team.ownerHours}</p>
      <p><strong>Management Structure:</strong> ${analysis.team.management}</p>
    </div>

    <h2>Employee Overview</h2>
    <table>
      <tr>
        <th>Role</th>
        <th>Status</th>
        <th>Compensation</th>
      </tr>
      ${analysis.team.employees.map((emp: any) => `
        <tr>
          <td>${emp.role}</td>
          <td>${emp.status}</td>
          <td>${emp.compensation}</td>
        </tr>
      `).join('')}
    </table>

    <h2>Team Stability</h2>
    <div class="info-card">
      <p><strong>Turnover Rate:</strong> ${analysis.team.turnover}</p>
      <p><strong>Hiring Environment:</strong> ${analysis.team.hiring}</p>
      <p><strong>Post-Sale Retention:</strong> ${analysis.team.retention}</p>
    </div>
  </section>

  <section class="section">
    <h1>FACILITIES</h1>
    <div class="info-grid">
      <div class="info-card">
        <p><strong>Ownership Status:</strong> ${analysis.facility.ownership}</p>
        <p><strong>Size:</strong> ${analysis.facility.size}</p>
      </div>
      <div class="info-card">
        <p><strong>Monthly Cost:</strong> ${analysis.facility.cost}</p>
        ${analysis.facility.leaseDetails ? `<p><strong>Lease Details:</strong> ${analysis.facility.leaseDetails}</p>` : ''}
      </div>
    </div>
  </section>
</body>
</html>
`;
}