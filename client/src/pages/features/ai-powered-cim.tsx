import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Sparkles,
  FileText,
  Zap,
  Brain,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  Target,
  Mic,
  BarChart3,
  AlertCircle,
  Globe,
  Image,
  Download,
  Edit3,
  Users,
  Shield,
  ExternalLink,
  Star,
  LayoutList,
  Share2
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { SEOHead } from "@/components/seo-head";

export default function AiPoweredCimPage() {
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
        title="AI-Powered CIM Generator - Create Professional CIMs in Minutes"
        description="Create professional Confidential Information Memorandums (CIMs) in minutes with AI. Transform meeting transcripts and website data into investment-grade documents automatically."
        canonicalUrl="https://brokervault.ai/features/ai-powered-cim"
      />
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors duration-300">
              <Sparkles className="h-4 w-4 mr-2" />
              AI-Powered Document Generation
            </Badge>
            
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 pb-1 text-slate-900 leading-tight animate-text-gradient">
              Create Professional CIMs in Minutes
            </h1>
            
            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Transform business meeting transcripts, website data, and company information into professional Confidential Information Memorandums using advanced AI technology.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <Zap className="mr-2 h-5 w-5" />
                  Try AI CIM Generator
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

      {/* Video Walkthrough Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">See It In Action</h2>
            <p className="text-lg text-slate-600">Watch how easy it is to create a professional CIM with AI assistance</p>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200 mb-12 bg-slate-900 aspect-video">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/0sAqXGDRUHQ"
              title="CIM Creation Walkthrough"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Live Examples */}
          <div className="text-center mb-8">
            <Badge className="mb-4 bg-green-100 text-green-700 border border-green-200">
              <Globe className="h-3 w-3 mr-1" />
              Live Examples
            </Badge>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Explore Real AI-Generated Content</h3>
            <p className="text-slate-600 max-w-2xl mx-auto">
              See the quality and professionalism of CIMs, teasers, and listings created with our AI platform. These are real examples you can explore right now.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Tony's Transmissions Image Card */}
            <div
              className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-4 hover:rotate-1 transition-all duration-500 cursor-pointer group"
              onClick={() => window.open("https://brokervault.ai/share/cim-q3bqjm", "_blank")}
            >
              <img
                src="/tonys-transmissions-preview.png"
                alt="Tony's Transmissions CIM Document Preview"
                loading="lazy"
                className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-4 right-4">
                <div className="text-sm text-blue-600 font-medium bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                  Live Example
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0 drop-shadow-lg">
                  Click to view full CIM document →
                </p>
              </div>
            </div>

            {/* Arbor Partners Image Card */}
            <div
              className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-4 hover:-rotate-1 transition-all duration-500 cursor-pointer group"
              onClick={() => window.open("https://brokervault.ai/share/cim-2axr79", "_blank")}
            >
              <img
                src="/arbor-partners-preview.png"
                alt="Arbor Partners CIM Document Preview"
                loading="lazy"
                className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-4 right-4">
                <div className="text-sm text-green-600 font-medium bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                  Live Example
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0 drop-shadow-lg">
                  Click to view full CIM document →
                </p>
              </div>
            </div>

            {/* Public Listings Page Card */}
            <div
              className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-4 hover:rotate-1 transition-all duration-500 cursor-pointer group"
              onClick={() => window.open("https://brokervault.ai/listings/dealve-inc", "_blank")}
            >
              <div className="aspect-[4/3] bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 flex flex-col items-center justify-center p-6 group-hover:scale-105 transition-transform duration-500">
                <Globe className="w-16 h-16 text-white/90 mb-4" />
                <h3 className="text-white font-bold text-lg text-center mb-2">Public Listings Page</h3>
                <p className="text-white/80 text-sm text-center">Browse deals in a branded marketplace</p>
              </div>
              <div className="absolute top-4 right-4">
                <div className="text-sm text-cyan-600 font-medium bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                  Live Example
                </div>
              </div>
              <div className="absolute top-4 left-4">
                <div className="text-xs text-white font-bold bg-green-500 px-2 py-1 rounded-full shadow-sm">
                  NEW
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0 drop-shadow-lg">
                  Click to view listings page →
                </p>
              </div>
            </div>

            {/* Teaser Example Card */}
            <div
              className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-4 hover:-rotate-1 transition-all duration-500 cursor-pointer group"
              onClick={() => window.open("https://brokervault.ai/teaser/prominent-food-beverage-business-with-strong-marke-2ea50f", "_blank")}
            >
              <div className="aspect-[4/3] bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex flex-col items-center justify-center p-6 group-hover:scale-105 transition-transform duration-500">
                <FileText className="w-16 h-16 text-white/90 mb-4" />
                <h3 className="text-white font-bold text-lg text-center mb-2">AI-Generated Teaser</h3>
                <p className="text-white/80 text-sm text-center">Anonymous preview before NDA</p>
              </div>
              <div className="absolute top-4 right-4">
                <div className="text-sm text-purple-600 font-medium bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                  Live Example
                </div>
              </div>
              <div className="absolute top-4 left-4">
                <div className="text-xs text-white font-bold bg-green-500 px-2 py-1 rounded-full shadow-sm">
                  NEW
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0 drop-shadow-lg">
                  Click to view teaser →
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits Grid */}
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
                    <Clock className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">10x Faster</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Generate professional CIMs in minutes instead of hours or days</p>
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
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">AI-Enhanced</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Advanced AI structures and formats your business information intelligently</p>
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
                    <Target className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Professional Quality</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Investment-grade documents that impress stakeholders and close deals</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Website Integration Feature */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                <Globe className="h-4 w-4 mr-2" />
                Website Intelligence
              </Badge>
              
              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Automatic Website Data Extraction
              </h2>
              
              <p className="text-lg text-slate-600 leading-relaxed">
                Simply provide a company's website URL and our AI automatically extracts key business information, 
                company logos, images, and relevant data to enhance your CIM's written material. No manual research required.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mt-1">
                    <Globe className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Company Information</h4>
                    <p className="text-slate-600 text-sm">Automatically extracts business descriptions, services, and key information from company websites</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Image className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Logo & Branding</h4>
                    <p className="text-slate-600 text-sm">Pulls company logos and branding elements to maintain professional presentation</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center mt-1">
                    <BarChart3 className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Business Intelligence</h4>
                    <p className="text-slate-600 text-sm">Analyzes website content to understand business model, market position, and key differentiators</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <Globe className="h-6 w-6 text-blue-600" />
                    <span className="font-medium">Website Analysis</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Company logo extracted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Business description analyzed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Key services identified</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Market positioning extracted</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Zap className="h-4 w-4 mr-2" />
              AI Workflow
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">How AI Powers Your CIM Creation</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Our intelligent system transforms raw business data into professional documentation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">1</span>
                </div>
                <CardTitle className="text-lg">Input Data</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Upload transcripts, website URLs, or business information</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">AI Analysis</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">AI processes and structures your business information intelligently</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Edit3 className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Format & Structure</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Professional formatting with industry-standard CIM sections</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Professional Output</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Investment-grade CIM ready for customization and sharing</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Capabilities Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Advanced AI Capabilities</h2>
            <p className="text-xl text-slate-600">
              Sophisticated technology that understands business documentation
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Mic className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Meeting Transcript Analysis</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Upload meeting recordings or transcripts and our AI extracts key business information, 
                  financial data, and strategic insights to create comprehensive CIM sections.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Revenue Recognition</Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Market Analysis</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Growth Strategy</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Website Intelligence</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Simply provide a company website URL and our AI automatically extracts business descriptions, 
                  company logos, service offerings, and market positioning to enhance your CIM's content.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Logo Extraction</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Business Info</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Auto-Enhancement</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Financial Data Processing</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  AI identifies and structures financial information into professional formats with 
                  proper categorization, trend analysis, and investor-ready presentation.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Revenue Analysis</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Growth Metrics</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Projections</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Document Structuring</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Automatically organizes information into standard CIM sections including executive summary, 
                  business overview, financials, and investment highlights with professional formatting.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Auto-Sections</Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Smart Format</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Pro Layout</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Before/After Comparison */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Traditional vs AI-Powered CIM Creation</h2>
            <p className="text-xl text-slate-600">See the difference AI makes in speed and quality</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Traditional Method */}
            <Card className="border-2 border-red-200 bg-red-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl text-red-700">Traditional Method</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-red-600" />
                    <span className="text-slate-700">5-10 hours of manual work</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-red-600" />
                    <span className="text-slate-700">Requires formatting expertise</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-red-600" />
                    <span className="text-slate-700">Inconsistent quality</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Target className="h-4 w-4 text-red-600" />
                    <span className="text-slate-700">Manual research required</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI-Powered Method */}
            <Card className="border-2 border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl text-green-700">AI-Powered Method</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700">15-30 minutes total time</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Brain className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700">No formatting expertise needed</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700">Consistent professional quality</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700">Automatic website data extraction</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Deep Dive */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Advanced AI Features</h2>
            <p className="text-xl text-slate-600">
              Cutting-edge technology designed for investment professionals
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-slate-900">Natural Language Processing</h3>
                  <p className="text-slate-600">
                    Advanced NLP understands business context, extracts key metrics, and identifies 
                    important investment highlights from unstructured text.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-slate-900">Intelligent Categorization</h3>
                  <p className="text-slate-600">
                    Automatically categorizes business information into appropriate CIM sections 
                    based on investment banking standards and best practices.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-slate-900">Market Analysis</h3>
                  <p className="text-slate-600">
                    AI analyzes market positioning, competitive advantages, and growth opportunities 
                    to create compelling investment narratives.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
              <h3 className="text-2xl font-bold mb-6 text-center text-slate-900">What Our AI Extracts</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Company overview and business model</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Financial performance and metrics</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Market position and competitive advantages</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Growth opportunities and projections</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Risk factors and mitigation strategies</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Investment highlights and value proposition</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Teasers & Listings Section */}
      <section className="container mx-auto px-4 py-20 bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-purple-100 text-purple-700 border border-purple-200">
            <Share2 className="h-3 w-3 mr-1" />
            Marketing & Distribution
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            From CIM to Marketing in Seconds
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Our AI doesn't stop at CIM creation. Automatically generate one-page teasers
            and build your own public listings page to showcase deals.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* AI Teasers Card */}
          <Card className="bg-white shadow-lg border border-slate-200 overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">AI-Generated Teasers</h3>
                    <p className="text-purple-100 text-sm">One-page marketing summaries</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-4">
                  Automatically generate compelling one-page teasers from your CIM content.
                  Perfect for initial outreach and sparking buyer interest.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">Auto-generated from CIM data</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">Custom cover images from Unsplash or uploads</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">Public shareable links</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">NDA capture before full CIM access</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                    <span className="text-slate-700">Feature top listings for visibility</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Public Listings Page Card */}
          <Card className="bg-white shadow-lg border border-slate-200 overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <LayoutList className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Public Listings Page</h3>
                    <p className="text-slate-300 text-sm">Your branded deal showcase</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-slate-600 mb-4">
                  Create a professional public listings page that aggregates all your published
                  teasers—essentially your own listings website in minutes.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">Custom URL (yourcompany.brokervault.ai)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">Your logo, banner, and branding</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">Filter by industry, deal type, price range</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">Grid or list layout options</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-slate-700">SEO-optimized for buyer discovery</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-10">
          <p className="text-slate-600 mb-4">
            Turn every CIM into a marketing asset and build your deal pipeline faster.
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
              <Sparkles className="mr-2 h-5 w-5" />
              Start Creating Teasers
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-slate-900 border-0 text-white text-center">
          <CardContent className="p-12">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Experience AI-Powered CIM Creation?
            </h2>
            
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Join thousands of investment professionals who save hours every week with our AI technology.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100">
                  <Zap className="mr-2 h-5 w-5" />
                  Start Creating CIMs
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" className="bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300">
                  View Pricing Plans
                </Button>
              </Link>
            </div>
            
            <p className="text-slate-400 text-sm mt-6">
              No credit card required • Start with our free trial
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