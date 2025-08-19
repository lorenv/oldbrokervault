import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle,
  ArrowRight,
  Users,
  Clock,
  TrendingUp,
  Star,
  Play,
  Eye,
  Share2,
  Award,
  Target,
  Lightbulb,
  ChevronRight
} from "lucide-react";
import { useState } from "react";

export default function MarketingHomePage() {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  
  const mainFeatures = [
    {
      icon: Zap,
      title: "AI-Powered Document Creation",
      description: "Transform business transcripts and data into professional CIM documents automatically using advanced AI technology.",
      color: "text-orange-500",
      bgColor: "bg-orange-50",
      benefits: ["20x faster creation", "Professional formatting", "Data extraction"]
    },
    {
      icon: Shield,
      title: "Enterprise Security & NDAs",
      description: "Built-in NDA protection with digital signatures, secure document sharing, and comprehensive audit trails.",
      color: "text-green-500",
      bgColor: "bg-green-50",
      benefits: ["Bank-level encryption", "Legal compliance", "Audit trails"]
    },
    {
      icon: Database,
      title: "Investor Relationship Management",
      description: "Track and manage investor contacts across all documents with powerful analytics and automated workflows.",
      color: "text-indigo-500",
      bgColor: "bg-indigo-50",
      benefits: ["Contact tracking", "Analytics dashboard", "Export capabilities"]
    },
    {
      icon: Palette,
      title: "Complete Customization Control",
      description: "Brand your documents with custom themes, drag-and-drop editing, and professional PDF export capabilities.",
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      benefits: ["Brand customization", "Drag & drop", "Professional PDFs"]
    }
  ];

  const additionalFeatures = [
    {
      icon: PenTool,
      title: "Digital Signatures",
      description: "Secure e-signature workflows with template creation and field positioning",
      color: "text-yellow-500"
    },
    {
      icon: Globe,
      title: "Website Integration",
      description: "Extract logos and company data automatically from websites",
      color: "text-cyan-500"
    },
    {
      icon: Smartphone,
      title: "Mobile Responsive",
      description: "Access and edit documents from any device with full functionality",
      color: "text-pink-500"
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Track document performance with detailed metrics and insights",
      color: "text-teal-500"
    },
    {
      icon: Lock,
      title: "Compliance Ready",
      description: "GDPR, SOX, and industry standard compliance built-in",
      color: "text-red-500"
    },
    {
      icon: FileText,
      title: "Template Library",
      description: "Professional templates for various industries and use cases",
      color: "text-blue-500"
    }
  ];

  const stats = [
    { number: "10,000+", label: "Documents Created", icon: FileText },
    { number: "500+", label: "Active Users", icon: Users },
    { number: "99.9%", label: "Uptime", icon: TrendingUp },
    { number: "24/7", label: "Support", icon: Clock }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "M&A Director",
      company: "Capital Partners LLC",
      content: "CIM Share transformed our document creation process. What used to take weeks now takes hours, and the professional quality is unmatched.",
      rating: 5
    },
    {
      name: "Michael Chen",
      role: "Investment Banker",
      company: "First Capital Group",
      content: "The NDA management and investor tracking features have streamlined our entire workflow. It's like having a dedicated team for document management.",
      rating: 5
    },
    {
      name: "Emily Rodriguez",
      role: "Business Broker",
      company: "Rodriguez & Associates",
      content: "The AI-powered document creation is incredible. It extracts key information perfectly and creates professional CIMs that impress our clients.",
      rating: 5
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "$29",
      period: "/month",
      description: "Perfect for individual professionals",
      features: [
        "5 CIM documents/month",
        "Basic templates",
        "PDF export",
        "Email support",
        "Basic analytics"
      ],
      highlighted: false
    },
    {
      name: "Professional",
      price: "$79",
      period: "/month",
      description: "Ideal for growing businesses",
      features: [
        "25 CIM documents/month",
        "All templates + custom branding",
        "Advanced NDA management",
        "Investor database",
        "Priority support",
        "Advanced analytics",
        "API access"
      ],
      highlighted: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations",
      features: [
        "Unlimited documents",
        "White-label solution",
        "Custom integrations",
        "Dedicated support",
        "Advanced security",
        "Team collaboration",
        "SLA guarantee"
      ],
      highlighted: false
    }
  ];

  const useCases = [
    {
      title: "Investment Banking",
      description: "Create professional CIMs for M&A transactions with comprehensive financial data and market analysis.",
      icon: TrendingUp,
      features: ["Financial modeling", "Market analysis", "Deal tracking"]
    },
    {
      title: "Business Brokerage", 
      description: "Streamline business sales with professional documentation and secure investor management.",
      icon: Target,
      features: ["Business valuations", "Buyer tracking", "Confidentiality management"]
    },
    {
      title: "Private Equity",
      description: "Manage deal flow with sophisticated analytics and investor relationship tools.",
      icon: Award,
      features: ["Deal sourcing", "Due diligence", "Portfolio management"]
    },
    {
      title: "Corporate Development",
      description: "Support strategic initiatives with professional documentation and secure sharing.",
      icon: Lightbulb,
      features: ["Strategic planning", "Partnership docs", "Board presentations"]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800 pt-32 pb-24 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 animate-bounce" style={{animationDelay: '0s', animationDuration: '3s'}}>
            <Shield className="w-8 h-8 text-white/20" />
          </div>
          <div className="absolute top-32 right-16 animate-bounce" style={{animationDelay: '1s', animationDuration: '4s'}}>
            <FileText className="w-10 h-10 text-white/25" />
          </div>
          <div className="absolute top-40 left-1/4 animate-bounce" style={{animationDelay: '2s', animationDuration: '3.5s'}}>
            <Zap className="w-6 h-6 text-white/20" />
          </div>
          <div className="absolute bottom-20 left-20 animate-pulse" style={{animationDelay: '0.5s', animationDuration: '2s'}}>
            <Sparkles className="w-4 h-4 text-white/30" />
          </div>
          <div className="absolute bottom-32 right-20 animate-bounce" style={{animationDelay: '1.5s', animationDuration: '3s'}}>
            <Database className="w-9 h-9 text-white/20" />
          </div>
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge className="mb-6 bg-white/20 text-white border-white/30 hover:bg-white/30">
            🚀 Trusted by 500+ Investment Professionals
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 text-white leading-tight" style={{textShadow: '0 2px 4px rgba(0,0,0,0.3)'}}>
            Professional CIMs
            <br />
            <span className="bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
              Made Simple
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
            Create, customize, and share confidential information memorandums with AI-powered tools, 
            enterprise security, and comprehensive investor management - all in one platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/login">
              <Button size="lg" className="text-lg px-8 py-4 bg-white text-blue-600 hover:bg-gray-100 shadow-lg">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-4 border-white text-white hover:bg-white/10"
              onClick={() => document.getElementById('demo-section')?.scrollIntoView({behavior: 'smooth'})}
            >
              <Play className="mr-2 w-5 h-5" />
              Watch Demo
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-2">
                  <stat.icon className="w-6 h-6 text-white/80" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stat.number}</div>
                <div className="text-sm text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Features Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-50 text-blue-600 hover:bg-blue-100">
              Core Features
            </Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Everything You Need for 
              <span className="text-blue-600"> Professional CIMs</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From AI-powered creation to enterprise security, we've built the complete solution 
              for confidential business documentation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {mainFeatures.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
                <CardHeader className={`${feature.bgColor} p-8 border-b`}>
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-lg bg-white flex items-center justify-center flex-shrink-0`}>
                      <feature.icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold mb-2">{feature.title}</CardTitle>
                      <p className="text-gray-700">{feature.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-3">
                    {feature.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-center space-x-3">
                        <CheckCircle className={`w-5 h-5 ${feature.color} flex-shrink-0`} />
                        <span className="text-gray-700">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {additionalFeatures.map((feature, index) => (
              <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300 text-center">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-4`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo-section" className="py-24 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-50 text-blue-600 hover:bg-blue-100">
              See It in Action
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Live CIM Examples</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore real CIM documents created with our platform to see the professional quality and features in action.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-16">
            {/* Tony's Transmissions */}
            <div 
              className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer group bg-white"
              onClick={() => window.open('https://cimshare.com/share/cim-q3bqjm', '_blank')}
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img 
                  src="/premier-tree-trimming-preview.png" 
                  alt="Professional CIM Document - Tree Trimming Business"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="absolute top-4 right-4">
                <Badge className="bg-blue-600 text-white">
                  <Eye className="w-3 h-3 mr-1" />
                  Live Demo
                </Badge>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute bottom-6 left-6 right-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <h3 className="text-xl font-bold mb-2">Tree Trimming Services</h3>
                <p className="text-sm mb-3">Professional service business CIM with financials and market analysis</p>
                <div className="flex items-center text-sm">
                  <span>Click to view full document</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Arbor Partners */}
            <div 
              className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer group bg-white"
              onClick={() => window.open('https://cimshare.com/share/cim-2axr79', '_blank')}
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img 
                  src="/arbor-partners-preview.png" 
                  alt="Professional CIM Document - Investment Firm"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="absolute top-4 right-4">
                <Badge className="bg-green-600 text-white">
                  <Eye className="w-3 h-3 mr-1" />
                  Live Demo
                </Badge>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute bottom-6 left-6 right-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <h3 className="text-xl font-bold mb-2">Investment Partnership</h3>
                <p className="text-sm mb-3">Sophisticated financial services CIM with comprehensive data</p>
                <div className="flex items-center text-sm">
                  <span>Click to view full document</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Feature Showcase Images */}
          <div className="space-y-20">
            {/* Analytics Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div 
                className="bg-white rounded-xl shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow duration-300"
                onClick={() => setEnlargedImage("/analytics-preview.png")}
              >
                <img 
                  src="/analytics-preview.png" 
                  alt="Analytics Dashboard with Performance Metrics"
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="space-y-6">
                <Badge className="bg-teal-50 text-teal-600 hover:bg-teal-100">
                  Analytics & Insights
                </Badge>
                <h3 className="text-3xl font-bold text-gray-900">Track Every Interaction</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Get detailed analytics on document views, engagement metrics, and investor behavior. 
                  Make data-driven decisions with comprehensive reporting and real-time insights.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline">Real-time tracking</Badge>
                  <Badge variant="outline">Engagement metrics</Badge>
                  <Badge variant="outline">Export reports</Badge>
                </div>
              </div>
            </div>

            {/* Investor Database */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 lg:order-1">
                <Badge className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                  Relationship Management
                </Badge>
                <h3 className="text-3xl font-bold text-gray-900">Investor Database</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Centralize all investor contacts with comprehensive tracking across documents. 
                  Manage relationships, track interactions, and export data for your CRM systems.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline">Contact management</Badge>
                  <Badge variant="outline">Interaction history</Badge>
                  <Badge variant="outline">CRM export</Badge>
                </div>
              </div>
              <div 
                className="bg-white rounded-xl shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow duration-300 lg:order-2"
                onClick={() => setEnlargedImage("/investor-database-preview.png")}
              >
                <img 
                  src="/investor-database-preview.png" 
                  alt="Investor Database with Contact Management"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* E-Signature Templates */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div 
                className="bg-white rounded-xl shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow duration-300"
                onClick={() => setEnlargedImage("/e-signature-template-editor.png")}
              >
                <img 
                  src="/e-signature-template-editor.png" 
                  alt="E-Signature Template Editor with Drag & Drop"
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="space-y-6">
                <Badge className="bg-purple-50 text-purple-600 hover:bg-purple-100">
                  Digital Signatures
                </Badge>
                <h3 className="text-3xl font-bold text-gray-900">Professional E-Signatures</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Create custom signature workflows with drag-and-drop field positioning. 
                  Upload any PDF document and add signature, date, and text fields exactly where needed.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline">Drag & drop editor</Badge>
                  <Badge variant="outline">Custom workflows</Badge>
                  <Badge variant="outline">Legal compliance</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-50 text-green-600 hover:bg-green-100">
              Industry Solutions
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Your Industry</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Whether you're in investment banking, business brokerage, or private equity, 
              CIM Share adapts to your specific workflow requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {useCases.map((useCase, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors duration-300">
                      <useCase.icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors duration-300">
                        {useCase.title}
                      </CardTitle>
                      <p className="text-gray-600">{useCase.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-4">
                  <div className="space-y-3">
                    {useCase.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center space-x-3">
                        <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
              Customer Success
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by Professionals</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              See what investment professionals are saying about CIM Share
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg bg-white">
                <CardContent className="p-8">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 italic">"{testimonial.content}"</p>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.role}</div>
                    <div className="text-sm text-gray-500">{testimonial.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-purple-50 text-purple-600 hover:bg-purple-100">
              Simple Pricing
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Choose Your Plan</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Start free and scale as you grow. No hidden fees, no setup costs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`border-2 ${plan.highlighted ? 'border-blue-500 shadow-2xl scale-105' : 'border-gray-200 shadow-lg'} relative`}>
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="p-8 text-center">
                  <CardTitle className="text-2xl font-bold mb-2">{plan.name}</CardTitle>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                  <p className="text-gray-600">{plan.description}</p>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login">
                    <Button className={`w-full ${plan.highlighted ? 'bg-blue-600 hover:bg-blue-700' : ''}`}>
                      {plan.name === 'Enterprise' ? 'Contact Sales' : 'Start Free Trial'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Transform Your CIM Process?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Join thousands of investment professionals who trust CIM Share for their confidential business documentation. 
              Start your free trial today and see the difference.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
              <Link href="/login">
                <Button size="lg" className="text-lg px-8 py-4 bg-white text-blue-600 hover:bg-gray-100 shadow-lg">
                  Start Free Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8 py-4 border-white text-white hover:bg-white/10"
                >
                  Contact Sales
                  <Share2 className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-3xl mx-auto text-center">
              <div>
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <span className="text-sm text-white/80">No setup fees</span>
              </div>
              <div>
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <span className="text-sm text-white/80">Cancel anytime</span>
              </div>
              <div>
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <span className="text-sm text-white/80">24/7 support</span>
              </div>
              <div>
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <span className="text-sm text-white/80">Enterprise security</span>
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
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 rounded-full p-2"
            >
              <X className="w-6 h-6" />
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