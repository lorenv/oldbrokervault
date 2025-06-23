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
  X
} from "lucide-react";
import { useState } from "react";

export default function HomePage() {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const features = [
    {
      icon: Shield,
      title: "NDA Protection",
      description: "Built-in confidentiality agreements with secure document sharing and password protection.",
      color: "text-green-500"
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
      description: "Transform business meeting transcripts into structured, professional documents using advanced AI technology.",
      color: "text-orange-500"
    },
    {
      icon: Database,
      title: "Investor Database",
      description: "Track and manage investor contacts across all documents with comprehensive NDA signature management.",
      color: "text-indigo-500"
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
      <section className="bg-gradient-to-br from-cyan-400 via-blue-500 via-purple-500 via-pink-500 to-orange-400 pt-32 pb-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white leading-tight pb-2" style={{textShadow: '0 2px 4px rgba(0,0,0,0.3)'}}>
            Build, Share, Protect
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
            Everything you need to create, customize, and share professional Confidential Information Memorandums with confidence and security.
          </p>
          <Link href="/login">
            <Button size="lg" className="text-lg px-8 py-3">
              Create a Free CIM
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Complete CIM Solution</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From AI-powered analysis to secure sharing, we've built everything you need for professional business documentation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Showcase Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Advanced Analytics & Controls</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Track every interaction, manage NDAs seamlessly, and build relationships with comprehensive investor analytics
            </p>
          </div>

          <div className="max-w-7xl mx-auto space-y-20">
            {/* Investor Database Feature - Image Left, Text Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div 
                className="bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow duration-300"
                onClick={() => setEnlargedImage("/investor-database-preview.png")}
              >
                <img 
                  src="/investor-database-preview.png" 
                  alt="Investor Database Interface"
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="space-y-6">
                <h3 className="text-3xl font-bold text-gray-900">Investor Database</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Track investor contacts across all documents with analytics and export capabilities. 
                  Manage relationships with comprehensive contact tracking and automated data collection.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">Contact Tracking</span>
                  <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">Export Tools</span>
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">Relationship Management</span>
                </div>
              </div>
            </div>

            {/* NDA Signatures Feature - Text Left, Image Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 lg:order-1">
                <h3 className="text-3xl font-bold text-gray-900">NDA Management</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Digital signatures, approval controls, and comprehensive audit trails for legal compliance. 
                  Streamline your NDA process with automated workflows and tracking.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-medium">Digital Signatures</span>
                  <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">Approval Controls</span>
                  <span className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">Audit Trails</span>
                </div>
              </div>
              <div 
                className="bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow duration-300 lg:order-2"
                onClick={() => setEnlargedImage("/nda-signatures-preview.png")}
              >
                <img 
                  src="/nda-signatures-preview.png" 
                  alt="NDA Signatures Management"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Analytics Feature - Image Left, Text Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div 
                className="bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow duration-300"
                onClick={() => setEnlargedImage("/analytics-preview.png")}
              >
                <img 
                  src="/analytics-preview.png" 
                  alt="Analytics Dashboard"
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="space-y-6">
                <h3 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Comprehensive analytics with activity tracking, conversion metrics, and detailed reporting. 
                  Make data-driven decisions with powerful insights into document performance.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-teal-100 text-teal-800 rounded-full text-sm font-medium">Activity Tracking</span>
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">Conversion Metrics</span>
                  <span className="px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">Performance Insights</span>
                </div>
              </div>
            </div>

            {/* E-Signature Template Editor Feature - Text Left, Image Right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 lg:order-1">
                <h3 className="text-3xl font-bold text-gray-900">E-Signature Templates</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Create custom PDF templates with drag-and-drop signature fields. Upload any PDF document and position signature, 
                  name, date, email, and text fields exactly where you need them for professional document signing workflows.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">PDF Template Editor</span>
                  <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">Drag & Drop Fields</span>
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">Custom Positioning</span>
                </div>
              </div>
              <div 
                className="bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow duration-300 lg:order-2"
                onClick={() => setEnlargedImage("/e-signature-template-editor.png")}
              >
                <img 
                  src="/e-signature-template-editor.png" 
                  alt="E-Signature Template Editor with Drag & Drop Fields"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Example Documents Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">See CIM Share in Action</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore real examples of professional CIM documents created with our platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Tony's Transmissions Image Card */}
            <div 
              className="relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer group"
              onClick={() => window.open('https://cimshare.com/share/cim-q94wn4', '_blank')}
            >
              <img 
                src="/tonys-transmissions-preview.png" 
                alt="Tony's Transmissions CIM Document Preview"
                className="w-full h-auto object-cover"
              />
              <div className="absolute top-4 right-4">
                <div className="text-sm text-blue-600 font-medium bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                  Live Example
                </div>
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg">
                  Click to view full CIM document →
                </p>
              </div>
            </div>

            {/* Arbor Partners Image Card */}
            <div 
              className="relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer group"
              onClick={() => window.open('https://cimshare.com/share/cim-wwkz3j', '_blank')}
            >
              <img 
                src="/arbor-partners-preview.png" 
                alt="Arbor Partners CIM Document Preview"
                className="w-full h-auto object-cover"
              />
              <div className="absolute top-4 right-4">
                <div className="text-sm text-green-600 font-medium bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                  Live Example
                </div>
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg">
                  Click to view full CIM document →
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 pt-12 pb-0 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-end">
            {/* Left side - Text content */}
            <div className="text-center lg:text-left pb-20">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Ready to Make CIMs the Easy Way?
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl">
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
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={enlargedImage}
              alt="Enlarged preview"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}