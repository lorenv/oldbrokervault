import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  Shield, 
  Palette, 
  Download, 
  Zap, 
  Users, 
  FileText, 
  Lock, 
  Sparkles,
  Globe,
  Smartphone
} from "lucide-react";

export default function HomePage() {
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
      title: "Multiple Export Formats",
      description: "Export to Word, PDF, HTML, and Google Docs with professional formatting that maintains your brand identity.",
      color: "text-purple-500"
    },
    {
      icon: Zap,
      title: "AI-Powered Analysis",
      description: "Transform business meeting transcripts into structured, professional documents using advanced AI technology.",
      color: "text-orange-500"
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Share documents securely with team members and control viewing permissions with expiration dates.",
      color: "text-indigo-500"
    },
    {
      icon: FileText,
      title: "Professional Templates",
      description: "Choose from industry-standard CIM templates or create your own custom layouts.",
      color: "text-teal-500"
    },
    {
      icon: Lock,
      title: "Enterprise Security",
      description: "Bank-level encryption, secure hosting, and compliance with industry data protection standards.",
      color: "text-red-500"
    },
    {
      icon: Sparkles,
      title: "Smart Automation",
      description: "Automatically extract key business information from transcripts and organize it into professional sections.",
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
      <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight pb-2">
            Structure. Security. Story. In one link.
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
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

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Make CIMs the Easy Way?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who trust CIM God for their confidential business documentation needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
      </section>
    </div>
  );
}