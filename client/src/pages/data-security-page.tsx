import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Server, Database, FileCheck, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function DataSecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-4">Data Security & Privacy</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transparency about how your confidential business data is handled, stored, and protected.
          </p>
        </div>

        {/* Key Commitments */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <Shield className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle className="text-lg">No AI Training</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your data is NEVER used to train AI models. All our AI providers contractually guarantee this.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <Lock className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle className="text-lg">Encrypted Everywhere</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                All data encrypted in transit (TLS 1.2+) and at rest (AES-256). Your data is never exposed.
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50">
            <CardHeader className="pb-3">
              <Database className="h-8 w-8 text-purple-600 mb-2" />
              <CardTitle className="text-lg">You Control Your Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Export or delete your data anytime. We retain only what's legally required.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Flow Diagram */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Customer Data Flow Diagram
            </CardTitle>
            <CardDescription>
              A complete view of where your data goes and how it's protected at every step
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 rounded-lg p-4 overflow-auto">
              <a
                href="/cim-share-data-flow.png"
                target="_blank"
                rel="noopener noreferrer"
                className="block cursor-zoom-in"
              >
                <img
                  src="/cim-share-data-flow.png"
                  alt="CIM Share Data Flow Diagram"
                  className="w-full max-w-5xl mx-auto hover:opacity-90 transition-opacity"
                />
              </a>
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Click to enlarge. All connections use TLS 1.2+ encryption.
            </p>
          </CardContent>
        </Card>

        {/* Third-Party Services */}
        <h2 className="text-2xl font-bold mb-6">Third-Party Service Providers</h2>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* AI Services */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Processing Services</CardTitle>
              <CardDescription>Used for document generation and analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">OpenAI (GPT-4)</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    No Training
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Document generation, content analysis</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">SOC 2 Type II</Badge>
                  <Badge variant="secondary">GDPR</Badge>
                  <Badge variant="secondary">CCPA</Badge>
                </div>
                <a
                  href="https://openai.com/enterprise-privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                >
                  View Privacy Policy <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Anthropic (Claude)</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    No Training
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Vision processing, document analysis</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">SOC 2 Type II</Badge>
                  <Badge variant="secondary">GDPR</Badge>
                  <Badge variant="secondary">HIPAA eligible</Badge>
                </div>
                <a
                  href="https://www.anthropic.com/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                >
                  View Privacy Policy <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Perplexity AI</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    No Training
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Market research, competitive analysis</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">Enterprise API</Badge>
                  <Badge variant="secondary">SOC 2</Badge>
                </div>
                <a
                  href="https://www.perplexity.ai/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                >
                  View Privacy Policy <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Other Services */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Infrastructure & Payments</CardTitle>
              <CardDescription>Core service providers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Stripe</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    PCI DSS L1
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Payment processing - we never see your card details</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">PCI DSS Level 1</Badge>
                  <Badge variant="secondary">SOC 2</Badge>
                </div>
              </div>

              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">SendGrid (Twilio)</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    SOC 2
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Email delivery for notifications and sharing</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">SOC 2 Type II</Badge>
                  <Badge variant="secondary">GDPR</Badge>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">PostgreSQL Database</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    AES-256
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Encrypted at rest, regular backups</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">Encrypted at Rest</Badge>
                  <Badge variant="secondary">Point-in-time Recovery</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Retention */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Data Retention Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Data Type</th>
                    <th className="text-left py-3 px-4 font-medium">Retention Period</th>
                    <th className="text-left py-3 px-4 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4">Account Information</td>
                    <td className="py-3 px-4">Until account deletion</td>
                    <td className="py-3 px-4 text-muted-foreground">You can delete anytime</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">CIM Documents</td>
                    <td className="py-3 px-4">Until account deletion</td>
                    <td className="py-3 px-4 text-muted-foreground">Export available before deletion</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">E-Signature Records</td>
                    <td className="py-3 px-4">7 years minimum</td>
                    <td className="py-3 px-4 text-muted-foreground">Legal requirement (E-SIGN Act)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">AI Provider Data</td>
                    <td className="py-3 px-4">Max 30 days</td>
                    <td className="py-3 px-4 text-muted-foreground">Deleted by providers automatically</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Payment Records</td>
                    <td className="py-3 px-4">Per legal requirements</td>
                    <td className="py-3 px-4 text-muted-foreground">Managed by Stripe</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/privacy-policy">
            <a className="text-blue-600 hover:underline">Full Privacy Policy</a>
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link href="/cookie-policy">
            <a className="text-blue-600 hover:underline">Cookie Policy</a>
          </Link>
          <span className="text-muted-foreground">|</span>
          <a href="mailto:privacy@cimshare.com" className="text-blue-600 hover:underline">
            Contact Privacy Team
          </a>
        </div>
      </div>
    </div>
  );
}
