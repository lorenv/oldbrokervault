import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle,
  Upload,
  Settings,
  UserCheck,
  FileText,
  Download,
  Share2,
  Key,
  Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import { SEOHead } from "@/components/seo-head";
import { LazyVideo } from "@/components/ui/lazy-video";

export default function NdaProtectionPage() {
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-animate-id');
          if (entry.isIntersecting && id) {
            setVisibleElements(prev => new Set([...prev, id]));
          }
        });
      },
      { threshold: 0.1, rootMargin: '-50px 0px -50px 0px' }
    );

    const elementsToObserve = document.querySelectorAll('[data-animate-id]');
    elementsToObserve.forEach(el => observer.observe(el));

    return () => elementsToObserve.forEach(el => observer.unobserve(el));
  }, []);

  const isVisible = (id: string) => visibleElements.has(id);

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="NDA Protection - Secure Document Sharing with Built-in NDAs"
        description="Protect your confidential business information with built-in NDA management. Require signed NDAs before document access, track viewer activity, and maintain full control over your sensitive deal documents."
        canonicalUrl="https://brokervault.ai/features/nda-protection"
      />
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors duration-300">
              <Shield className="h-4 w-4 mr-2" />
              Enterprise-Grade Security
            </Badge>
            
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 pb-1 text-slate-900 leading-tight animate-text-gradient">
              Protect Your Business Information
            </h1>
            
            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Share CIM documents with complete confidence using integrated NDA protection, digital signatures, 
              and flexible sharing controls. You choose who sees what, when, and how.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <Shield className="mr-2 h-5 w-5" />
                  Start Secure Sharing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="https://meetings-na2.hubspot.com/rob-kale" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-slate-300 hover:bg-slate-50 hover:scale-105 transition-all duration-300">
                  Book a Demo
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">See It In Action</h2>
            <p className="text-lg text-slate-600">Watch how NDA protection keeps your documents secure</p>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
            <LazyVideo
              src="/ndamanagement.mp4"
              className="w-full"
              autoPlay
              muted
              loop
              playsInline
            />
          </div>
        </div>
      </section>

      {/* Flexible Sharing Options */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Share2 className="h-4 w-4 mr-2" />
              Sharing Control
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">
              You Control How Your CIMs Are Shared
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Choose between open sharing or NDA-protected access based on your security needs
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Open Sharing */}
            <div
              data-animate-id="sharing-1"
              className={`transition-all duration-700 ${
                isVisible('sharing-1') ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
              }`}
            >
              <Card className="border border-slate-200 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Eye className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Open Sharing</CardTitle>
                      <p className="text-sm text-slate-600">No NDA required</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-600">
                    Share your CIM publicly with a simple link. Perfect for marketing materials, 
                    general business information, or when confidentiality isn't a concern.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Instant access via link</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">No barriers to viewing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">View tracking included</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700 font-medium">Best for: Marketing materials, public company info</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* NDA Protected */}
            <div
              data-animate-id="sharing-2"
              className={`transition-all duration-700 delay-200 ${
                isVisible('sharing-2') ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
              }`}
            >
              <Card className="border-2 border-slate-900 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group h-full relative">
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white border-0 animate-gentle-pulse">
                  Recommended
                </Badge>
                <CardHeader className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">NDA Protected</CardTitle>
                      <p className="text-sm text-slate-600">Maximum security</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-600">
                    Require NDA signature before document access. Perfect for sensitive financial information, 
                    strategic plans, or any confidential business data that needs legal protection.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Legal NDA protection</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Digital signature tracking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Complete audit trail</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Legal enforceability</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-700 font-medium">Best for: M&A deals, financial data, strategic info</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* NDA Template Management */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                <Upload className="h-4 w-4 mr-2" />
                Custom Templates
              </Badge>
              
              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Upload Your Own NDA Templates
              </h2>
              
              <p className="text-lg text-slate-600 leading-relaxed">
                Use your company's existing NDA templates or choose from our professionally drafted options. 
                Upload any PDF document and position signature fields exactly where you need them.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mt-1">
                    <Upload className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Upload Custom Templates</h4>
                    <p className="text-slate-600 text-sm">Upload your company's PDF NDA templates and customize signature fields</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Settings className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Drag & Drop Editor</h4>
                    <p className="text-slate-600 text-sm">Position signature, name, date, and text fields with our visual editor</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center mt-1">
                    <FileCheck className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Professional Templates</h4>
                    <p className="text-slate-600 text-sm">Choose from our library of attorney-drafted NDA templates</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <FileSignature className="h-6 w-6 text-blue-600" />
                    <span className="font-medium">Template Editor</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>PDF template uploaded</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Signature fields positioned</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Ready for deployment</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Lock className="h-4 w-4 mr-2" />
              Security Features
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Bank-Level Document Security</h2>
            <p className="text-xl text-slate-600">
              Multiple layers of protection for your most sensitive business information
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FileSignature className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Digital Signatures</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">Legally binding electronic signatures with full audit trails and timestamps</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Access Control</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">Control who can view documents with email verification and approval workflows</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Eye className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Activity Tracking</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">Monitor who accessed your documents, when, and for how long</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Sharing Options Comparison */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Choose Your Sharing Level</h2>
            <p className="text-xl text-slate-600">Complete control over document access and protection</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Public Sharing */}
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Share2 className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Public Sharing</CardTitle>
                <p className="text-sm text-slate-600">Open access via link</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Instant access</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">No sign-up required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">View tracking included</span>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">Best for: Marketing materials, public company info</p>
                </div>
              </CardContent>
            </Card>

            {/* Password Protected */}
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Key className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Password Protected</CardTitle>
                <p className="text-sm text-slate-600">Simple password access</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Password required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Basic protection</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Access logging</span>
                </div>
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-700 font-medium">Best for: Internal sharing, preliminary reviews</p>
                </div>
              </CardContent>
            </Card>

            {/* Full NDA Protection */}
            <Card className="border-2 border-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300 relative">
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white border-0">
                Most Secure
              </Badge>
              <CardHeader className="text-center pt-6">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Full NDA Protection</CardTitle>
                <p className="text-sm text-slate-600">Maximum security</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Legal NDA required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Digital signature verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Complete audit trail</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Legal enforceability</span>
                </div>
                <div className="mt-4 p-3 bg-slate-100 rounded-lg border border-slate-300">
                  <p className="text-xs text-slate-700 font-medium">Best for: M&A deals, financial data, strategic info</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* NDA Management Features */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Complete NDA Management</h2>
            <p className="text-xl text-slate-600">
              Everything you need to manage NDAs from signature to enforcement
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <FileSignature className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Digital Signature Collection</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Streamlined e-signature process with email notifications, reminders, and automatic completion tracking. 
                  Signatures are legally binding and include timestamp verification.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">E-Signatures</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Email Notifications</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Auto-Tracking</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Signer Management</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Track all NDA signers across your documents with comprehensive contact management, 
                  signature status, and document access history in one central dashboard.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Contact Tracking</Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Status Updates</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Access History</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Audit Trail & Compliance</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Complete audit trails for legal compliance including signature timestamps, IP addresses, 
                  document versions, and access logs for regulatory requirements.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Timestamped</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">IP Tracking</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Legal Compliance</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Flexible Controls</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Set expiration dates, limit access by email domain, require approval workflows, 
                  and customize NDA terms for different types of documents and recipients.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Expiration Dates</Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Email Restrictions</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Custom Terms</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How NDA Protection Works */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">How NDA Protection Works</h2>
            <p className="text-xl text-slate-600">
              Simple workflow that ensures legal protection every step of the way
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">1</span>
                </div>
                <CardTitle className="text-lg">Toggle Protection</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Simply toggle NDA protection on/off when sharing your CIM</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Choose Template</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Select from professional templates or upload your own custom NDA</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <FileSignature className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Digital Signing</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Recipients sign electronically before accessing your confidential documents</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Track & Monitor</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Monitor all access with detailed analytics and legal audit trails</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="container mx-auto px-4 py-16 bg-gradient-to-br from-slate-50 to-green-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-green-100 text-green-700 border border-green-200">
              <Zap className="h-4 w-4 mr-2" />
              Automations & Integrations
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Automate Your NDA Workflows</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Connect NDA signature events to your favorite tools. Automatically update your CRM when NDAs are signed, notify your team, or trigger custom workflows.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardContent className="p-6 text-center">
                <img src="/hubspot.png" alt="HubSpot" loading="lazy" className="h-12 mx-auto mb-4 object-contain" />
                <h3 className="font-semibold text-slate-900 mb-2">HubSpot</h3>
                <p className="text-sm text-slate-600">
                  Automatically update contact status or create deals when NDAs are signed.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardContent className="p-6 text-center">
                <img src="/slack.png" alt="Slack" loading="lazy" className="h-12 mx-auto mb-4 object-contain" />
                <h3 className="font-semibold text-slate-900 mb-2">Slack</h3>
                <p className="text-sm text-slate-600">
                  Get instant notifications when investors sign NDAs and are ready to view your CIM.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardContent className="p-6 text-center">
                <img src="/zapier-icon.svg" alt="Zapier" loading="lazy" className="h-12 mx-auto mb-4 object-contain" />
                <h3 className="font-semibold text-slate-900 mb-2">Zapier</h3>
                <p className="text-sm text-slate-600">
                  Connect to 5,000+ apps and automate any workflow when NDA events occur.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <Link href="/features/integrations">
              <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                Explore All Integrations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-slate-900 border-0 text-white text-center">
          <CardContent className="p-12">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Protect Your Business Information?
            </h2>
            
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Start sharing your confidential documents with complete legal protection and peace of mind.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100">
                  <Shield className="mr-2 h-5 w-5" />
                  Start Secure Sharing
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" className="bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300">
                  View Security Features
                </Button>
              </Link>
            </div>
            
            <p className="text-slate-400 text-sm mt-6">
              Bank-level security • Legally binding NDAs • Complete audit trails
            </p>
          </CardContent>
        </Card>
      </section>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fade-in-up {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes text-gradient {
          0%, 100% { 
            background-position: 0% 50%;
          }
          50% { 
            background-position: 100% 50%;
          }
        }
        
        @keyframes gentle-pulse {
          0%, 100% { 
            transform: scale(1);
          }
          50% { 
            transform: scale(1.02);
          }
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out;
        }
        
        .animate-text-gradient {
          background: linear-gradient(-45deg, #1e293b, #059669, #0d9488, #0f172a);
          background-size: 400% 400%;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: text-gradient 8s ease infinite;
        }
        
        .animate-gentle-pulse {
          animation: gentle-pulse 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}