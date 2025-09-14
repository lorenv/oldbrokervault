import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  Shield, 
  Palette, 
  Download, 
  Zap, 
  Database, 
  FileText, 
  Lock, 
  Sparkles,
  Globe,
  Smartphone,
  BarChart3,
  PenTool,
  X,
  Briefcase,
  Building,
  CheckCircle
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function HomePage() {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set());
  const [scrollY, setScrollY] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer for scroll animations
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-animate-id');
          if (entry.isIntersecting && id) {
            setVisibleElements(prev => new Set([...prev, id]));
          }
        });
      },
      { 
        threshold: 0.1,
        rootMargin: '-50px 0px -50px 0px'
      }
    );

    // Observe all elements with data-animate-id
    const elementsToObserve = document.querySelectorAll('[data-animate-id]');
    elementsToObserve.forEach(el => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  // Helper function to check if element is visible
  const isVisible = (id: string) => visibleElements.has(id);
  const features = [
    {
      icon: Shield,
      title: "NDA Protection",
      description: "Built-in confidentiality agreements with secure document sharing and password protection.",
      color: "text-green-500",
      link: "/features/nda-protection"
    },
    {
      icon: Palette,
      title: "Fully Customizable",
      description: "Tailor every section, add your company branding, and control document layout with drag-and-drop editing.",
      color: "text-blue-500"
    },
    {
      icon: Download,
      title: "PDF Export",
      description: "Export to professional PDF format with formatting that maintains your brand identity.",
      color: "text-purple-500"
    },
    {
      icon: Zap,
      title: "AI-Powered Analysis",
      description: "Extract information from websites, summarize business transcripts, and structure data into professional documents using advanced AI technology.",
      color: "text-orange-500",
      link: "/features/ai-powered-cim"
    },
    {
      icon: Database,
      title: "Investor Database",
      description: "Track and manage investor contacts across all documents with comprehensive NDA signature management.",
      color: "text-indigo-500",
      link: "/features/investor-database"
    },

    {
      icon: Lock,
      title: "Enterprise Security",
      description: "Bank-level encryption, secure hosting, and compliance with industry data protection standards.",
      color: "text-red-500"
    },
    {
      icon: PenTool,
      title: "Digital Signatures",
      description: "Secure electronic signature collection with NDA management, approval workflows, and comprehensive audit trails.",
      color: "text-yellow-500"
    },
    {
      icon: Globe,
      title: "Website Integration",
      description: "Extract company logos and images from websites to enhance your CIM documents automatically.",
      color: "text-cyan-500"
    },
    {
      icon: Smartphone,
      title: "Mobile Responsive",
      description: "Access and edit your CIM documents from any device with our responsive web interface.",
      color: "text-pink-500"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-cyan-400 via-blue-500 via-purple-500 via-pink-500 to-orange-400 pt-32 pb-20 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Text content */}
            <div className="text-center lg:text-left animate-fade-in-up">
              <h1 
                className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 text-white leading-tight pb-2" 
                style={{
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                Create a CIM in Minutes,
                <br />
                Not Days
              </h1>
              <p className="text-base sm:text-xl text-white/90 mb-6 sm:mb-8 max-w-2xl transform transition-all duration-1000 delay-200 ease-out">
                Build detailed CIMs with AI, then share with an NDA in no time.
              </p>
              <div className="transform transition-all duration-1000 delay-400 ease-out">
                <Link href="/login">
                  <Button size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 hover:scale-105 hover:shadow-xl transition-all duration-300">
                    Create a Free CIM
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right side - Computer/Phone Image */}
            <div className="relative mt-8 lg:mt-0">
              <div className="relative">
                <img 
                  src="/hero-computer.png" 
                  alt="CIM Share platform showing professional business documentation with laptop and mobile views"
                  className="w-full h-auto object-contain animate-gentle-float hover:scale-105 transition-transform duration-700 ease-out max-w-sm mx-auto lg:max-w-none"
                  onError={(e) => {
                    // Fallback to existing mobile mockup if hero-computer.png doesn't exist
                    e.currentTarget.src = '/mobile-mockup.png';
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Floating Icons Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large floating icons */}
          <div className="absolute top-20 left-10 animate-bounce" style={{animationDelay: '0s', animationDuration: '3s'}}>
            <Shield className="w-8 h-8 text-white/20" />
          </div>
          <div className="absolute top-32 right-16 animate-bounce" style={{animationDelay: '1s', animationDuration: '4s'}}>
            <FileText className="w-10 h-10 text-white/25" />
          </div>
          <div className="absolute top-40 left-1/4 animate-bounce" style={{animationDelay: '2s', animationDuration: '3.5s'}}>
            <Lock className="w-6 h-6 text-white/20" />
          </div>
          <div className="absolute bottom-20 left-20 animate-bounce" style={{animationDelay: '0.5s', animationDuration: '4.5s'}}>
            <Download className="w-7 h-7 text-white/25" />
          </div>
          <div className="absolute bottom-32 right-20 animate-bounce" style={{animationDelay: '1.5s', animationDuration: '3s'}}>
            <Database className="w-9 h-9 text-white/20" />
          </div>
          <div className="absolute top-1/2 right-10 animate-bounce" style={{animationDelay: '2.5s', animationDuration: '4s'}}>
            <Zap className="w-8 h-8 text-white/25" />
          </div>
          
          {/* Sparkle particles */}
          <div className="absolute top-16 left-1/3 animate-pulse" style={{animationDelay: '0s', animationDuration: '2s'}}>
            <Sparkles className="w-4 h-4 text-white/30" />
          </div>
          <div className="absolute top-28 right-1/3 animate-pulse" style={{animationDelay: '1s', animationDuration: '2.5s'}}>
            <Sparkles className="w-3 h-3 text-white/25" />
          </div>
          <div className="absolute bottom-24 left-1/2 animate-pulse" style={{animationDelay: '1.5s', animationDuration: '2s'}}>
            <Sparkles className="w-5 h-5 text-white/20" />
          </div>
          <div className="absolute top-3/4 left-16 animate-pulse" style={{animationDelay: '0.5s', animationDuration: '3s'}}>
            <Sparkles className="w-4 h-4 text-white/25" />
          </div>
          <div className="absolute top-1/4 right-1/4 animate-pulse" style={{animationDelay: '2s', animationDuration: '2.5s'}}>
            <Sparkles className="w-3 h-3 text-white/30" />
          </div>
          
          {/* Additional floating elements */}
          <div className="absolute top-1/3 left-1/6 animate-bounce" style={{animationDelay: '3s', animationDuration: '5s'}}>
            <Globe className="w-6 h-6 text-white/20" />
          </div>
          <div className="absolute bottom-1/3 right-1/6 animate-bounce" style={{animationDelay: '2.5s', animationDuration: '4.5s'}}>
            <PenTool className="w-7 h-7 text-white/25" />
          </div>
          <div className="absolute top-1/2 left-1/2 animate-pulse" style={{animationDelay: '1.8s', animationDuration: '3.5s'}}>
            <BarChart3 className="w-5 h-5 text-white/15" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div 
            className={`text-center mb-12 sm:mb-16 transition-all duration-1000 ${
              isVisible('features-header') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
            data-animate-id="features-header"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Complete CIM Solution</h2>
            <p className="text-base sm:text-xl text-gray-600 max-w-2xl mx-auto px-2">
              From AI-powered analysis to secure sharing, we've built everything you need for professional business documentation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                data-animate-id={`feature-${index}`}
                className={`transition-all duration-700 ${
                  isVisible(`feature-${index}`) 
                    ? 'translate-y-0 opacity-100' 
                    : 'translate-y-8 opacity-0'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <Card className="border-0 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group h-full">
                  <CardHeader className="p-4 sm:p-6">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${feature.color} group-hover:scale-110 transition-transform duration-300`} />
                    </div>
                    <CardTitle className="text-lg sm:text-xl font-semibold group-hover:text-blue-600 transition-colors duration-300">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 flex-1 flex flex-col">
                    <p className="text-gray-600 text-sm sm:text-base flex-1">{feature.description}</p>
                    {feature.link && (
                      <Link href={feature.link}>
                        <Button variant="link" className="mt-3 p-0 h-auto font-medium group-hover:translate-x-1 transition-transform duration-300">
                          Learn more →
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div 
            className={`max-w-4xl mx-auto text-center transition-all duration-1000 ${
              isVisible('testimonial') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
            data-animate-id="testimonial"
          >
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 md:p-12 shadow-lg">
              <blockquote className="text-xl md:text-2xl text-gray-700 font-medium leading-relaxed mb-6">
                "I used to have my team create my CIMs and it would take days. Now they're created in minutes, with AI grabbing info and formatting tables and everything. Total game-changer."
              </blockquote>
              <div className="text-gray-500 text-sm">
                — CIM Share User
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-10 left-10 w-20 h-20 bg-blue-200 rounded-full animate-float-slow"></div>
          <div className="absolute top-1/3 right-20 w-16 h-16 bg-indigo-200 rounded-full animate-float-delayed"></div>
          <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-purple-200 rounded-full animate-float-slow"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div 
            className={`text-center mb-16 transition-all duration-1000 ${
              isVisible('showcase-header') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
            data-animate-id="showcase-header"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Advanced Analytics & Controls</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Track every interaction, manage NDAs seamlessly, and build relationships with comprehensive investor analytics
            </p>
          </div>

          <div className="max-w-7xl mx-auto space-y-20">
            {/* Investor Database Feature - Image Left, Text Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div 
                className={`bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-500 group ${
                  isVisible('showcase-1') ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
                }`}
                data-animate-id="showcase-1"
                onClick={() => setEnlargedImage("/investor-database-preview.png")}
              >
                <img 
                  src="/investor-database-preview.png" 
                  alt="Investor Database Interface"
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div 
                className={`space-y-6 transition-all duration-1000 delay-200 ${
                  isVisible('showcase-1') ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                }`}
              >
                <h3 className="text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors duration-300">Investor Database</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Track investor contacts across all documents with analytics and export capabilities. 
                  Manage relationships with comprehensive contact tracking and automated data collection.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors duration-300 cursor-pointer">Contact Tracking</span>
                  <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium hover:bg-green-200 transition-colors duration-300 cursor-pointer">Export Tools</span>
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium hover:bg-purple-200 transition-colors duration-300 cursor-pointer">Relationship Management</span>
                </div>
              </div>
            </div>

            {/* NDA Signatures Feature - Text Left, Image Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div 
                className={`space-y-6 lg:order-1 transition-all duration-1000 ${
                  isVisible('showcase-2') ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
                }`}
                data-animate-id="showcase-2"
              >
                <h3 className="text-3xl font-bold text-gray-900 hover:text-red-600 transition-colors duration-300">NDA Management</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Digital signatures, approval controls, and comprehensive audit trails for legal compliance. 
                  Streamline your NDA process with automated workflows and tracking.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-medium hover:bg-red-200 transition-colors duration-300 cursor-pointer">Digital Signatures</span>
                  <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium hover:bg-yellow-200 transition-colors duration-300 cursor-pointer">Approval Controls</span>
                  <span className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium hover:bg-indigo-200 transition-colors duration-300 cursor-pointer">Audit Trails</span>
                </div>
              </div>
              <div 
                className={`bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-500 lg:order-2 group ${
                  isVisible('showcase-2') ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                }`}
                style={{ transitionDelay: '200ms' }}
                onClick={() => setEnlargedImage("/nda-signatures-preview.png")}
              >
                <img 
                  src="/nda-signatures-preview.png" 
                  alt="NDA Signatures Management"
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Analytics Feature - Image Left, Text Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div 
                className={`bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-500 group ${
                  isVisible('showcase-3') ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
                }`}
                data-animate-id="showcase-3"
                onClick={() => setEnlargedImage("/analytics-preview.png")}
              >
                <img 
                  src="/analytics-preview.png" 
                  alt="Analytics Dashboard"
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div 
                className={`space-y-6 transition-all duration-1000 delay-200 ${
                  isVisible('showcase-3') ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                }`}
              >
                <h3 className="text-3xl font-bold text-gray-900 hover:text-teal-600 transition-colors duration-300">Analytics Dashboard</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Comprehensive analytics with activity tracking, conversion metrics, and detailed reporting. 
                  Make data-driven decisions with powerful insights into document performance.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-teal-100 text-teal-800 rounded-full text-sm font-medium hover:bg-teal-200 transition-colors duration-300 cursor-pointer">Activity Tracking</span>
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium hover:bg-purple-200 transition-colors duration-300 cursor-pointer">Conversion Metrics</span>
                  <span className="px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-medium hover:bg-orange-200 transition-colors duration-300 cursor-pointer">Performance Insights</span>
                </div>
              </div>
            </div>

            {/* E-Signature Template Editor Feature - Text Left, Image Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div 
                className={`space-y-6 lg:order-1 transition-all duration-1000 ${
                  isVisible('showcase-4') ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
                }`}
                data-animate-id="showcase-4"
              >
                <h3 className="text-3xl font-bold text-gray-900 hover:text-purple-600 transition-colors duration-300">E-Signature Templates</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Create custom PDF templates with drag-and-drop signature fields. Upload any PDF document and position signature, 
                  name, date, email, and text fields exactly where you need them for professional document signing workflows.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors duration-300 cursor-pointer">PDF Template Editor</span>
                  <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium hover:bg-green-200 transition-colors duration-300 cursor-pointer">Drag & Drop Fields</span>
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium hover:bg-purple-200 transition-colors duration-300 cursor-pointer">Custom Positioning</span>
                </div>
              </div>
              <div 
                className={`bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-500 lg:order-2 group ${
                  isVisible('showcase-4') ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                }`}
                style={{ transitionDelay: '200ms' }}
                onClick={() => setEnlargedImage("/e-signature-template-editor.png")}
              >
                <img 
                  src="/e-signature-template-editor.png" 
                  alt="E-Signature Template Editor with Drag & Drop Fields"
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div 
            className={`text-center mb-16 transition-all duration-1000 ${
              isVisible('examples-header') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
            data-animate-id="examples-header"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">See CIM Share in Action</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore real examples of professional CIM documents created with our platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Tony's Transmissions Image Card */}
            <div 
              className={`relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl hover:-translate-y-4 hover:rotate-1 transition-all duration-500 cursor-pointer group ${
                isVisible('example-1') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              data-animate-id="example-1"
              onClick={() => window.open('https://cimshare.com/share/cim-q3bqjm', '_blank')}
            >
              <img 
                src="/tonys-transmissions-preview.png" 
                alt="Tony's Transmissions CIM Document Preview"
                className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-4 right-4">
                <div className="text-sm text-blue-600 font-medium bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm animate-pulse-slow">
                  Live Example
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0 drop-shadow-lg">
                  Click to view full CIM document →
                </p>
              </div>
            </div>

            {/* Arbor Partners Image Card */}
            <div 
              className={`relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl hover:-translate-y-4 hover:-rotate-1 transition-all duration-500 cursor-pointer group ${
                isVisible('example-2') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              data-animate-id="example-2"
              style={{ transitionDelay: '200ms' }}
              onClick={() => window.open('https://cimshare.com/share/cim-2axr79', '_blank')}
            >
              <img 
                src="/arbor-partners-preview.png" 
                alt="Arbor Partners CIM Document Preview"
                className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-4 right-4">
                <div className="text-sm text-green-600 font-medium bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm animate-pulse-slow">
                  Live Example
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0 drop-shadow-lg">
                  Click to view full CIM document →
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Tailored Solutions for Your Industry
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether you're a business broker or investment banker, we have the right tools for your M&A transactions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="border-primary/20 hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Briefcase className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl font-semibold">For Business Brokers</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <p className="text-muted-foreground mb-4">
                  Professional CIM creation platform designed for business brokers and M&A advisors.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Professional CIM creation in hours
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Contact tracking and management
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Automated NDA management
                  </li>
                </ul>
                <Link href="/solutions/business-brokers">
                  <Button variant="outline" className="w-full">
                    Learn More →
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Building className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl font-semibold">For Investment Banks</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <p className="text-muted-foreground mb-4">
                  Enhanced features for larger organizations with additional security and customization options.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Enhanced security features
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    API access for custom integrations
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Custom branding options
                  </li>
                </ul>
                <Link href="/solutions/investment-banking">
                  <Button variant="outline" className="w-full">
                    Learn More →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-cyan-400 via-blue-500 via-purple-500 via-pink-500 to-orange-400 pt-12 pb-0 relative overflow-hidden">
        {/* Floating Icons Background - matching hero section */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large floating icons */}
          <div className="absolute top-20 left-10 animate-bounce" style={{animationDelay: '0s', animationDuration: '3s'}}>
            <Shield className="w-8 h-8 text-white/20" />
          </div>
          <div className="absolute top-32 right-16 animate-bounce" style={{animationDelay: '1s', animationDuration: '4s'}}>
            <FileText className="w-10 h-10 text-white/25" />
          </div>
          <div className="absolute top-40 left-1/4 animate-bounce" style={{animationDelay: '2s', animationDuration: '3.5s'}}>
            <Lock className="w-6 h-6 text-white/20" />
          </div>
          <div className="absolute bottom-20 left-20 animate-bounce" style={{animationDelay: '0.5s', animationDuration: '4.5s'}}>
            <Download className="w-7 h-7 text-white/25" />
          </div>
          <div className="absolute bottom-32 right-20 animate-bounce" style={{animationDelay: '1.5s', animationDuration: '3s'}}>
            <Database className="w-9 h-9 text-white/20" />
          </div>
          <div className="absolute top-1/2 right-10 animate-bounce" style={{animationDelay: '2.5s', animationDuration: '4s'}}>
            <Zap className="w-8 h-8 text-white/25" />
          </div>

          {/* Sparkle particles */}
          <div className="absolute top-16 left-1/3 animate-pulse" style={{animationDelay: '0s', animationDuration: '2s'}}>
            <Sparkles className="w-4 h-4 text-white/30" />
          </div>
          <div className="absolute top-28 right-1/3 animate-pulse" style={{animationDelay: '1s', animationDuration: '2.5s'}}>
            <Sparkles className="w-3 h-3 text-white/25" />
          </div>
          <div className="absolute bottom-24 left-1/2 animate-pulse" style={{animationDelay: '1.5s', animationDuration: '2s'}}>
            <Sparkles className="w-5 h-5 text-white/20" />
          </div>
          <div className="absolute top-3/4 left-16 animate-pulse" style={{animationDelay: '0.5s', animationDuration: '3s'}}>
            <Sparkles className="w-4 h-4 text-white/25" />
          </div>
          <div className="absolute top-1/4 right-1/4 animate-pulse" style={{animationDelay: '2s', animationDuration: '2.5s'}}>
            <Sparkles className="w-3 h-3 text-white/30" />
          </div>

          {/* Additional floating elements */}
          <div className="absolute top-1/3 left-1/6 animate-bounce" style={{animationDelay: '3s', animationDuration: '5s'}}>
            <Globe className="w-6 h-6 text-white/20" />
          </div>
          <div className="absolute bottom-1/3 right-1/6 animate-bounce" style={{animationDelay: '2.5s', animationDuration: '4.5s'}}>
            <PenTool className="w-7 h-7 text-white/25" />
          </div>
          <div className="absolute top-1/2 left-1/2 animate-pulse" style={{animationDelay: '1.8s', animationDuration: '3.5s'}}>
            <BarChart3 className="w-5 h-5 text-white/15" />
          </div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-end">
            {/* Left side - Text content */}
            <div className="text-center lg:text-left pb-20">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6" style={{textShadow: '0 2px 4px rgba(0,0,0,0.3)'}}>
                Ready to Make CIMs the Easy Way?
              </h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl">
                Join thousands of professionals who trust CIM Share for their confidential business documentation needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/login">
                  <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
                    Create a Free CIM
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="text-lg px-8 py-3 border-white text-gray-900 bg-white hover:bg-gray-100">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Right side - Mobile mockup */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                <img
                  src="/mobile-mockup.png"
                  alt="CIM Share mobile app showing Arbor Partners CIM with financial information"
                  className="w-full max-w-md h-auto drop-shadow-2xl"
                  style={{ marginBottom: '-2px' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Image Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full animate-scale-in">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 hover:scale-110 transition-transform duration-200"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={enlargedImage}
              alt="Enlarged preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Custom CSS Animations */}
      <style>{`
        @keyframes fade-in {
          from { 
            opacity: 0; 
          }
          to { 
            opacity: 1; 
          }
        }
        
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
        
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.9);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes float-slow {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
          }
          50% { 
            transform: translateY(-10px) rotate(2deg); 
          }
        }
        
        @keyframes float-delayed {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
          }
          50% { 
            transform: translateY(-15px) rotate(-3deg); 
          }
        }
        
        @keyframes float-badge {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
          }
          50% { 
            transform: translateY(-5px) rotate(1deg); 
          }
        }
        
        @keyframes float-badge-delayed {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
          }
          50% { 
            transform: translateY(-8px) rotate(-1deg); 
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.8; 
            transform: scale(1.02);
          }
        }
        
        @keyframes gentle-float {
          0%, 100% { 
            transform: translateY(0px);
          }
          50% { 
            transform: translateY(-8px);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        
        .animate-float-slow {
          animation: float-slow 4s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 5s ease-in-out infinite;
          animation-delay: 1s;
        }
        
        .animate-float-badge {
          animation: float-badge 3s ease-in-out infinite;
        }
        
        .animate-float-badge-delayed {
          animation: float-badge-delayed 3.5s ease-in-out infinite;
          animation-delay: 0.5s;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        
        .animate-gentle-float {
          animation: gentle-float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}