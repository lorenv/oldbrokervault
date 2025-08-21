import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  Database, 
  Users, 
  Search, 
  Filter, 
  CheckCircle,
  ArrowRight,
  Globe,
  Building2,
  TrendingUp,
  Mail,
  Phone,
  AlertCircle,
  BarChart3,
  Target
} from "lucide-react";

export default function InvestorDatabasePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Database className="h-5 w-5" />
            <span className="text-sm font-medium">Contact Management System</span>
          </div>
          
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Track and Manage Your Document Recipients
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Keep track of everyone who has signed your NDAs and accessed your documents. 
            Manage your investor contacts and monitor document engagement in one place.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="gap-2">
                Access Investor Database <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">
                Schedule Demo
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
              <div className="text-4xl font-bold text-primary mb-2">Track</div>
              <p className="text-muted-foreground">NDA Signatures</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Manage</div>
              <p className="text-muted-foreground">Contact Information</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Monitor</div>
              <p className="text-muted-foreground">Document Access</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                The Contact Management Challenge
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Keeping track of who has access to your confidential documents
                  </p>
                </div>
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Managing contact information across multiple document shares
                  </p>
                </div>
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    No central place to see all NDA signatures and document access
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Organized Contact Tracking
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Automatically track everyone who signs your NDAs
                  </p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Store and manage contact information for all document recipients
                  </p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    See document access history and engagement for each contact
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Grid */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Contact Management Features
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Search className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Contact Search</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Search and filter your contacts by name, email, company, 
                  or document they've accessed.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Target className="h-10 w-10 text-primary mb-4" />
                <CardTitle>NDA Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track all NDA signatures with timestamps and document associations. 
                  Know exactly who has signed and when.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Contact Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Store contact information including name, email, phone, 
                  company, and notes for each recipient.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Mail className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Document Access History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  See which documents each contact has accessed and when. 
                  Monitor engagement with your shared materials.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Export Capabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Export your contact list and NDA signature records 
                  for reporting or compliance purposes.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Globe className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Tags & Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Organize contacts with tags and labels. Group contacts 
                  by deal, project, or any custom categorization.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Buyer Types Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Manage All Your Document Recipients
          </h2>
          
          <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Investors</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Individual investors
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Investment groups
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Venture capitalists
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Business Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Business partners
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Potential buyers
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Industry contacts
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Professional Services</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Attorneys
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Accountants
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Consultants
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Other Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Advisors
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Board members
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Other stakeholders
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            How Contact Management Works
          </h2>
          
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Share Documents</h3>
              <p className="text-sm text-muted-foreground">
                Share your CIM with NDA protection enabled
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Collect Signatures</h3>
              <p className="text-sm text-muted-foreground">
                Recipients sign NDAs before accessing documents
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Track Contacts</h3>
              <p className="text-sm text-muted-foreground">
                Automatically save contact information
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Monitor Activity</h3>
              <p className="text-sm text-muted-foreground">
                See who has accessed your documents and when
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Success Metrics Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Benefits of Contact Management
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-xl">Better Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">All contacts in one place</span>
                    <span className="font-bold text-primary">✓</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">NDA signature tracking</span>
                    <span className="font-bold text-primary">✓</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Document access history</span>
                    <span className="font-bold text-primary">✓</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-xl">Enhanced Security</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Know who has access</span>
                    <span className="font-bold text-primary">✓</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Legal compliance records</span>
                    <span className="font-bold text-primary">✓</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Audit trail maintained</span>
                    <span className="font-bold text-primary">✓</span>
                  </div>
                </div>
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
              Start Managing Your Contacts Effectively
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Track all your NDA signatures and document recipients in one place
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="gap-2">
                  Start Tracking Contacts <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline">
                  View Pricing
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Try it free • No credit card required
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}