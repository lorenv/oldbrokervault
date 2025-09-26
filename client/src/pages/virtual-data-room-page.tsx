import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Shield,
  Users,
  Zap,
  Database,
  ArrowRight,
  CheckCircle,
  Folder,
  Upload,
  Eye,
  MessageSquare,
  Clock,
  FileText
} from "lucide-react";
import vvLogoBlue from "@assets/vv-logo-blue_1758929244400.png";
import heroVideo from "@assets/hero-video_1758929337474.mp4";

export default function VirtualDataRoomPage() {
  const features = [
    {
      icon: Shield,
      title: "Secure & Free to Try",
      description: "Bank-level security with no upfront costs. Experience the platform risk-free before committing.",
      color: "text-green-500"
    },
    {
      icon: Folder,
      title: "Guided Document Upload",
      description: "AI-powered guidance helps sellers organize and upload documents in the right structure from day one.",
      color: "text-blue-500"
    },
    {
      icon: Users,
      title: "Unlimited Team Access",
      description: "Invite unlimited team members from both sides. Only deal creators need a subscription - everyone else collaborates for free.",
      color: "text-purple-500"
    },
    {
      icon: Zap,
      title: "AI-Powered Platform",
      description: "Smart automation extracts key information and organizes documents, eliminating manual spreadsheet chaos.",
      color: "text-orange-500"
    },
    {
      icon: Upload,
      title: "Streamlined Collaboration",
      description: "Team members can view, upload, and collaborate seamlessly without additional licensing costs.",
      color: "text-indigo-500"
    },
    {
      icon: Clock,
      title: "Faster Deal Closure",
      description: "Guided workflows and organized document structure accelerate the entire transaction process.",
      color: "text-teal-500"
    }
  ];

  const benefits = [
    "Stop drowning in spreadsheet chaos with AI-powered organization",
    "Only deal creators need a subscription - unlimited team access included",
    "Secure, guided document upload process for sellers",
    "Both sides can view, upload, and collaborate at no additional cost",
    "Faster deal closure with less frustration for everyone",
    "Modern, intuitive interface that teams actually want to use"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            {/* VettingVault Logo */}
            <div className="flex justify-center mb-8">
              <img 
                src={vvLogoBlue} 
                alt="VettingVault Logo" 
                className="h-16 md:h-20 w-auto"
              />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Modern Virtual Data Room
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Stop drowning in spreadsheet chaos. Get the AI-powered platform where only the deal creators need a subscription.
              Invite unlimited team members from both sides of the transaction - they can view, upload, and collaborate at no additional cost.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <a
                href="https://www.vettingvault.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <Button size="lg" className="text-lg px-8 py-3">
                  Try VettingVault Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="text-lg px-8 py-3">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero Video */}
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <video
                src={heroVideo}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-auto"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Key Message Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 md:p-12 shadow-lg">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
                A Data Room Solution That Actually Gets Deals Done
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                VettingVault creates a guided path for sellers to upload their documents, so deals get done faster
                and with way less frustration on both sides. Our AI-powered platform eliminates the chaos of
                traditional data rooms and spreadsheet management.
              </p>
              <div className="text-gray-600 text-sm italic">
                "Finally, a data room that doesn't feel like punishment for everyone involved."
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose VettingVault?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built specifically for modern M&A transactions with features that actually help close deals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 h-full">
                <CardHeader className="p-6">
                  <div className={`w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl font-semibold">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              What Makes VettingVault Different
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-700">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple. Guided. Effective.
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our guided approach ensures documents are organized correctly from the start.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">1. Set Up Your Room</h3>
              <p className="text-gray-600">
                Create your data room with AI-guided organization. Our platform suggests the optimal document structure for your transaction type.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">2. Guided Upload Process</h3>
              <p className="text-gray-600">
                Sellers follow a step-by-step process to upload documents in the right categories, eliminating confusion and ensuring completeness.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">3. Collaborate & Close</h3>
              <p className="text-gray-600">
                Teams from both sides can access, review, and collaborate seamlessly. Only deal creators need a subscription - everyone else participates free.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Data Room Experience?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join the modern approach to virtual data rooms. Free to try, unlimited team access, and built for deal success.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://www.vettingvault.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
                Start Your Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 py-3 border-white text-white hover:bg-white hover:text-gray-900">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}