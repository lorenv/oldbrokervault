import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Target,
  Download,
  FileSignature,
  Eye,
  Calendar,
  UserCheck,
  Settings
} from "lucide-react";
import { useState, useEffect } from "react";

export default function InvestorDatabasePage() {
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
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors duration-300">
              <Database className="h-4 w-4 mr-2" />
              Contact Management System
            </Badge>
            
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-slate-900 leading-tight animate-text-gradient">
              Track and Manage Your Document Recipients
            </h1>
            
            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Keep track of everyone who has signed your NDAs and accessed your documents. 
              Manage your investor contacts and monitor document engagement in one centralized dashboard.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <Database className="mr-2 h-5 w-5" />
                  Access Investor Database
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="border-slate-300 hover:bg-slate-50 hover:scale-105 transition-all duration-300">
                  Schedule Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div
              data-animate-id="benefit-1"
              className={`transition-all duration-700 ${
                isVisible('benefit-1') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="text-center border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group h-full">
                <CardHeader>
                  <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Track Contacts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Centralized contact management across all your CIM documents and NDA signatures</p>
                </CardContent>
              </Card>
            </div>

            <div
              data-animate-id="benefit-2"
              className={`transition-all duration-700 delay-100 ${
                isVisible('benefit-2') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="text-center border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group h-full">
                <CardHeader>
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <BarChart3 className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Analytics & Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Monitor engagement patterns and document access analytics for better follow-up</p>
                </CardContent>
              </Card>
            </div>

            <div
              data-animate-id="benefit-3"
              className={`transition-all duration-700 delay-200 ${
                isVisible('benefit-3') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="text-center border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group h-full">
                <CardHeader>
                  <div className="w-16 h-16 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Download className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Export & Integration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Export contact lists and integrate with your existing CRM systems</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Database Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Database className="h-4 w-4 mr-2" />
              Database Features
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Complete Contact Management</h2>
            <p className="text-xl text-slate-600">
              Everything you need to manage investor relationships and document access
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-3xl font-bold text-slate-900">Automated Contact Collection</h3>
              <p className="text-lg text-slate-600 leading-relaxed">
                Every time someone signs an NDA or accesses your documents, their contact information 
                is automatically captured and organized in your investor database for easy relationship management.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mt-1">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Email & Contact Details</h4>
                    <p className="text-slate-600 text-sm">Automatically captures email addresses, names, and company information from NDA signatures</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Signature Timestamps</h4>
                    <p className="text-slate-600 text-sm">Track when each contact signed NDAs and first accessed your documents</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center mt-1">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Company Information</h4>
                    <p className="text-slate-600 text-sm">Organize contacts by company, role, and document access history</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <Database className="h-6 w-6 text-blue-600" />
                    <span className="font-medium">Contact Database</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>John Smith</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">NDA Signed</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Sarah Johnson</span>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">Viewed Doc</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Mike Chen</span>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">Pending</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter Features */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Advanced Search & Analytics</h2>
            <p className="text-xl text-slate-600">
              Powerful tools to find and analyze your investor contacts
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Search className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Smart Search</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Search by name, company, email, or document access history</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Filter className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Advanced Filters</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Filter by signature status, document type, or engagement level</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Engagement Analytics</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Track document views, time spent, and interaction patterns</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Download className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Export Tools</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Export contact lists to CSV, Excel, or integrate with CRM systems</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Management Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Comprehensive Contact Profiles</h2>
            <p className="text-xl text-slate-600">
              Detailed information about every contact and their document interactions
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Contact Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Complete contact profiles with email addresses, company affiliations, roles, 
                  and all document interaction history in one organized view.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Email Addresses</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Company Info</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Role Tracking</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                    <FileSignature className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">NDA Signature Tracking</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Track which contacts have signed NDAs for which documents, signature dates, 
                  and legal compliance status across your entire document portfolio.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Signature Status</Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Date Tracking</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Legal Compliance</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center">
                    <Eye className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Document Access History</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  See which documents each contact has accessed, when they viewed them, 
                  and how long they spent reviewing your materials.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Access Logs</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Time Tracking</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">View Analytics</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Engagement Scoring</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Automatic engagement scoring based on document access frequency, 
                  time spent reviewing, and interaction patterns for better lead qualification.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Auto-Scoring</Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Lead Qualification</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Interest Tracking</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Export & Integration */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                <Download className="h-4 w-4 mr-2" />
                Export & Integration
              </Badge>
              
              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Export Your Contact Database
              </h2>
              
              <p className="text-lg text-slate-600 leading-relaxed">
                Export your complete contact database with all NDA signatures, document access history, 
                and engagement analytics. Perfect for CRM integration and follow-up campaigns.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mt-1">
                    <Download className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Multiple Export Formats</h4>
                    <p className="text-slate-600 text-sm">Export to CSV, Excel, or JSON formats for easy integration with other systems</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Settings className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Custom Field Selection</h4>
                    <p className="text-slate-600 text-sm">Choose which contact fields and data points to include in your exports</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center mt-1">
                    <Target className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">CRM Integration Ready</h4>
                    <p className="text-slate-600 text-sm">Formatted exports work seamlessly with popular CRM systems like Salesforce and HubSpot</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                    <span className="font-medium">Export Preview</span>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-3 gap-2 font-medium text-slate-700 border-b pb-2">
                      <span>Contact</span>
                      <span>Company</span>
                      <span>Status</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>John Smith</span>
                      <span>Tech Ventures</span>
                      <span className="text-green-600">Signed</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>Sarah Johnson</span>
                      <span>Growth Capital</span>
                      <span className="text-blue-600">Viewed</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span>Mike Chen</span>
                      <span>Equity Partners</span>
                      <span className="text-slate-600">Pending</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Perfect for Investment Professionals</h2>
            <p className="text-xl text-slate-600">
              Built specifically for M&A advisors, business brokers, and investment bankers
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">M&A Advisors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-600 text-sm">
                  Track potential buyers across multiple deals, manage confidentiality agreements, 
                  and maintain relationships for future opportunities.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Multi-deal tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Buyer database</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Business Brokers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-600 text-sm">
                  Manage investor contacts for business sales, track NDA compliance, 
                  and follow up with qualified prospects efficiently.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Prospect management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Follow-up tracking</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Investment Banks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-600 text-sm">
                  Enterprise-level contact management with advanced analytics, 
                  compliance tracking, and institutional investor relationship tools.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Enterprise analytics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Compliance tools</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">How Contact Tracking Works</h2>
            <p className="text-xl text-slate-600">
              Automatic contact collection and organization behind the scenes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">1</span>
                </div>
                <CardTitle className="text-lg">Document Shared</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">You share a CIM document with NDA protection enabled</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <FileSignature className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">NDA Signed</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Recipient signs NDA electronically with contact information captured</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Auto-Added</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Contact automatically added to your investor database with full details</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Track & Analyze</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Monitor engagement and export data for follow-up and relationship building</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-slate-900 border-0 text-white text-center">
          <CardContent className="p-12">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Database className="h-8 w-8 text-white" />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Organize Your Investor Contacts?
            </h2>
            
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Start building valuable investor relationships with automated contact management and engagement tracking.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100">
                  <Database className="mr-2 h-5 w-5" />
                  Start Tracking Contacts
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-400 text-slate-300 hover:bg-slate-800">
                  View Database Features
                </Button>
              </Link>
            </div>
            
            <p className="text-slate-400 text-sm mt-6">
              Automatic contact collection • Export capabilities • CRM integration ready
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
        
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out;
        }
        
        .animate-text-gradient {
          background: linear-gradient(-45deg, #1e293b, #3b82f6, #1e40af, #0f172a);
          background-size: 400% 400%;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: text-gradient 8s ease infinite;
        }
      `}</style>
    </div>
  );
}