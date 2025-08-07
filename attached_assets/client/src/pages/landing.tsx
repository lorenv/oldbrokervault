import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Shield, Clock, CheckCircle, ArrowRight, PenTool } from "lucide-react";
import undersignedLogo from "../assets/undersigned-logo.png";

export default function Landing() {
  const features = [
    {
      icon: FileText,
      title: "Document Management",
      description: "Upload and manage PDF and Word documents with ease"
    },
    {
      icon: Users,
      title: "Multi-Signer Support",
      description: "Add multiple recipients with custom signing order"
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Bank-level security with full audit trail"
    },
    {
      icon: Clock,
      title: "Fast Processing",
      description: "Documents processed and ready for signing in seconds"
    }
  ];

  const benefits = [
    "Create professional document workflows",
    "Track signing progress in real-time",
    "Automated email notifications",
    "Template system for recurring documents",
    "Complete audit trail for compliance"
  ];

  return (
    <div className="min-h-screen ink-flow document-texture">
      {/* Header */}
      <header className="glass-card border-none sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 floating">
              <PenTool className="h-8 w-8 text-ink-violet" />
              <img src={undersignedLogo} alt="Undersigned" className="h-12 w-auto" />
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" className="ink-ripple" asChild>
                <a href="/login">Sign In</a>
              </Button>
              <Button className="signature-gradient text-white border-none shadow-lg hover:shadow-xl transition-all duration-300" asChild>
                <a href="/login">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-violet/5 via-signature-gold/5 to-seal-emerald/5"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="floating">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-ink-violet via-ink-violet-dark to-document-gray-dark bg-clip-text text-transparent mb-6">
              Professional E-Signature Platform
            </h1>
          </div>
          <p className="text-xl text-document-gray-dark/80 mb-8 max-w-2xl mx-auto leading-relaxed">
            Streamline your document signing process with our secure, sophisticated e-signature platform. 
            Experience the elegance of digital signatures with unmatched security.
          </p>
          <div className="flex items-center justify-center space-x-6">
            <Button size="lg" className="signature-gradient text-white border-none shadow-xl hover:shadow-2xl transition-all duration-500 px-8 py-4 text-lg font-semibold" asChild>
              <a href="/login" className="flex items-center">
                Start Free Trial <ArrowRight className="ml-3 h-5 w-5" />
              </a>
            </Button>
            <Button variant="outline" size="lg" className="glass-card border-ink-violet/20 text-ink-violet hover:bg-ink-violet/5 px-8 py-4 text-lg">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 glass-card border-none">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-ink-violet to-document-gray-dark bg-clip-text text-transparent mb-6">
              Everything you need for e-signatures
            </h2>
            <p className="text-lg text-document-gray-dark/70 max-w-2xl mx-auto leading-relaxed">
              From document upload to completion, we provide all the tools you need for professional document workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center glass-card border-none ink-ripple group hover:scale-105 transition-all duration-300">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 signature-gradient rounded-2xl flex items-center justify-center mb-6 group-hover:animate-floating">
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-lg text-ink-violet-dark">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-document-gray-dark/70 leading-relaxed">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                Why choose Undersigned?
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                Built for businesses that value efficiency, security, and professionalism. 
                Our platform handles everything from simple agreements to complex multi-party contracts.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Ready to get started?</h3>
                <p className="text-slate-600 mb-6">
                  Join thousands of businesses already using Undersigned for their document workflows.
                </p>
                <Button size="lg" className="w-full" asChild>
                  <a href="/login">Create Your Account</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <PenTool className="h-8 w-8 text-white" />
                <img 
                  src={undersignedLogo} 
                  alt="Undersigned" 
                  className="h-10 w-auto brightness-0 invert" 
                />
              </div>
              <p className="text-slate-400 text-sm">
                Professional e-signature platform for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
                <li><a href="#" className="hover:text-white">Integrations</a></li>
                <li><a href="#" className="hover:text-white">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Status</a></li>
                <li><a href="#" className="hover:text-white">Contact Support</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm text-slate-400">
            <p>&copy; 2025 Undersigned. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}