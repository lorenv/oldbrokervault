
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Upload, 
  Zap, 
  Edit, 
  Download, 
  ArrowRight,
  FileText,
  CheckCircle
} from "lucide-react";

export default function HowItWorksPage() {
  const steps = [
    {
      step: 1,
      icon: <Upload className="h-12 w-12 text-blue-500" />,
      title: "Upload Your Content",
      description: "Paste your business transcript, upload documents, or enter key business information. Our system accepts various formats including meeting notes, pitch decks, and financial data."
    },
    {
      step: 2,
      icon: <Zap className="h-12 w-12 text-yellow-500" />,
      title: "AI Analysis & Generation",
      description: "Our advanced AI analyzes your content, extracts key information, and structures it into a professional CIM format. The AI understands financial terminology and investment banking standards."
    },
    {
      step: 3,
      icon: <Edit className="h-12 w-12 text-green-500" />,
      title: "Review & Customize",
      description: "Review the generated CIM, make edits, add custom sections, and apply your branding. Our inline editor makes it easy to refine content and ensure accuracy."
    },
    {
      step: 4,
      icon: <Download className="h-12 w-12 text-purple-500" />,
      title: "Export & Share",
      description: "Export your professional CIM in Word, PDF, or HTML format. Share securely with potential buyers while maintaining confidentiality through built-in NDA protection."
    }
  ];

  const sections = [
    "Executive Summary",
    "Company Overview", 
    "Business Model",
    "Market Analysis",
    "Financial Performance",
    "Growth Opportunities",
    "Management Team",
    "Investment Highlights"
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">How CIM God Works</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Transform your business information into professional Confidential Information Memorandums in just four simple steps.
          </p>
        </div>

        {/* Steps Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Simple 4-Step Process</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <Card className="relative h-full hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="mx-auto mb-4">
                      {step.icon}
                    </div>
                    <div className="absolute -top-3 -right-3 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold">
                      {step.step}
                    </div>
                    <CardTitle className="text-xl">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {step.description}
                    </CardDescription>
                  </CardContent>
                </Card>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* What Gets Generated Section */}
        <div className="bg-muted rounded-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">What Your CIM Includes</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sections.map((section, index) => (
              <div key={index} className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="font-medium">{section}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-muted-foreground mb-4">
              Plus custom sections, financial charts, and professional formatting that meets investment banking standards.
            </p>
          </div>
        </div>

        {/* Features Highlight */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <FileText className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <CardTitle>Professional Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Choose from industry-standard templates designed by investment banking professionals for maximum impact.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Zap className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <CardTitle>AI-Powered Intelligence</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Advanced AI understands your business context and generates compelling investment narratives automatically.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <CardTitle>Ready in Minutes</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get professional CIMs in minutes instead of weeks. Perfect for time-sensitive deals and multiple scenarios.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-primary/5 rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Create your first professional CIM in minutes. No credit card required for your free trial.
          </p>
          <div className="space-x-4">
            <Link href="/auth">
              <Button size="lg">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
