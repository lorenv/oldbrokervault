import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  Briefcase, 
  TrendingUp, 
  Users, 
  FileText, 
  CheckCircle,
  ArrowRight,
  Clock,
  DollarSign,
  Shield,
  BarChart3,
  Zap,
  Award
} from "lucide-react";

export default function BusinessBrokersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Briefcase className="h-5 w-5" />
            <span className="text-sm font-medium">Built for Business Brokers</span>
          </div>
          
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Professional CIM Creation Platform for Business Brokers
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Create professional Confidential Information Memorandums quickly with AI assistance, secure document sharing, and NDA protection. 
            Designed for business brokers and M&A advisors.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="gap-2">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">
                Book a Demo
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
              <div className="text-4xl font-bold text-primary mb-2">Fast</div>
              <p className="text-muted-foreground">CIM Creation</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Secure</div>
              <p className="text-muted-foreground">Document Sharing</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Professional</div>
              <p className="text-muted-foreground">Results</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            We Understand Your Daily Challenges
          </h2>
          
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <Clock className="h-8 w-8 text-destructive mb-2" />
                <CardTitle className="text-lg">Time-Consuming Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Creating professional CIMs takes weeks of work, delaying your ability to market listings effectively
                </p>
              </CardContent>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <Users className="h-8 w-8 text-destructive mb-2" />
                <CardTitle className="text-lg">Difficult Buyer Discovery</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Finding and organizing information to create professional documentation
                </p>
              </CardContent>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <Shield className="h-8 w-8 text-destructive mb-2" />
                <CardTitle className="text-lg">Information Security Risks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Managing NDAs and controlling access to confidential information requires careful tracking
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Solution Overview */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Your Complete Business Brokerage Solution
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-semibold mb-6">Everything You Need in One Platform</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Professional CIM Creation</p>
                    <p className="text-sm text-muted-foreground">
                      AI-powered tools help generate comprehensive memorandums quickly
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Secure Document Management</p>
                    <p className="text-sm text-muted-foreground">
                      Digital NDAs, password protection, and granular access controls
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Contact Management</p>
                    <p className="text-sm text-muted-foreground">
                      Track all NDA signatures and document recipients in one place
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Deal Analytics</p>
                    <p className="text-sm text-muted-foreground">
                      Track buyer engagement and monitor deal progress in real-time
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-lg p-8 shadow-lg">
              <h4 className="text-xl font-semibold mb-6">Typical Broker Workflow</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <p className="text-sm">Upload business financials and information</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <p className="text-sm">AI assists in generating professional CIM</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <p className="text-sm">Customize and refine the document</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">4</span>
                  </div>
                  <p className="text-sm">Share CIM with NDA protection</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">5</span>
                  </div>
                  <p className="text-sm">Track who has accessed documents</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features by Deal Stage */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Tools for Every Stage of the Deal Process
          </h2>
          
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <CardTitle>Listing Preparation</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-medium mb-2">Information Gathering</p>
                    <p className="text-sm text-muted-foreground">
                      Upload transcripts and business information to get started
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">AI Processing</p>
                    <p className="text-sm text-muted-foreground">
                      AI helps structure your information into professional sections
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Customization</p>
                    <p className="text-sm text-muted-foreground">
                      Edit and customize every section to match your needs
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-primary" />
                  <CardTitle>Marketing & Outreach</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-medium mb-2">Document Sharing</p>
                    <p className="text-sm text-muted-foreground">
                      Share securely with password protection and NDA requirements
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">NDA Management</p>
                    <p className="text-sm text-muted-foreground">
                      Collect digital signatures before document access
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Access Tracking</p>
                    <p className="text-sm text-muted-foreground">
                      Monitor who has viewed your documents and when
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-primary" />
                  <CardTitle>Due Diligence Management</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-medium mb-2">Virtual Data Room</p>
                    <p className="text-sm text-muted-foreground">
                      Secure document sharing with granular permissions and audit trails
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Contact Management</p>
                    <p className="text-sm text-muted-foreground">
                      Keep track of all document recipients and NDA signers
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Document Updates</p>
                    <p className="text-sm text-muted-foreground">
                      Update and revise your CIM as needed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-6 w-6 text-primary" />
                  <CardTitle>Closing Support</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-medium mb-2">Export Options</p>
                    <p className="text-sm text-muted-foreground">
                      Export to PDF or Word format for offline use
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Website Integration</p>
                    <p className="text-sm text-muted-foreground">
                      Extract company logos and images from websites automatically
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Professional Results</p>
                    <p className="text-sm text-muted-foreground">
                      Create investment-grade documentation for your clients
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            What Our Users Say
          </h2>
          
          <div className="grid lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-4">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-500">★</span>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4 italic">
                  "CIM Share streamlined our document creation process. The AI assistance and 
                  professional formatting save us significant time."
                </p>
                <p className="text-sm font-medium">Michael Thompson</p>
                <p className="text-xs text-muted-foreground">Thompson Business Advisors</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-4">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-500">★</span>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4 italic">
                  "The NDA protection and secure sharing features give us confidence when 
                  distributing confidential information."
                </p>
                <p className="text-sm font-medium">Sarah Chen</p>
                <p className="text-xs text-muted-foreground">Meridian M&A Partners</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-4">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-500">★</span>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4 italic">
                  "The platform helps us create professional-looking CIMs that impress 
                  our clients and potential buyers."
                </p>
                <p className="text-sm font-medium">Robert Martinez</p>
                <p className="text-xs text-muted-foreground">Premier Business Brokers</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Clear ROI for Your Brokerage
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Time Savings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">CIM Creation</span>
                  <span className="text-sm font-medium">Much Faster</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Document Sharing</span>
                  <span className="text-sm font-medium">Secure & Tracked</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">NDA Processing</span>
                  <span className="text-sm font-medium">Manual → Automated</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Document Updates</span>
                  <span className="text-sm font-medium">Hours → Minutes</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Business Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Document Quality</span>
                  <span className="text-sm font-medium text-green-600">Professional</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">NDA Compliance</span>
                  <span className="text-sm font-medium text-green-600">100% Tracked</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Contact Management</span>
                  <span className="text-sm font-medium text-green-600">Organized</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Data Security</span>
                  <span className="text-sm font-medium text-green-600">Protected</span>
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
              Start Creating Professional CIMs Today
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Create professional CIMs with AI assistance and secure sharing
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="gap-2">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline">
                  Schedule Demo
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Free trial • No credit card required • Full platform access
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}