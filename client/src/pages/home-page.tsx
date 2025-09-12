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
  Briefcase,
  Building,
  CheckCircle,
  ArrowRight,
  Users,
  TrendingUp,
  Clock,
  Star,
  ChevronRight,
  MessageSquare,
  Target,
  Layers,
  Upload
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [visibleFeatures, setVisibleFeatures] = useState<number[]>([]);
  const [scrollY, setScrollY] = useState(0);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [counters, setCounters] = useState({ docs: 0, users: 0, shares: 0 });

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animate features on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            setVisibleFeatures(prev => [...prev, index]);
          }
        });
      },
      { threshold: 0.1 }
    );

    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card) => observer.observe(card));

    return () => featureCards.forEach((card) => observer.unobserve(card));
  }, []);

  // Animate stats counter
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !statsVisible) {
            setStatsVisible(true);
            // Animate counters
            const duration = 2000;
            const steps = 50;
            const stepTime = duration / steps;
            let currentStep = 0;

            const interval = setInterval(() => {
              currentStep++;
              const progress = currentStep / steps;
              setCounters({
                docs: Math.floor(5000 * progress),
                users: Math.floor(1200 * progress),
                shares: Math.floor(98 * progress)
              });

              if (currentStep >= steps) {
                clearInterval(interval);
              }
            }, stepTime);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => {
      if (statsRef.current) {
        observer.unobserve(statsRef.current);
      }
    };
  }, [statsVisible]);

  const features = [
    {
      icon: Shield,
      title: "NDA Protection",
      description: "Built-in confidentiality agreements with secure document sharing and password protection.",
      color: "from-green-500 to-emerald-600",
      delay: 0
    },
    {
      icon: Palette,
      title: "Fully Customizable",
      description: "Tailor every section, add your branding, and control layout with drag-and-drop editing.",
      color: "from-blue-500 to-cyan-600",
      delay: 100
    },
    {
      icon: Download,
      title: "PDF Export",
      description: "Export to professional PDF format with formatting that maintains your brand identity.",
      color: "from-purple-500 to-pink-600",
      delay: 200
    },
    {
      icon: Zap,
      title: "AI-Powered Analysis",
      description: "Transform business meeting transcripts into structured, professional documents using AI.",
      color: "from-orange-500 to-red-600",
      delay: 300
    },
    {
      icon: Database,
      title: "Investor Database",
      description: "Track and manage investor contacts with comprehensive NDA signature management.",
      color: "from-indigo-500 to-purple-600",
      delay: 400
    },
    {
      icon: Lock,
      title: "Enterprise Security",
      description: "Bank-level encryption, secure hosting, and compliance with data protection standards.",
      color: "from-red-500 to-rose-600",
      delay: 500
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "CEO, TechVentures",
      content: "CIM Share has transformed how we prepare investment documents. What used to take days now takes hours.",
      rating: 5
    },
    {
      name: "Michael Rodriguez",
      role: "Investment Banker",
      content: "The AI-powered analysis feature is a game-changer. It captures every detail from our meetings perfectly.",
      rating: 5
    },
    {
      name: "Emily Watson",
      role: "CFO, Growth Partners",
      content: "Security and compliance are critical for us. CIM Share exceeds our expectations on both fronts.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Modern Hero Section with Animated Background */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 opacity-90">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http://www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
        </div>

        {/* Floating particles animation */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${15 + Math.random() * 20}s`
              }}
            >
              <div className="w-2 h-2 bg-white/20 rounded-full blur-sm"></div>
            </div>
          ))}
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left content with fade-in animation */}
            <div className="text-left animate-fade-in-up">
              <Badge className="mb-4 bg-white/20 text-white border-white/30">
                <Sparkles className="h-3 w-3 mr-1" />
                Trusted by 1,200+ Businesses
              </Badge>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-white leading-tight">
                Create Professional
                <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                  CIM Documents
                </span>
                in Minutes
              </h1>
              
              <p className="text-xl text-white/90 mb-8 leading-relaxed">
                The complete platform for creating, customizing, and sharing Confidential Information Memorandums with bank-level security and AI-powered insights.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Link href="/login">
                  <Button size="lg" className="bg-white text-purple-600 hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                    <FileText className="mr-2 h-5 w-5" />
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 backdrop-blur">
                    View Pricing
                  </Button>
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 mt-8">
                <div className="flex -space-x-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/30"></div>
                  ))}
                </div>
                <p className="text-white/80 text-sm">
                  Join 1,200+ professionals using CIM Share
                </p>
              </div>
            </div>

            {/* Right side - Floating device mockups */}
            <div className="relative hidden lg:block animate-fade-in">
              <div className="relative" style={{ transform: `translateY(${scrollY * 0.1}px)` }}>
                <img 
                  src="/hero-computer.png" 
                  alt="CIM Share platform interface"
                  className="w-full h-auto object-contain filter drop-shadow-2xl animate-float-slow"
                  onError={(e) => {
                    e.currentTarget.src = '/mobile-mockup.png';
                  }}
                />
                
                {/* Floating feature badges */}
                <div className="absolute -top-4 -right-4 bg-white rounded-lg shadow-xl p-3 animate-bounce-slow">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">Auto-Save</span>
                  </div>
                </div>
                
                <div className="absolute -bottom-4 -left-4 bg-white rounded-lg shadow-xl p-3 animate-bounce-slow" style={{ animationDelay: '1s' }}>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">Secure</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section with Counter Animation */}
      <section ref={statsRef} className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="group cursor-pointer">
              <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 transition-transform group-hover:scale-110">
                {counters.docs.toLocaleString()}+
              </div>
              <p className="text-gray-600">Documents Created</p>
            </div>
            <div className="group cursor-pointer">
              <div className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2 transition-transform group-hover:scale-110">
                {counters.users.toLocaleString()}+
              </div>
              <p className="text-gray-600">Active Users</p>
            </div>
            <div className="group cursor-pointer">
              <div className="text-5xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent mb-2 transition-transform group-hover:scale-110">
                {counters.shares}%
              </div>
              <p className="text-gray-600">Customer Satisfaction</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid with Stagger Animation */}
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white" ref={featuresRef}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <Badge className="mb-4" variant="secondary">
              <Layers className="h-3 w-3 mr-1" />
              Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Everything You Need to
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Close Deals Faster
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From AI-powered document generation to secure sharing, we've built the complete toolkit for professional business documentation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                data-index={index}
                className={cn(
                  "feature-card group relative",
                  visibleFeatures.includes(index) && "animate-fade-in-up"
                )}
                style={{ animationDelay: `${feature.delay}ms` }}
              >
                <Card className="h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group-hover:-translate-y-2">
                  <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    `bg-gradient-to-br ${feature.color}`
                  )}></div>
                  
                  <CardHeader className="relative z-10">
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-all duration-300",
                      `bg-gradient-to-br ${feature.color}`,
                      "group-hover:scale-110 group-hover:rotate-3"
                    )}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <CardTitle className="text-xl font-semibold group-hover:text-white transition-colors">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="relative z-10">
                    <p className="text-gray-600 group-hover:text-white/90 transition-colors">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
              <Target className="h-3 w-3 mr-1" />
              How It Works
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Three Simple Steps to
              <span className="block bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Professional CIMs
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-24 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200"></div>
            
            {[
              {
                step: "1",
                title: "Upload Your Data",
                description: "Import your business information, financials, or meeting transcripts",
                icon: Upload
              },
              {
                step: "2",
                title: "AI Enhancement",
                description: "Our AI analyzes and structures your content into professional sections",
                icon: Zap
              },
              {
                step: "3",
                title: "Share Securely",
                description: "Export to PDF or share via secure link with NDA protection",
                icon: Shield
              }
            ].map((item, index) => (
              <div key={index} className="relative group">
                <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                  <div className="absolute -top-4 left-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                    {item.step}
                  </div>
                  
                  <div className="mt-8 mb-4">
                    <item.icon className="w-12 h-12 text-purple-600" />
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
              <MessageSquare className="h-3 w-3 mr-1" />
              Testimonials
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Loved by Teams
              <span className="block bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Worldwide
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <CardContent className="p-8">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  
                  <p className="text-gray-700 mb-6 italic">"{testimonial.content}"</p>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500"></div>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-gray-500">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Business Documentation?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who trust CIM Share for their confidential business documents.
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <MessageSquare className="mr-2 h-4 w-4" />
                Schedule Demo
              </Button>
            </Link>
          </div>
          
          <p className="text-white/70 text-sm mt-6">
            No credit card required • 7-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Modal for enlarged images */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-4xl w-full">
            <img 
              src={enlargedImage} 
              alt="Enlarged view"
              className="w-full h-auto rounded-lg shadow-2xl"
            />
            <button 
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 bg-white/10 backdrop-blur rounded-full p-2 hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fade-in-up {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-float {
          animation: float 20s ease-in-out infinite;
        }
        
        .animate-float-slow {
          animation: float-slow 6s ease-in-out infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}