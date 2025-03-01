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
${analysis.executiveSummary.buyerAttractions.map(item => `• ${item}`).join('\n')}

Growth Opportunities
------------------
${analysis.executiveSummary.growthOpportunities.map(item => `• ${item}`).join('\n')}

MARKET POSITION
=============
Target Market
------------
${analysis.marketAnalysis.customerProfile}

Competitive Landscape
-------------------
Competitors:
${analysis.marketAnalysis.competitors.map(item => `• ${item}`).join('\n')}

Business Strengths:
${analysis.marketAnalysis.strengths.map(item => `• ${item}`).join('\n')}

OPERATIONS
=========
Customer Relationships
--------------------
• Recurring Revenue: ${analysis.operations.customers.recurring}
• Customer Base: ${analysis.operations.customers.relationships}
• Revenue Concentration: ${analysis.operations.customers.concentration}
• Contract Terms: ${analysis.operations.customers.contracts}

Supply Chain
-----------
• Number of Suppliers: ${analysis.operations.suppliers.count}
• Supplier Terms: ${analysis.operations.suppliers.terms}
• Concentration: ${analysis.operations.suppliers.concentration}
• Relationship Transfer: ${analysis.operations.suppliers.transferability}

TEAM STRUCTURE
============
Ownership & Management
--------------------
Owner's Role: ${analysis.team.ownerResponsibilities}
Required Hours: ${analysis.team.ownerHours}
Management Structure: ${analysis.team.management}

Employee Overview
---------------
${analysis.team.employees.map(emp => 
  `Role: ${emp.role}
   Status: ${emp.status}
   Compensation: ${emp.compensation}
  `).join('\n\n')}

Team Stability
-------------
Turnover Rate: ${analysis.team.turnover}
Hiring Environment: ${analysis.team.hiring}
Post-Sale Retention: ${analysis.team.retention}

FACILITIES
=========
• Ownership Status: ${analysis.facility.ownership}
• Size: ${analysis.facility.size}
• Monthly Cost: ${analysis.facility.cost}
${analysis.facility.leaseDetails ? `• Lease Details: ${analysis.facility.leaseDetails}` : ''}
`;
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
      ${analysis.executiveSummary.buyerAttractions.map(item => `<li>${item}</li>`).join('')}
    </ul>

    <h2>Growth Opportunities</h2>
    <ul>
      ${analysis.executiveSummary.growthOpportunities.map(item => `<li>${item}</li>`).join('')}
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
          ${analysis.marketAnalysis.competitors.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
      <div class="info-card">
        <h3>Business Strengths</h3>
        <ul>
          ${analysis.marketAnalysis.strengths.map(item => `<li>${item}</li>`).join('')}
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
      ${analysis.team.employees.map(emp => `
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