import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Building,
  TrendingUp,
  Globe,
  FileText,
  CheckCircle,
  ArrowRight,
  Shield,
  BarChart3,
  Briefcase,
  Users,
  Lock,
  Zap
} from "lucide-react";
import { SEOHead } from "@/components/seo-head";

export default function InvestmentBankingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <SEOHead
        title="CIM Share for Investment Banks - Enterprise Document Solutions"
        description="Enterprise-grade CIM creation and secure document sharing for investment banks. Professional documentation with enhanced security, collaboration features, and institutional-level compliance."
        canonicalUrl="https://brokervault.ai/solutions/investment-banking"
      />
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Building className="h-5 w-5" />
            <span className="text-sm font-medium">Professional Document Platform</span>
          </div>
          
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Professional CIM Creation for Complex Transactions
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Create professional documentation with enhanced security and collaboration features. 
            Suitable for larger transactions and institutional use cases.
          </p>
          
          <div className="flex gap-4 justify-center">
            <a href="https://meetings-na2.hubspot.com/rob-kale" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="gap-2">
                Book a Demo <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                View Enterprise Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Secure</div>
              <p className="text-muted-foreground">Document Handling</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Professional</div>
              <p className="text-muted-foreground">Documentation</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Scalable</div>
              <p className="text-muted-foreground">Platform</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Differentiators */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Investment Banks Choose CIM Share
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-semibold mb-6">Enterprise-Ready Infrastructure</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Enhanced Security</p>
                    <p className="text-sm text-muted-foreground">
                      Strong encryption and secure document handling for sensitive information
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">API Access</p>
                    <p className="text-sm text-muted-foreground">
                      API capabilities for custom integrations with your existing tools
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Reliable Platform</p>
                    <p className="text-sm text-muted-foreground">
                      Stable and reliable platform for your critical business documents
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Custom Branding</p>
                    <p className="text-sm text-muted-foreground">
                      Add your company branding to documents and exports
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-lg p-8 shadow-lg border">
              <h4 className="text-xl font-semibold mb-6">Security Features</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded">
                  <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">Data Encryption</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded">
                  <Lock className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">Access Controls</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded">
                  <Globe className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">Secure Sharing</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded">
                  <Building className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">Audit Trails</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Platform Capabilities
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <FileText className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Deal Marketing</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Multi-format CIM generation
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Interactive management presentations
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Teaser deck automation
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Process letter management
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Buyer Management</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Track document recipients and NDA signers
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Multiple document versions
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Organize by transaction
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Contact management
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Virtual Data Room</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Granular permission controls
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Dynamic watermarking
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Document versioning
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Detailed audit trails
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Analytics & Reporting</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Document access tracking
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    View history and timestamps
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Export capabilities
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Professional formatting
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-4" />
                <CardTitle>AI & Automation</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    AI-assisted CIM creation
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Content structuring
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Document formatting
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Section organization
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Briefcase className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Deal Collaboration</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Multi-user access
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Document sharing
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Password protection
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    NDA requirements
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Transaction Types */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Supporting Every Type of Transaction
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Sell-Side M&A</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Maximize value with competitive auction processes and sophisticated buyer outreach.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Professional CIM creation and distribution
                  </li>
                  <li className="flex gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Document customization and branding
                  </li>
                  <li className="flex gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Secure document sharing
                  </li>
                  <li className="flex gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    NDA and access management
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Buy-Side M&A</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Execute strategic acquisitions with comprehensive target analysis and deal management.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Document organization and structure
                  </li>
                  <li className="flex gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Information gathering and processing
                  </li>
                  <li className="flex gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Professional documentation
                  </li>
                  <li className="flex gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Export and distribution options
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Cross-Border Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Navigate complex international deals with multi-jurisdiction support.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <Globe className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Document formatting options
                  </li>
                  <li className="flex gap-2">
                    <Globe className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Secure data handling
                  </li>
                  <li className="flex gap-2">
                    <Globe className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Professional presentation
                  </li>
                  <li className="flex gap-2">
                    <Globe className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Access management
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Capital Raising</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Streamline equity and debt financing processes with institutional investors.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <Building className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Professional document creation
                  </li>
                  <li className="flex gap-2">
                    <Building className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Secure distribution
                  </li>
                  <li className="flex gap-2">
                    <Building className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Document versioning
                  </li>
                  <li className="flex gap-2">
                    <Building className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Export capabilities
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Integration Capabilities
          </h2>
          
          <div className="grid md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="h-20 bg-card rounded-lg flex items-center justify-center mb-3 border">
                <span className="text-lg font-semibold text-muted-foreground">PDF Export</span>
              </div>
              <p className="text-sm text-muted-foreground">Professional PDFs</p>
            </div>
            <div>
              <div className="h-20 bg-card rounded-lg flex items-center justify-center mb-3 border">
                <span className="text-lg font-semibold text-muted-foreground">Word Export</span>
              </div>
              <p className="text-sm text-muted-foreground">Editable Documents</p>
            </div>
            <div>
              <div className="h-20 bg-card rounded-lg flex items-center justify-center mb-3 border">
                <span className="text-lg font-semibold text-muted-foreground">Web Scraping</span>
              </div>
              <p className="text-sm text-muted-foreground">Logo & Image Extraction</p>
            </div>
            <div>
              <div className="h-20 bg-card rounded-lg flex items-center justify-center mb-3 border">
                <span className="text-lg font-semibold text-muted-foreground">Digital Signatures</span>
              </div>
              <p className="text-sm text-muted-foreground">NDA Management</p>
            </div>
            <div>
              <div className="h-20 bg-card rounded-lg flex items-center justify-center mb-3 border">
                <span className="text-lg font-semibold text-muted-foreground">Cloud Storage</span>
              </div>
              <p className="text-sm text-muted-foreground">Secure File Storage</p>
            </div>
            <div>
              <div className="h-20 bg-card rounded-lg flex items-center justify-center mb-3 border">
                <span className="text-lg font-semibold text-muted-foreground">Access Control</span>
              </div>
              <p className="text-sm text-muted-foreground">Password Protection</p>
            </div>
            <div>
              <div className="h-20 bg-card rounded-lg flex items-center justify-center mb-3 border">
                <span className="text-lg font-semibold text-muted-foreground">Analytics</span>
              </div>
              <p className="text-sm text-muted-foreground">Document Tracking</p>
            </div>
            <div>
              <div className="h-20 bg-card rounded-lg flex items-center justify-center mb-3 border">
                <span className="text-lg font-semibold text-muted-foreground">API Access</span>
              </div>
              <p className="text-sm text-muted-foreground">Custom Solutions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Client Testimonials */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Built for Professional Use
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8">
            <Card>
              <CardContent className="p-8">
                <p className="text-lg mb-6 italic">
                  "CIM Share provides a professional platform for creating and sharing 
                  confidential documents with proper security controls."
                </p>
                <div>
                  <p className="font-semibold">James Richardson</p>
                  <p className="text-sm text-muted-foreground">Managing Director, Global Investment Bank</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-8">
                <p className="text-lg mb-6 italic">
                  "The AI-assisted document creation helps us produce professional CIMs 
                  more efficiently while maintaining quality."
                </p>
                <div>
                  <p className="font-semibold">Alexandra Chen</p>
                  <p className="text-sm text-muted-foreground">Head of M&A, Boutique Advisory Firm</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Enterprise Support */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Enterprise Support & Services
          </h2>
          
          <div className="grid lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dedicated Success Team</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Dedicated support for enterprise customers.
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Priority support</li>
                  <li>• Regular check-ins</li>
                  <li>• Training available</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Implementation Services</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Assistance with setup and configuration.
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Setup assistance</li>
                  <li>• Configuration help</li>
                  <li>• API documentation</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Custom Development</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Options for customization based on your needs.
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Custom configurations</li>
                  <li>• API access</li>
                  <li>• Flexible options</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Create Professional Documents?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Professional CIM creation and secure document sharing for institutions
            </p>
            <div className="flex gap-4 justify-center">
              <a href="https://meetings-na2.hubspot.com/rob-kale" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="gap-2">
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <Button size="lg" variant="outline" asChild>
                <a href="mailto:enterprise@brokervault.ai">
                  Contact Sales Team
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Enterprise pricing available • Enhanced features • Priority support
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}