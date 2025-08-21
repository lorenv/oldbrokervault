import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  Shield, 
  Lock, 
  FileCheck, 
  Users, 
  CheckCircle,
  ArrowRight,
  FileSignature,
  Eye,
  Clock,
  AlertCircle
} from "lucide-react";

export default function NdaProtectionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-medium">Enterprise-Grade Security</span>
          </div>
          
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Protect Confidential Business Information with Digital NDAs
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Protect your confidential business documents with integrated NDA agreements and digital signatures. 
            Ensure sensitive information is only accessed by authorized parties who have signed your NDA.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="gap-2">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">
                Request Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                The Challenge Business Brokers Face
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Sharing confidential business information requires trust and legal protection
                  </p>
                </div>
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Traditional NDA processes involve printing, signing, scanning, and emailing documents back and forth
                  </p>
                </div>
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Difficult to track who has signed NDAs and accessed your documents
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Our Secure Solution
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Digital NDA signatures integrated directly into your document sharing process
                  </p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Electronic signatures that are legally binding and trackable
                  </p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Track who has signed your NDAs and accessed your documents
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
            Comprehensive NDA Management Features
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <FileSignature className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Digital Signature Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Collect electronic signatures directly through the platform. 
                  Recipients sign NDAs before accessing your confidential documents.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Lock className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Password-Protected Access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Add password protection to your shared documents. 
                  Control who can access your confidential information.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Eye className="h-10 w-10 text-primary mb-4" />
                <CardTitle>View-Only Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Share documents securely with view-only access. 
                  Maintain control over your sensitive business information.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Clock className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Time-Based Access Control</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Control how long shared documents remain accessible. 
                  Set expiration dates for time-sensitive information.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Multi-Party NDAs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Share documents with multiple parties while tracking 
                  individual NDA signatures and access.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileCheck className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Audit Trail & Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Keep records of who signed NDAs and when. 
                  Track document access for compliance purposes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            How to Use NDA Protection
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-xl">For Confidential Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground">
                  Protect your CIM documents and other confidential business information 
                  with integrated NDA requirements.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Require NDA signature before document access
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Track all NDA signatures in one place
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Monitor document access and engagement
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-xl">For Business Sales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground">
                  Ensure potential buyers sign NDAs before viewing 
                  sensitive business information.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Control access to confidential documents
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    See who has viewed your documents
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Password protect sensitive information
                  </li>
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
              Secure Your Business Transactions Today
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Start protecting your confidential documents with integrated NDA management
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="gap-2">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline">
                  View Pricing Plans
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required • Full feature access • Cancel anytime
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}