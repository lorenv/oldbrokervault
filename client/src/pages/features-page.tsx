
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Zap, 
  FileText, 
  Download, 
  Shield, 
  Palette, 
  Users, 
  Clock, 
  CheckCircle,
  Brain,
  Sparkles
} from "lucide-react";

export default function FeaturesPage() {
  const features = [
    {
      icon: <Brain className="h-8 w-8 text-blue-500" />,
      title: "AI-Powered Generation",
      description: "Transform business transcripts and data into professional CIMs using advanced AI technology that understands financial terminology and industry standards."
    },
    {
      icon: <FileText className="h-8 w-8 text-green-500" />,
      title: "Professional Templates",
      description: "Choose from industry-standard CIM templates designed by investment banking professionals. Each template follows best practices for maximum impact."
    },
    {
      icon: <Download className="h-8 w-8 text-purple-500" />,
      title: "Multiple Export Formats",
      description: "Export your CIMs to Word, PDF, and HTML formats. Each format is optimized for different use cases and maintains professional styling."
    },
    {
      icon: <Shield className="h-8 w-8 text-red-500" />,
      title: "Built-in NDA Protection",
      description: "Every CIM includes professionally crafted NDA language to protect sensitive business information during the due diligence process."
    },
    {
      icon: <Palette className="h-8 w-8 text-orange-500" />,
      title: "Custom Branding",
      description: "Add your logo, colors, and branding elements to create CIMs that reflect your professional identity and maintain brand consistency."
    },
    {
      icon: <Users className="h-8 w-8 text-indigo-500" />,
      title: "Team Collaboration",
      description: "Work with your team to review, edit, and approve CIMs before distribution. Control access and maintain version history."
    },
    {
      icon: <Clock className="h-8 w-8 text-teal-500" />,
      title: "Quick Turnaround",
      description: "Generate professional CIMs in minutes, not days. Perfect for time-sensitive transactions and multiple deal scenarios."
    },
    {
      icon: <Sparkles className="h-8 w-8 text-pink-500" />,
      title: "Smart Analysis",
      description: "AI analyzes your business data to highlight key strengths, growth opportunities, and investment highlights automatically."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Powerful Features for Professional CIMs</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Everything you need to create compelling Confidential Information Memorandums that win deals and attract the right investors.
          </p>
          <Link href="/auth">
            <Button size="lg" className="mr-4">
              Get Started Free
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="lg">
              View Pricing
            </Button>
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="bg-muted rounded-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Why Choose CIM God?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Save Time & Resources
              </h3>
              <p className="text-muted-foreground mb-6">
                Reduce CIM creation time from weeks to hours. Our AI handles the heavy lifting while you focus on strategy and deal execution.
              </p>
              
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Professional Quality
              </h3>
              <p className="text-muted-foreground">
                Every CIM meets investment banking standards with proper formatting, comprehensive analysis, and compelling presentation.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Secure & Confidential
              </h3>
              <p className="text-muted-foreground mb-6">
                Bank-level security protects your sensitive business information. Built-in NDAs ensure confidentiality throughout the process.
              </p>
              
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Proven Results
              </h3>
              <p className="text-muted-foreground">
                Used by investment bankers, business brokers, and M&A professionals to close deals faster and attract better offers.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Create Your First CIM?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of professionals who trust CIM God for their deal documents.
          </p>
          <Link href="/auth">
            <Button size="lg">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
