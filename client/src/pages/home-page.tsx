import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PricingToggle } from "@/components/ui/pricing-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Star,
  ChevronDown,
  Play,
  Target,
  TrendingUp,
  Award,
  MessageSquare,
  Sprout,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [visibleElements, setVisibleElements] = useState<Set<string>>(
    new Set(),
  );
  const [scrollY, setScrollY] = useState(0);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [showSignupModal, setShowSignupModal] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const { toast } = useToast();

  const handlePricingClick = (planId: string) => {
    // Track LinkedIn conversions
    if (window.lintrk) {
      if (planId === 'enterprise') {
        window.lintrk('track', { conversion_id: 21789796 });
      } else if (planId === 'starter' || planId === 'starter_monthly') {
        window.lintrk('track', { conversion_id: 21789780 });
      } else if (planId === 'pro' || planId === 'pro_monthly' || planId === 'standard') {
        window.lintrk('track', { conversion_id: 21789788 });
      }
    }

    if (planId === 'enterprise') {
      // For Enterprise plan, open contact form
      window.open('mailto:contact@cimshare.com?subject=Enterprise Plan Inquiry&body=I am interested in learning more about your Enterprise plan for unlimited CIM generation.', '_blank');
    } else {
      // For all other plans, show signup modal
      setShowSignupModal(true);
    }
  };

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection Observer for scroll animations
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-animate-id");
          if (entry.isIntersecting && id) {
            setVisibleElements((prev) => new Set([...Array.from(prev), id]));
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "-50px 0px -50px 0px",
      },
    );

    // Observe all elements with data-animate-id
    const elementsToObserve = document.querySelectorAll("[data-animate-id]");
    elementsToObserve.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  // Helper function to check if element is visible
  const isVisible = (id: string) => visibleElements.has(id);
  const features = [
    {
      icon: Shield,
      title: "Protect Your Deal Flow",
      description:
        "Share confidential information safely with built-in NDAs that get signed before anyone sees your documents.",
      color: "text-green-500",
      link: "/features/nda-protection",
      size: "large",
    },
    {
      icon: Zap,
      title: "Save Days of Work",
      description:
        "Let AI extract business data from websites and documents, turning hours of research into minutes.",
      color: "text-orange-500",
      link: "/features/ai-powered-cim",
      size: "large",
    },
    {
      icon: Palette,
      title: "Make It Yours",
      description:
        "Drag, drop, and edit to match your brand perfectly—no design skills needed.",
      color: "text-blue-500",
      size: "medium",
    },
    {
      icon: Database,
      title: "Never Lose a Lead",
      description:
        "Keep every investor contact organized with automatic tracking of who viewed what and when.",
      color: "text-indigo-500",
      link: "/features/investor-database",
      size: "medium",
    },
    {
      icon: Download,
      title: "Share Anywhere",
      description:
        "Export polished PDFs that look exactly how you designed them, ready for any meeting.",
      color: "text-purple-500",
      size: "small",
    },
    {
      icon: PenTool,
      title: "Close Faster",
      description:
        "Get signatures instantly with built-in e-signing that tracks every approval.",
      color: "text-yellow-500",
      size: "small",
    },
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
                  textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                Create a CIM in Minutes.
                <br />
                Not Days.
              </h1>
              <p className="text-base sm:text-xl text-white/90 mb-6 sm:mb-8 max-w-2xl transform transition-all duration-1000 delay-200 ease-out">
                Build detailed CIMs with AI, then share with an NDA in no time.
              </p>
              <div className="transform transition-all duration-1000 delay-400 ease-out">
                <Link href="/login">
                  <Button
                    size="lg"
                    className="text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 hover:scale-105 hover:shadow-xl transition-all duration-300"
                  >
                    Create a Free CIM
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right side - Hero Video */}
            <div className="relative mt-8 lg:mt-0">
              <div className="relative">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-auto object-contain max-w-sm mx-auto lg:max-w-none rounded-xl shadow-2xl"
                >
                  <source src="/hero-video.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Icons Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large floating icons */}
          <div
            className="absolute top-20 left-10 animate-bounce"
            style={{ animationDelay: "0s", animationDuration: "3s" }}
          >
            <Shield className="w-8 h-8 text-white/20" />
          </div>
          <div
            className="absolute top-32 right-16 animate-bounce"
            style={{ animationDelay: "1s", animationDuration: "4s" }}
          >
            <FileText className="w-10 h-10 text-white/25" />
          </div>
          <div
            className="absolute top-40 left-1/4 animate-bounce"
            style={{ animationDelay: "2s", animationDuration: "3.5s" }}
          >
            <Lock className="w-6 h-6 text-white/20" />
          </div>
          <div
            className="absolute bottom-20 left-20 animate-bounce"
            style={{ animationDelay: "0.5s", animationDuration: "4.5s" }}
          >
            <Download className="w-7 h-7 text-white/25" />
          </div>
          <div
            className="absolute bottom-32 right-20 animate-bounce"
            style={{ animationDelay: "1.5s", animationDuration: "3s" }}
          >
            <Database className="w-9 h-9 text-white/20" />
          </div>
          <div
            className="absolute top-1/2 right-10 animate-bounce"
            style={{ animationDelay: "2.5s", animationDuration: "4s" }}
          >
            <Zap className="w-8 h-8 text-white/25" />
          </div>

          {/* Sparkle particles */}
          <div
            className="absolute top-16 left-1/3 animate-pulse"
            style={{ animationDelay: "0s", animationDuration: "2s" }}
          >
            <Sparkles className="w-4 h-4 text-white/30" />
          </div>
          <div
            className="absolute top-28 right-1/3 animate-pulse"
            style={{ animationDelay: "1s", animationDuration: "2.5s" }}
          >
            <Sparkles className="w-3 h-3 text-white/25" />
          </div>
          <div
            className="absolute bottom-24 left-1/2 animate-pulse"
            style={{ animationDelay: "1.5s", animationDuration: "2s" }}
          >
            <Sparkles className="w-5 h-5 text-white/20" />
          </div>
          <div
            className="absolute top-3/4 left-16 animate-pulse"
            style={{ animationDelay: "0.5s", animationDuration: "3s" }}
          >
            <Sparkles className="w-4 h-4 text-white/25" />
          </div>
          <div
            className="absolute top-1/4 right-1/4 animate-pulse"
            style={{ animationDelay: "2s", animationDuration: "2.5s" }}
          >
            <Sparkles className="w-3 h-3 text-white/30" />
          </div>

          {/* Additional floating elements */}
          <div
            className="absolute top-1/3 left-1/6 animate-bounce"
            style={{ animationDelay: "3s", animationDuration: "5s" }}
          >
            <Globe className="w-6 h-6 text-white/20" />
          </div>
          <div
            className="absolute bottom-1/3 right-1/6 animate-bounce"
            style={{ animationDelay: "2.5s", animationDuration: "4.5s" }}
          >
            <PenTool className="w-7 h-7 text-white/25" />
          </div>
          <div
            className="absolute top-1/2 left-1/2 animate-pulse"
            style={{ animationDelay: "1.8s", animationDuration: "3.5s" }}
          >
            <BarChart3 className="w-5 h-5 text-white/15" />
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className="py-8 sm:py-12 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6 sm:mb-8">
            <p className="text-gray-500 text-sm font-medium tracking-wider uppercase mb-4 sm:mb-6" data-testid="partners-label">
              Trusted by Leading Business Advisors
            </p>
          </div>
          <div className="relative">
            <div className="flex animate-carousel">
              {/* First set of logos */}
              <div className="flex items-center gap-3 sm:gap-6 md:gap-3 min-w-full px-2 sm:px-8 md:justify-around">
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale" data-testid="partner-transworld">
                  <img src="/tworld.png" alt="Transworld" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale" data-testid="partner-sunbelt">
                  <img src="/sunbelt-logo.png" alt="Sunbelt" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale" data-testid="partner-dealveinc">
                  <img src="/dealveinc-logo.png" alt="DealveInc" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale" data-testid="partner-murphy">
                  <img src="/murphylogo.png" alt="Murphy" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale" data-testid="partner-business-exits">
                  <img src="/bizexitslogo.png" alt="Business Exits" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale" data-testid="partner-songline">
                  <img src="/songline.png" alt="Songline" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale" data-testid="partner-ravenstone">
                  <img src="/ravenstonelogo.png" alt="Ravenstone" className="h-full w-auto object-contain max-w-full" />
                </div>
              </div>
              {/* Duplicate set for seamless loop */}
              <div className="flex items-center gap-3 sm:gap-6 md:gap-3 min-w-full px-2 sm:px-8 md:justify-around">
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale">
                  <img src="/tworld.png" alt="Transworld" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale">
                  <img src="/sunbelt-logo.png" alt="Sunbelt" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale">
                  <img src="/dealveinc-logo.png" alt="DealveInc" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale">
                  <img src="/murphylogo.png" alt="Murphy" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale">
                  <img src="/bizexitslogo.png" alt="Business Exits" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale">
                  <img src="/songline.png" alt="Songline" className="h-full w-auto object-contain max-w-full" />
                </div>
                <div className="h-10 sm:h-12 md:h-16 w-16 sm:w-24 md:w-32 lg:w-36 flex items-center justify-center flex-shrink-0 opacity-60 grayscale">
                  <img src="/ravenstonelogo.png" alt="Ravenstone" className="h-full w-auto object-contain max-w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                data-animate-id={`feature-${index}`}
                className={`transition-all duration-700 ${
                  isVisible(`feature-${index}`)
                    ? "translate-y-0 opacity-100"
                    : "translate-y-8 opacity-0"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <Card className="relative border border-gray-100 shadow-xl hover:shadow-2xl hover:-translate-y-3 transition-all duration-500 group h-full bg-gradient-to-br from-white via-gray-50/30 to-gray-50 overflow-hidden">
                  {/* Subtle pattern overlay */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                    <div className="absolute inset-0" style={{
                      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(0,0,0,0.05) 35px, rgba(0,0,0,0.05) 70px)`,
                    }}></div>
                  </div>

                  {/* Gradient accent on hover */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                    feature.color === 'text-green-500' ? 'from-green-400 to-green-600' :
                    feature.color === 'text-orange-500' ? 'from-orange-400 to-orange-600' :
                    feature.color === 'text-blue-500' ? 'from-blue-400 to-blue-600' :
                    feature.color === 'text-indigo-500' ? 'from-indigo-400 to-indigo-600' :
                    feature.color === 'text-purple-500' ? 'from-purple-400 to-purple-600' :
                    feature.color === 'text-yellow-500' ? 'from-yellow-400 to-yellow-600' :
                    'from-gray-400 to-gray-600'
                  } transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`}></div>

                  <CardHeader className="p-6 relative">
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${
                        feature.color === 'text-green-500' ? 'from-green-100 via-green-50 to-green-200' :
                        feature.color === 'text-orange-500' ? 'from-orange-100 via-orange-50 to-orange-200' :
                        feature.color === 'text-blue-500' ? 'from-blue-100 via-blue-50 to-blue-200' :
                        feature.color === 'text-indigo-500' ? 'from-indigo-100 via-indigo-50 to-indigo-200' :
                        feature.color === 'text-purple-500' ? 'from-purple-100 via-purple-50 to-purple-200' :
                        feature.color === 'text-yellow-500' ? 'from-yellow-100 via-yellow-50 to-yellow-200' :
                        'from-gray-100 via-gray-50 to-gray-200'
                      } flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}
                    >
                      <feature.icon
                        className={`w-7 h-7 ${feature.color} group-hover:scale-110 transition-transform duration-300`}
                      />
                    </div>
                    <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 flex-1 flex flex-col relative">
                    <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-2">
                      {feature.description}
                    </p>
                    {feature.link && (
                      <Link href={feature.link}>
                        <Button
                          variant="ghost"
                          className="mt-4 p-0 h-auto font-semibold text-blue-600 hover:text-blue-700 group-hover:translate-x-2 transition-all duration-300 flex items-center"
                        >
                          Learn more
                          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>

                  {/* Corner accent decoration */}
                  <div className={`absolute -bottom-8 -right-8 w-24 h-24 rounded-full ${
                    feature.color === 'text-green-500' ? 'bg-green-100/20' :
                    feature.color === 'text-orange-500' ? 'bg-orange-100/20' :
                    feature.color === 'text-blue-500' ? 'bg-blue-100/20' :
                    feature.color === 'text-indigo-500' ? 'bg-indigo-100/20' :
                    feature.color === 'text-purple-500' ? 'bg-purple-100/20' :
                    feature.color === 'text-yellow-500' ? 'bg-yellow-100/20' :
                    'bg-gray-100/20'
                  } blur-2xl group-hover:scale-150 transition-transform duration-700`}></div>
                </Card>
              </div>
            ))}
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
              isVisible("showcase-header")
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            }`}
            data-animate-id="showcase-header"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Advanced Analytics & Controls
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Track every interaction, manage NDAs seamlessly, and build
              relationships with comprehensive investor analytics
            </p>
          </div>

          <div className="max-w-7xl mx-auto space-y-20">
            {/* Investor Database Feature - Responsive Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
              <div
                className={`bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-500 group ${
                  isVisible("showcase-1")
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-8 opacity-0"
                }`}
                data-animate-id="showcase-1"
                onClick={() =>
                  setEnlargedImage("/investor-database-preview.png")
                }
              >
                <video
                  src="/investor-database-feature.mp4"
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div
                className={`space-y-4 sm:space-y-6 transition-all duration-1000 delay-200 ${
                  isVisible("showcase-1")
                    ? "translate-x-0 opacity-100"
                    : "translate-x-8 opacity-0"
                }`}
              >
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors duration-300">
                  Investor Database
                </h3>
                <p className="text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
                  Track investor contacts across all documents with analytics
                  and export capabilities. Manage relationships with
                  comprehensive contact tracking and automated data collection.
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium hover:bg-blue-200 transition-colors duration-300 cursor-pointer">
                    Contact Tracking
                  </span>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm font-medium hover:bg-green-200 transition-colors duration-300 cursor-pointer">
                    Export Tools
                  </span>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-100 text-purple-800 rounded-full text-xs sm:text-sm font-medium hover:bg-purple-200 transition-colors duration-300 cursor-pointer">
                    Relationship Management
                  </span>
                </div>
              </div>
            </div>

            {/* NDA Signatures Feature - Responsive Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
              <div
                className={`space-y-4 sm:space-y-6 order-2 sm:order-1 lg:order-1 transition-all duration-1000 ${
                  isVisible("showcase-2")
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-8 opacity-0"
                }`}
                data-animate-id="showcase-2"
              >
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 hover:text-red-600 transition-colors duration-300">
                  NDA Management
                </h3>
                <p className="text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
                  Digital signatures, approval controls, and comprehensive audit
                  trails for legal compliance. Streamline your NDA process with
                  automated workflows and tracking.
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-100 text-red-800 rounded-full text-xs sm:text-sm font-medium hover:bg-red-200 transition-colors duration-300 cursor-pointer">
                    Digital Signatures
                  </span>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-yellow-100 text-yellow-800 rounded-full text-xs sm:text-sm font-medium hover:bg-yellow-200 transition-colors duration-300 cursor-pointer">
                    Approval Controls
                  </span>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-100 text-indigo-800 rounded-full text-xs sm:text-sm font-medium hover:bg-indigo-200 transition-colors duration-300 cursor-pointer">
                    Audit Trails
                  </span>
                </div>
              </div>
              <div
                className={`bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-500 order-1 sm:order-2 lg:order-2 group ${
                  isVisible("showcase-2")
                    ? "translate-x-0 opacity-100"
                    : "translate-x-8 opacity-0"
                }`}
                style={{ transitionDelay: "200ms" }}
                onClick={() => setEnlargedImage("/nda-signatures-preview.png")}
              >
                <video
                  src="/nda-management-feature.mp4"
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Analytics Feature - Responsive Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
              <div
                className={`bg-white rounded-lg shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-500 group ${
                  isVisible("showcase-3")
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-8 opacity-0"
                }`}
                data-animate-id="showcase-3"
              >
                <video
                  src="/analytics optimized_1759637064475.mp4"
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div
                className={`space-y-4 sm:space-y-6 transition-all duration-1000 delay-200 ${
                  isVisible("showcase-3")
                    ? "translate-x-0 opacity-100"
                    : "translate-x-8 opacity-0"
                }`}
              >
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 hover:text-teal-600 transition-colors duration-300">
                  Analytics Dashboard
                </h3>
                <p className="text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
                  Comprehensive analytics with activity tracking, conversion
                  metrics, and detailed reporting. Make data-driven decisions
                  with powerful insights into document performance.
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-teal-100 text-teal-800 rounded-full text-xs sm:text-sm font-medium hover:bg-teal-200 transition-colors duration-300 cursor-pointer">
                    Activity Tracking
                  </span>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-100 text-purple-800 rounded-full text-xs sm:text-sm font-medium hover:bg-purple-200 transition-colors duration-300 cursor-pointer">
                    Conversion Metrics
                  </span>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-orange-100 text-orange-800 rounded-full text-xs sm:text-sm font-medium hover:bg-orange-200 transition-colors duration-300 cursor-pointer">
                    Performance Insights
                  </span>
                </div>
              </div>
            </div>

            {/* E-Signature Template Editor Feature - Responsive Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
              <div
                className={`space-y-4 sm:space-y-6 order-2 sm:order-1 lg:order-1 transition-all duration-1000 ${
                  isVisible("showcase-4")
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-8 opacity-0"
                }`}
                data-animate-id="showcase-4"
              >
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 hover:text-purple-600 transition-colors duration-300">
                  E-Signature Templates
                </h3>
                <p className="text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
                  Create custom PDF templates with drag-and-drop signature
                  fields. Upload any PDF document and position signature, name,
                  date, email, and text fields exactly where you need them for
                  professional document signing workflows.
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium hover:bg-blue-200 transition-colors duration-300 cursor-pointer">
                    PDF Template Editor
                  </span>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm font-medium hover:bg-green-200 transition-colors duration-300 cursor-pointer">
                    Drag & Drop Fields
                  </span>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-100 text-purple-800 rounded-full text-xs sm:text-sm font-medium hover:bg-purple-200 transition-colors duration-300 cursor-pointer">
                    Custom Positioning
                  </span>
                </div>
              </div>
              <div
                className={`bg-white rounded-lg shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-500 order-1 sm:order-2 lg:order-2 group ${
                  isVisible("showcase-4")
                    ? "translate-x-0 opacity-100"
                    : "translate-x-8 opacity-0"
                }`}
                style={{ transitionDelay: "200ms" }}
                onClick={() =>
                  setEnlargedImage("/e-signature-template-editor.png")
                }
              >
                <video
                  src="/esignature-feature.mp4"
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div
            className={`text-center mb-16 transition-all duration-1000 ${
              isVisible("pricing-header")
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            }`}
            data-animate-id="pricing-header"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-2">
              Choose the plan that fits your deal flow
            </p>
            <p className="text-lg font-semibold text-blue-600 mb-8">
              As low as $100 per CIM document
            </p>

            {/* Pricing Toggle */}
            <PricingToggle
              billingPeriod={billingPeriod}
              onToggle={setBillingPeriod}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Free Trial */}
            <Card className="relative border-2 border-gray-200 hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-gray-600" />
                </div>
                <CardTitle className="text-xl">Free Trial</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">$0</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 mb-4">Perfect for trying out CIM Share</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>1 CIM document (trial only)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Basic export options</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>7-day trial period</span>
                  </li>
                </ul>
                <Button
                  className="w-full mt-6"
                  variant="outline"
                  onClick={() => handlePricingClick('free')}
                >
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>

            {/* Starter Plan */}
            <Card className="relative border-2 border-green-500 hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                  <Sprout className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle className="text-xl">Starter Plan</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    {billingPeriod === "monthly" ? "$59" : "$599"}
                  </span>
                  <span className="text-gray-600 ml-1">
                    {billingPeriod === "monthly" ? "/month" : "/year"}
                  </span>
                  {billingPeriod === "annual" && (
                    <p className="text-xs text-gray-400 mt-1">$50/month billed annually</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 mb-4">For individual professionals</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>3 CIM documents per year</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Unlimited regenerations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>NDA management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Custom branding</span>
                  </li>
                </ul>
                <Button
                  className="w-full mt-6"
                  variant="outline"
                  onClick={() => handlePricingClick(billingPeriod === "monthly" ? "starter_monthly" : "starter")}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="relative border-2 border-blue-500 hover:shadow-xl transition-all duration-300 transform lg:scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <CardHeader className="pb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Pro Plan</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    {billingPeriod === "monthly" ? "$99" : "$999"}
                  </span>
                  <span className="text-gray-600 ml-1">
                    {billingPeriod === "monthly" ? "/month" : "/year"}
                  </span>
                  {billingPeriod === "annual" && (
                    <p className="text-xs text-gray-400 mt-1">$83/month billed annually</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 mb-4">Everything for your business</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>10 CIM documents per year</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Unlimited regenerations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>All features included</span>
                  </li>
                </ul>
                <Button
                  className="w-full mt-6"
                  onClick={() => handlePricingClick(billingPeriod === "monthly" ? "pro_monthly" : "pro")}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="relative border-2 border-purple-500 hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl">Enterprise</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">Custom</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 mb-4">For large organizations</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Unlimited CIMs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Dedicated support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Custom integrations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Team training</span>
                  </li>
                </ul>
                <Button
                  className="w-full mt-6"
                  variant="outline"
                  onClick={() => handlePricingClick('enterprise')}
                >
                  Contact Sales
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonial Section - Dark Background */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div
            className={`text-center mb-12 transition-all duration-1000 ${
              isVisible("testimonial-header")
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            }`}
            data-animate-id="testimonial-header"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              What Our Users Are Saying
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Join the many others that have modernized their CIMs
            </p>
          </div>

          {/* Testimonial Carousel */}
          <div className="relative space-y-8">
            {/* Row 1 - Scrolls left */}
            <div className="relative overflow-hidden px-4 lg:block">
              <div className="flex animate-testimonial-scroll">
                <div className="flex gap-8 pr-8">
                  {/* Testimonial 1 */}
                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[90vw] md:w-[45vw] lg:w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      I used to have my team create my CIMs and it would take days.
                      Now they're created in minutes, with AI grabbing info and
                      formatting tables and everything. Total game-changer.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>

                  {/* Testimonial 2 */}
                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[90vw] md:w-[45vw] lg:w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      eSign NDAs too?? This is what I need, thank you! Now I can move faster on deals.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>

                  {/* Testimonial 3 */}
                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[90vw] md:w-[45vw] lg:w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      Our CIMs used to look like crap - the easy part here was cimshare makes our CIMs look great. To buyers and sellers.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>
                </div>

                {/* Duplicate for seamless loop */}
                <div className="flex gap-8 pr-8">
                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[90vw] md:w-[45vw] lg:w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      I used to have my team create my CIMs and it would take days.
                      Now they're created in minutes, with AI grabbing info and
                      formatting tables and everything. Total game-changer.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>

                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[90vw] md:w-[45vw] lg:w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      eSign NDAs too?? This is what I need, thank you! Now I can move faster on deals.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>

                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[90vw] md:w-[45vw] lg:w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      Our CIMs used to look like crap - the easy part here was cimshare makes our CIMs look great. To buyers and sellers.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2 - Scrolls right (only on desktop) */}
            <div className="relative overflow-hidden px-4 hidden lg:block">
              <div className="flex animate-testimonial-scroll-reverse">
                <div className="flex gap-8 pr-8">
                  {/* Testimonial 4 */}
                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      I love it and my clients think I'm awesome for making it so fast
                      and so nice-looking. I'm glad the guys that made{" "}
                      <a
                        href="https://vettingvault.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline decoration-dotted underline-offset-2 transition-colors"
                      >
                        Vetting Vault
                      </a>{" "}
                      also made this for brokers.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>

                  {/* Testimonial 5 */}
                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      Love the geographic distribution map of my buyers, and it's easy to filter - very cool.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>

                  {/* Testimonial 6 */}
                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      Would pay 5x the price for this.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>
                </div>

                {/* Duplicate for seamless loop */}
                <div className="flex gap-8 pr-8">
                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      I love it and my clients think I'm awesome for making it so fast
                      and so nice-looking. I'm glad the guys that made{" "}
                      <a
                        href="https://vettingvault.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline decoration-dotted underline-offset-2 transition-colors"
                      >
                        Vetting Vault
                      </a>{" "}
                      also made this for brokers.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>

                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      Love the geographic distribution map of my buyers, and it's easy to filter - very cool.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>

                  <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 flex-shrink-0 w-[400px]">
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <blockquote className="text-lg text-gray-100 leading-relaxed">
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                      Would pay 5x the price for this.
                      <span className="text-3xl text-blue-400 leading-none">"</span>
                    </blockquote>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div
            className={`text-center mb-16 transition-all duration-1000 ${
              isVisible("examples-header")
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            }`}
            data-animate-id="examples-header"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              See CIM Share in Action
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore real examples of professional CIM documents created with
              our platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Tony's Transmissions Image Card */}
            <div
              className={`relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl hover:-translate-y-4 hover:rotate-1 transition-all duration-500 cursor-pointer group ${
                isVisible("example-1")
                  ? "translate-y-0 opacity-100"
                  : "translate-y-8 opacity-0"
              }`}
              data-animate-id="example-1"
              onClick={() =>
                window.open("https://cimshare.com/share/cim-q3bqjm", "_blank")
              }
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
                isVisible("example-2")
                  ? "translate-y-0 opacity-100"
                  : "translate-y-8 opacity-0"
              }`}
              data-animate-id="example-2"
              style={{ transitionDelay: "200ms" }}
              onClick={() =>
                window.open("https://cimshare.com/share/cim-2axr79", "_blank")
              }
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

      {/* FAQ Section */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about creating professional CIMs with our platform
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="bg-white border rounded-lg px-6">
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="text-lg font-medium">How quickly can I create a CIM?</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-gray-600">
                  Most users can create a complete, professional CIM in under 30 minutes. Our AI-powered tools extract information from websites and documents automatically, and our templates handle all the formatting. What used to take days now takes minutes.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="bg-white border rounded-lg px-6">
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="text-lg font-medium">What's included in the $100 per CIM cost?</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-gray-600">
                  Each CIM includes unlimited regenerations, full customization options, NDA management with digital signatures, secure sharing links, PDF exports, and investor tracking. You can edit and update your CIM as many times as needed without additional charges.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="bg-white border rounded-lg px-6">
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="text-lg font-medium">How does the NDA protection work?</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-gray-600">
                  When you share a CIM, recipients must first review and digitally sign your NDA before accessing the document. We track all signatures, timestamps, and document access automatically. You can use our standard NDA template or upload your own.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="bg-white border rounded-lg px-6">
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="text-lg font-medium">Can I customize the CIM with my branding?</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-gray-600">
                  Yes! You can add your company logo, choose custom colors, fonts, and layouts. Every section is fully editable with our drag-and-drop editor. Your CIMs will look like they were professionally designed specifically for your firm.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="bg-white border rounded-lg px-6">
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="text-lg font-medium">Is my data secure?</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-gray-600">
                  Absolutely. We use bank-level encryption for all data transmission and storage. Your documents are hosted on secure servers with industry-standard security protocols. Only you and the people you explicitly share with can access your CIMs. We never share or sell your data.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="bg-white border rounded-lg px-6">
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="text-lg font-medium">What if I need more than 10 CIMs per year?</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-gray-600">
                  Our Enterprise plan offers unlimited CIM creation along with dedicated support, custom integrations, and team training. Contact our sales team for custom pricing that fits your business volume.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-cyan-400 via-blue-500 via-purple-500 via-pink-500 to-orange-400 pt-12 pb-0 relative overflow-hidden">
        {/* Floating Icons Background - matching hero section */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large floating icons */}
          <div
            className="absolute top-20 left-10 animate-bounce"
            style={{ animationDelay: "0s", animationDuration: "3s" }}
          >
            <Shield className="w-8 h-8 text-white/20" />
          </div>
          <div
            className="absolute top-32 right-16 animate-bounce"
            style={{ animationDelay: "1s", animationDuration: "4s" }}
          >
            <FileText className="w-10 h-10 text-white/25" />
          </div>
          <div
            className="absolute top-40 left-1/4 animate-bounce"
            style={{ animationDelay: "2s", animationDuration: "3.5s" }}
          >
            <Lock className="w-6 h-6 text-white/20" />
          </div>
          <div
            className="absolute bottom-20 left-20 animate-bounce"
            style={{ animationDelay: "0.5s", animationDuration: "4.5s" }}
          >
            <Download className="w-7 h-7 text-white/25" />
          </div>
          <div
            className="absolute bottom-32 right-20 animate-bounce"
            style={{ animationDelay: "1.5s", animationDuration: "3s" }}
          >
            <Database className="w-9 h-9 text-white/20" />
          </div>
          <div
            className="absolute top-1/2 right-10 animate-bounce"
            style={{ animationDelay: "2.5s", animationDuration: "4s" }}
          >
            <Zap className="w-8 h-8 text-white/25" />
          </div>

          {/* Sparkle particles */}
          <div
            className="absolute top-16 left-1/3 animate-pulse"
            style={{ animationDelay: "0s", animationDuration: "2s" }}
          >
            <Sparkles className="w-4 h-4 text-white/30" />
          </div>
          <div
            className="absolute top-28 right-1/3 animate-pulse"
            style={{ animationDelay: "1s", animationDuration: "2.5s" }}
          >
            <Sparkles className="w-3 h-3 text-white/25" />
          </div>
          <div
            className="absolute bottom-24 left-1/2 animate-pulse"
            style={{ animationDelay: "1.5s", animationDuration: "2s" }}
          >
            <Sparkles className="w-5 h-5 text-white/20" />
          </div>
          <div
            className="absolute top-3/4 left-16 animate-pulse"
            style={{ animationDelay: "0.5s", animationDuration: "3s" }}
          >
            <Sparkles className="w-4 h-4 text-white/25" />
          </div>
          <div
            className="absolute top-1/4 right-1/4 animate-pulse"
            style={{ animationDelay: "2s", animationDuration: "2.5s" }}
          >
            <Sparkles className="w-3 h-3 text-white/30" />
          </div>

          {/* Additional floating elements */}
          <div
            className="absolute top-1/3 left-1/6 animate-bounce"
            style={{ animationDelay: "3s", animationDuration: "5s" }}
          >
            <Globe className="w-6 h-6 text-white/20" />
          </div>
          <div
            className="absolute bottom-1/3 right-1/6 animate-bounce"
            style={{ animationDelay: "2.5s", animationDuration: "4.5s" }}
          >
            <PenTool className="w-7 h-7 text-white/25" />
          </div>
          <div
            className="absolute top-1/2 left-1/2 animate-pulse"
            style={{ animationDelay: "1.8s", animationDuration: "3.5s" }}
          >
            <BarChart3 className="w-5 h-5 text-white/15" />
          </div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-end">
            {/* Left side - Text content */}
            <div className="text-center lg:text-left pb-20">
              <h2
                className="text-3xl md:text-4xl font-bold text-white mb-6"
                style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
              >
                Ready to Make CIMs the Easy Way?
              </h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl">
                Join thousands of professionals who trust CIM Share for their
                confidential business documentation needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="text-lg px-8 py-3"
                  >
                    Create a Free CIM
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg px-8 py-3 border-white text-gray-900 bg-white hover:bg-gray-100"
                  >
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right side - Mobile mockup */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                <img
                  src="/hero-computer.png"
                  alt="CIM Share platform showing professional business documentation with laptop and mobile views"
                  className="w-full max-w-md h-auto drop-shadow-2xl"
                  style={{ marginBottom: "-2px" }}
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

        @keyframes carousel {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes testimonial-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes testimonial-scroll-reverse {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }

        .animate-carousel {
          animation: carousel 30s linear infinite;
        }

        .animate-carousel:hover {
          animation-play-state: paused;
        }

        .animate-testimonial-scroll {
          animation: testimonial-scroll 60s linear infinite;
        }

        .animate-testimonial-scroll:hover {
          animation-play-state: paused;
        }

        .animate-testimonial-scroll-reverse {
          animation: testimonial-scroll-reverse 60s linear infinite;
        }

        .animate-testimonial-scroll-reverse:hover {
          animation-play-state: paused;
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

      {/* Signup Modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Great choice!</DialogTitle>
            <DialogDescription className="text-center text-lg pt-2">
              First, let's create an account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-3 mt-4">
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
              size="lg"
              onClick={() => {
                setShowSignupModal(false);
                window.location.href = '/login?tab=register';
              }}
            >
              Create Account
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSignupModal(false)}
            >
              Maybe Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
