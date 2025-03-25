import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Download, FileText, File, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator, SelectLabel } from "@/components/ui/select";
import { LoadingAnimation } from "@/components/ui/loading-animation";

export function DocumentExport({ analysis, docId, user }: { analysis: any; docId: number; user: any }) {
  const { toast } = useToast();
  const [isWordPressDialogOpen, setIsWordPressDialogOpen] = useState(false);
  const [isWordPressExporting, setIsWordPressExporting] = useState(false);
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);
  const [beaverBuilderTemplates, setBeaverBuilderTemplates] = useState<Array<{id: number, title: string, type: string}>>([]);
  const [wordpressForm, setWordpressForm] = useState({
    wpUrl: '',
    username: '',
    password: '',
    status: 'draft',
    template: 'default'
  });

  const handleWordPressFormChange = (field: string, value: string) => {
    setWordpressForm(prev => ({ ...prev, [field]: value }));
  };
  
  // Fetch Beaver Builder templates when credentials are available
  const fetchBeaverBuilderTemplates = async () => {
    const { wpUrl, username, password } = wordpressForm;
    
    if (!wpUrl || !username || !password) {
      toast({
        title: "Missing Credentials",
        description: "Please enter your WordPress site URL, username, and password first.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsFetchingTemplates(true);
      
      const response = await fetch("/api/wordpress/fetch-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wpUrl, username, password })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch templates");
      }
      
      const { templates } = await response.json();
      
      if (!templates || templates.length === 0) {
        toast({
          title: "No Templates Found",
          description: "No Beaver Builder templates were found on your WordPress site.",
        });
        return;
      }
      
      setBeaverBuilderTemplates(templates);
      toast({
        title: "Templates Loaded",
        description: `Found ${templates.length} Beaver Builder templates.`,
      });
    } catch (error) {
      toast({
        title: "Failed to Fetch Templates",
        description: error instanceof Error ? error.message : "Could not connect to WordPress site",
        variant: "destructive"
      });
    } finally {
      setIsFetchingTemplates(false);
    }
  };

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

  const exportToWordPress = async () => {
    try {
      setIsWordPressExporting(true);
      
      const { wpUrl, username, password, status, template } = wordpressForm;
      
      // Validate form
      if (!wpUrl || !username || !password) {
        throw new Error("Please fill in all required fields");
      }

      // Make the API request
      const response = await fetch(`/api/cim/export/wordpress/${docId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          wpUrl,
          username,
          password,
          status,
          template,
          useCustomField: true // This indicates we want to use the custom field wpcf-text-dump
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Check for specific WordPress permission errors
        if (errorData.error && errorData.error.includes("not allowed to create posts")) {
          throw new Error("The WordPress user doesn't have permission to create posts. Please use an administrator account or a user with Editor role.");
        } else if (errorData.error && errorData.error.includes("HTML instead of JSON")) {
          throw new Error("Could not connect to WordPress REST API. Make sure the site URL is correct and REST API is enabled.");
        } else {
          throw new Error(errorData.error || 'Failed to export to WordPress');
        }
      }

      const result = await response.json();
      
      toast({
        title: "WordPress Export Successful",
        description: `The document has been exported to WordPress as a ${status} post.${result.url ? ' View it on your site.' : ''}`,
      });

      if (result.url) {
        window.open(result.url, '_blank');
      }
      
      setIsWordPressDialogOpen(false);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export to WordPress",
        variant: "destructive"
      });
    } finally {
      setIsWordPressExporting(false);
    }
  };

  const canAccessPremiumFeatures = user?.isAdmin || user?.subscriptionStatus === "premium";

  return (
    <>
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
                <DropdownMenuItem onClick={() => setIsWordPressDialogOpen(true)}>
                  <Globe className="h-4 w-4 mr-2" />
                  Export to WordPress
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* WordPress Export Dialog */}
      <Dialog open={isWordPressDialogOpen} onOpenChange={setIsWordPressDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export to WordPress</DialogTitle>
            <DialogDescription>
              Enter your WordPress site details to export this CIM document as a "listing" post. 
              You need an Admin or Editor account with permission to create "listing" post types.
              Some WordPress sites may require an Application Password for API access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wp-url">WordPress Site URL</Label>
              <Input 
                id="wp-url" 
                placeholder="https://yourdomain.com" 
                value={wordpressForm.wpUrl}
                onChange={(e) => handleWordPressFormChange('wpUrl', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Enter the root URL of your WordPress site
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wp-username">Username</Label>
                <Input 
                  id="wp-username" 
                  placeholder="admin" 
                  value={wordpressForm.username}
                  onChange={(e) => handleWordPressFormChange('username', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wp-password">Password or App Password</Label>
                <Input 
                  id="wp-password" 
                  type="password" 
                  placeholder="••••••••"
                  value={wordpressForm.password}
                  onChange={(e) => handleWordPressFormChange('password', e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For better API access, use an Application Password from your WordPress profile
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wp-status">Post Status</Label>
                <Select 
                  value={wordpressForm.status}
                  onValueChange={(value) => handleWordPressFormChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select post status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="publish">Published</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="wp-template">Listing Template</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button" 
                    onClick={fetchBeaverBuilderTemplates}
                    disabled={isFetchingTemplates || !wordpressForm.wpUrl || !wordpressForm.username || !wordpressForm.password}
                    className="text-xs h-7 px-2"
                  >
                    {isFetchingTemplates ? (
                      <LoadingAnimation size="sm" text="Loading..." />
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Load Templates
                      </>
                    )}
                  </Button>
                </div>
                <Select 
                  value={wordpressForm.template}
                  onValueChange={(value) => handleWordPressFormChange('template', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default WordPress Template</SelectItem>
                    {/* Regular WordPress templates */}
                    <SelectItem value="premium">Premium Template</SelectItem>
                    <SelectItem value="showcase">Showcase Template</SelectItem>
                    <SelectItem value="featured">Featured Template</SelectItem>
                    
                    {/* Beaver Builder templates */}
                    {beaverBuilderTemplates.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectLabel>Beaver Builder Templates</SelectLabel>
                        {beaverBuilderTemplates.map(template => (
                          <SelectItem key={template.id} value={String(template.id)}>
                            {template.title}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Template applied to the listing in WordPress. Click "Load Templates" to fetch Beaver Builder templates from your site.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex space-x-2 sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => setIsWordPressDialogOpen(false)}
              disabled={isWordPressExporting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={exportToWordPress}
              disabled={isWordPressExporting}
            >
              {isWordPressExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : 'Export to WordPress'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatTextContent(analysis: any): string {
  return `
CONFIDENTIAL INFORMATION MEMORANDUM

BUSINESS OVERVIEW
================
Founded: ${analysis.story?.yearStarted || 'N/A'}
Structure: ${analysis.story?.businessStructure || 'N/A'}

${analysis.story?.businessSummary || analysis.story?.businessModel || 'N/A'}

INVESTMENT HIGHLIGHTS
===================
Key Attractions:
${analysis.executiveSummary?.buyerAttractions?.map((item: string) => `• ${item}`).join('\n') || 'N/A'}

Growth Opportunities:
${analysis.executiveSummary?.growthOpportunities?.map((item: string) => `• ${item}`).join('\n') || 'N/A'}

MARKET POSITION
=============
Target Market: ${analysis.marketAnalysis?.customerProfile || 'N/A'}

Competitors:
${analysis.marketAnalysis?.competitors?.map((item: string) => `• ${item}`).join('\n') || 'N/A'}

Business Strengths:
${analysis.marketAnalysis?.strengths?.map((item: string) => `• ${item}`).join('\n') || 'N/A'}

OPERATIONS
=========
Customer Relationships:
• Recurring Revenue: ${analysis.operations?.customers?.recurring || 'N/A'}
• Customer Base: ${analysis.operations?.customers?.relationships || 'N/A'}
• Revenue Concentration: ${analysis.operations?.customers?.concentration || 'N/A'}
• Contract Terms: ${analysis.operations?.customers?.contracts || 'N/A'}

Supply Chain:
• Number of Suppliers: ${analysis.operations?.suppliers?.count || 'N/A'}
• Supplier Terms: ${analysis.operations?.suppliers?.terms || 'N/A'}
• Concentration: ${analysis.operations?.suppliers?.concentration || 'N/A'}
• Transferability: ${analysis.operations?.suppliers?.transferability || 'N/A'}

TEAM STRUCTURE
=============
• Owner Responsibilities: ${analysis.team?.ownerResponsibilities || 'N/A'}
• Required Hours: ${analysis.team?.ownerHours || 'N/A'}
• Management Structure: ${analysis.team?.management || 'N/A'}
• Team Size: ${analysis.team?.employeeCount || 'N/A'}
• Turnover Rate: ${analysis.team?.turnover || 'N/A'}
• Retention: ${analysis.team?.retention || 'N/A'}

FACILITIES
=========
• Ownership Status: ${analysis.facility?.ownership || 'N/A'}
• Size: ${analysis.facility?.size || 'N/A'}
• Monthly Cost: ${analysis.facility?.cost || 'N/A'}
${analysis.facility?.leaseDetails ? `• Lease Details: ${analysis.facility.leaseDetails}` : ''}
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
    .title-page {
      text-align: center;
      margin-bottom: 60px;
    }
    .confidential {
      font-style: italic;
      margin-top: 40px;
      text-align: center;
      color: #666;
    }
    .separator {
      border-top: 1px solid #ccc;
      margin: 30px 0;
    }
    .bullet-list {
      list-style-type: disc;
      padding-left: 20px;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #777;
      margin-top: 50px;
      border-top: 1px solid #eee;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <div class="title-page">
    <h1>CONFIDENTIAL INFORMATION MEMORANDUM</h1>
    <p>${analysis.story?.businessSummary || 'Business Information Package'}</p>
    <div class="separator"></div>
    <p class="confidential">CONFIDENTIAL</p>
    <p>This document contains confidential information. It is provided to you for informational purposes only.</p>
  </div>

  <section class="section">
    <h1>BUSINESS OVERVIEW</h1>
    <div class="info-grid">
      <div class="info-card">
        <strong>Founded:</strong> ${analysis.story?.yearStarted || 'N/A'}
      </div>
      <div class="info-card">
        <strong>Structure:</strong> ${analysis.story?.businessStructure || 'N/A'}
      </div>
    </div>

    <h2>Business Description</h2>
    <p>${analysis.story?.businessSummary || analysis.story?.businessModel || 'N/A'}</p>

    ${analysis.story?.growthHistory ? `
    <h2>Growth History</h2>
    <p>${analysis.story.growthHistory}</p>
    ` : ''}
  </section>

  <section class="section">
    <h1>INVESTMENT HIGHLIGHTS</h1>
    <h2>Key Attractions</h2>
    <ul class="bullet-list">
      ${analysis.executiveSummary?.buyerAttractions?.map((item: string) => `<li>${item}</li>`).join('') || '<li>N/A</li>'}
    </ul>

    <h2>Growth Opportunities</h2>
    <ul class="bullet-list">
      ${analysis.executiveSummary?.growthOpportunities?.map((item: string) => `<li>${item}</li>`).join('') || '<li>N/A</li>'}
    </ul>
  </section>

  <section class="section">
    <h1>MARKET POSITION</h1>
    <h2>Target Market</h2>
    <p>${analysis.marketAnalysis?.customerProfile || 'N/A'}</p>

    <h2>Competitive Landscape</h2>
    <div class="info-grid">
      <div class="info-card">
        <h3>Competitors</h3>
        <ul class="bullet-list">
          ${analysis.marketAnalysis?.competitors?.map((item: string) => `<li>${item}</li>`).join('') || '<li>N/A</li>'}
        </ul>
      </div>
      <div class="info-card">
        <h3>Business Strengths</h3>
        <ul class="bullet-list">
          ${analysis.marketAnalysis?.strengths?.map((item: string) => `<li>${item}</li>`).join('') || '<li>N/A</li>'}
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
        <td>${analysis.operations?.customers?.recurring || 'N/A'}</td>
      </tr>
      <tr>
        <td>Customer Base</td>
        <td>${analysis.operations?.customers?.relationships || 'N/A'}</td>
      </tr>
      <tr>
        <td>Revenue Concentration</td>
        <td>${analysis.operations?.customers?.concentration || 'N/A'}</td>
      </tr>
      <tr>
        <td>Contract Terms</td>
        <td>${analysis.operations?.customers?.contracts || 'N/A'}</td>
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
        <td>${analysis.operations?.suppliers?.count || 'N/A'}</td>
      </tr>
      <tr>
        <td>Supplier Terms</td>
        <td>${analysis.operations?.suppliers?.terms || 'N/A'}</td>
      </tr>
      <tr>
        <td>Concentration</td>
        <td>${analysis.operations?.suppliers?.concentration || 'N/A'}</td>
      </tr>
      <tr>
        <td>Transferability</td>
        <td>${analysis.operations?.suppliers?.transferability || 'N/A'}</td>
      </tr>
    </table>
  </section>

  <section class="section">
    <h1>TEAM STRUCTURE</h1>
    <h2>Ownership & Management</h2>
    <div class="info-card">
      <p><strong>Owner's Role:</strong> ${analysis.team?.ownerResponsibilities || 'N/A'}</p>
      <p><strong>Required Hours:</strong> ${analysis.team?.ownerHours || 'N/A'}</p>
      <p><strong>Management Structure:</strong> ${analysis.team?.management || 'N/A'}</p>
    </div>

    ${analysis.team?.employeeCount ? `
    <h2>Employee Overview</h2>
    <div class="info-card">
      <p><strong>Team Size:</strong> ${analysis.team.employeeCount}</p>
      <p><strong>Turnover Rate:</strong> ${analysis.team.turnover || 'N/A'}</p>
      <p><strong>Retention:</strong> ${analysis.team.retention || 'N/A'}</p>
    </div>
    ` : ''}

    ${analysis.team?.keyEmployees?.length ? `
    <h2>Key Personnel</h2>
    <ul class="bullet-list">
      ${analysis.team.keyEmployees.map((role: string) => `<li>${role}</li>`).join('')}
    </ul>
    ` : ''}
  </section>

  <section class="section">
    <h1>FACILITIES</h1>
    <div class="info-grid">
      <div class="info-card">
        <p><strong>Ownership Status:</strong> ${analysis.facility?.ownership || 'N/A'}</p>
        <p><strong>Size:</strong> ${analysis.facility?.size || 'N/A'}</p>
      </div>
      <div class="info-card">
        <p><strong>Monthly Cost:</strong> ${analysis.facility?.cost || 'N/A'}</p>
        ${analysis.facility?.leaseDetails ? `<p><strong>Lease Details:</strong> ${analysis.facility.leaseDetails}</p>` : ''}
      </div>
    </div>
  </section>

  <div class="footer">
    CONFIDENTIAL INFORMATION MEMORANDUM - FOR AUTHORIZED RECIPIENTS ONLY
  </div>
</body>
</html>
`;
}