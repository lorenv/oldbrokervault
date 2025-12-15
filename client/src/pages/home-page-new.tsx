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
  WandSparkles,
  Building2,
  FileSignature,
  Eye,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/seo-head";

export default function HomePageNew() {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set());
  const [scrollY, setScrollY] = useState(0);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<"marketing" | "creation" | "management">("marketing");
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
      window.open('mailto:contact@cimshare.com?subject=Enterprise Plan Inquiry&body=I am interested in learning more about your Enterprise plan for unlimited CIM generation.', '_blank');
    } else {
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

    const elementsToObserve = document.querySelectorAll("[data-animate-id]");
    elementsToObserve.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  const isVisible = (id: string) => visibleElements.has(id);

  // Buyer Journey Steps
  const journeySteps = [
    {
      step: 1,
      icon: Globe,
      title: "Public Listings",
      subtitle: "Branded Marketplace",
      description: "Your own /listings page - searchable, filterable deals that attract qualified buyers",
      color: "from-blue-500 to-cyan-500",
      badge: "NEW",
    },
    {
      step: 2,
      icon: FileText,
      title: "AI Teaser",
      subtitle: "Anonymous Preview",
      description: "AI-generated summaries with key financials - buyers qualify themselves",
      color: "from-purple-500 to-pink-500",
      badge: "NEW",
    },
    {
      step: 3,
      icon: FileSignature,
      title: "NDA Signing",
      subtitle: "Instant & Mobile",
      description: "Built-in e-signatures with full audit trail - signed in seconds, not days",
      color: "from-orange-500 to-red-500",
      badge: null,
    },
    {
      step: 4,
      icon: Eye,
      title: "Full CIM",
      subtitle: "Complete Access",
      description: "Professional CIM with all details - only after NDA is signed",
      color: "from-green-500 to-emerald-500",
      badge: null,
    },
  ];

  // Platform Features by Category
  const featureCategories = {
    marketing: {
      title: "Deal Marketing",
      features: [
        { icon: Globe, title: "Public Listings Page", description: "Create your branded marketplace with searchable deals", isNew: true },
        { icon: Sparkles, title: "AI-Generated Teasers", description: "Automatically create anonymized business summaries", isNew: true },
        { icon: Download, title: "Branded Share Links", description: "Custom URLs with your branding for every deal" },
        { icon: FileText, title: "PDF Export", description: "Export polished PDFs ready for any meeting" },
      ],
    },
    creation: {
      title: "Document Creation",
      features: [
        { icon: Zap, title: "AI CIM Generator", description: "Turn hours of research into minutes with AI extraction" },
        { icon: WandSparkles, title: "SDE Analyzer", description: "Upload financials and get automatic revenue summaries" },
        { icon: Palette, title: "Custom Templates", description: "Design professional CIMs that match your brand" },
      ],
    },
    management: {
      title: "Deal Management",
      features: [
        { icon: PenTool, title: "E-Signatures", description: "Get signatures instantly with built-in e-signing", isEnhanced: true },
        { icon: Shield, title: "NDA Management", description: "Track and manage NDAs across all your deals" },
        { icon: Database, title: "Investor CRM", description: "Keep every investor contact organized automatically" },
        { icon: BarChart3, title: "Analytics Dashboard", description: "Track views, engagement, and conversions" },
      ],
    },
  };

  // E-Signature Highlights
  const esignFeatures = [
    { icon: Users, title: "Sequential & Parallel Signing", description: "Control signing order or let everyone sign at once" },
    { icon: Sparkles, title: "AI Document Summarization", description: "Signers get AI summaries before signing" },
    { icon: Smartphone, title: "Mobile Signing", description: "Sign from any device, anywhere" },
    { icon: FileText, title: "Reusable Templates", description: "Save time with pre-built document templates" },
    { icon: Palette, title: "Custom Branding", description: "Your logo and colors on every document" },
    { icon: Shield, title: "Full Audit Trails", description: "Complete compliance with timestamped logs" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="CIM Share - The Complete M&A Deal Flow Platform"
        description="The complete M&A platform for business brokers and advisors. Create branded listings, share AI-powered teasers, collect NDA signatures, and deliver professional CIMs - all in one seamless workflow."
        canonicalUrl="https://cimshare.com"
      />

      {/* ============================================ */}
      {/* SECTION 1: HERO WITH JOURNEY VISUALIZATION */}
      {/* ============================================ */}
      <section className="bg-gradient-to-br from-cyan-400 via-blue-500 via-purple-500 via-pink-500 to-orange-400 pt-32 pb-20 relative overflow-hidden">
        {/* Floating background icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[Shield, FileText, Lock, Download, Database, Zap, Globe, PenTool, BarChart3].map((Icon, i) => (
            <div
              key={i}
              className="absolute text-white/10 animate-float"
              style={{
                left: `${10 + (i * 10)}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.5}s`,
                transform: `translateY(${scrollY * 0.1 * (i % 2 === 0 ? 1 : -1)}px)`,
              }}
            >
              <Icon size={40 + (i % 3) * 20} />
            </div>
          ))}
        </div>

        <div className="container mx-auto px-4 relative z-10">
          {/* Hero Text */}
          <div className="text-center mb-16 animate-fade-in-up">
            <h1
              className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 text-white leading-tight pb-2"
              style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
            >
              The Complete M&A
              <br />
              Deal Flow Platform
            </h1>
            <p className="text-base sm:text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Create branded listings, share AI-powered teasers, collect NDA signatures,
              and deliver professional CIMs - all in one seamless workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 shadow-lg text-lg px-8">
                  Start Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#journey">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/20 text-lg px-8">
                  See the Full Deal Flow
                  <ChevronDown className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>

          {/* Buyer Journey Flow - Hero Version */}
          <div
            id="journey"
            className="max-w-6xl mx-auto"
            data-animate-id="hero-journey"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-2">
              {journeySteps.map((step, index) => (
                <div key={step.step} className="relative">
                  {/* Connector Arrow (hidden on mobile, shown on md+) */}
                  {index < journeySteps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <ChevronRight className="h-6 w-6 text-white/60" />
                    </div>
                  )}

                  {/* Step Card */}
                  <div
                    className={`
                      bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20
                      hover:bg-white/20 transition-all duration-300 hover:scale-105
                      ${isVisible("hero-journey") ? "animate-fade-in-up" : "opacity-0"}
                    `}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {/* Badge */}
                    {step.badge && (
                      <span className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
                        {step.badge}
                      </span>
                    )}

                    {/* Step Number */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${step.color} flex items-center justify-center shadow-lg`}>
                        <span className="text-white font-bold">{step.step}</span>
                      </div>
                      <step.icon className="h-6 w-6 text-white/80" />
                    </div>

                    {/* Content */}
                    <h3 className="text-white font-bold text-lg mb-1">{step.title}</h3>
                    <p className="text-white/70 text-sm font-medium mb-2">{step.subtitle}</p>
                    <p className="text-white/60 text-sm">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 2: BUYER JOURNEY DETAIL (Expanded) */}
      {/* ============================================ */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div
            className="text-center mb-16"
            data-animate-id="journey-header"
          >
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 transition-all duration-700 ${isVisible("journey-header") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              How Buyers Experience Your Deals
            </h2>
            <p className={`text-xl text-gray-600 max-w-2xl mx-auto transition-all duration-700 delay-150 ${isVisible("journey-header") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              A seamless journey from discovery to due diligence - automated and secure
            </p>
          </div>

          {/* Detailed Journey Steps */}
          <div className="max-w-5xl mx-auto space-y-8">
            {journeySteps.map((step, index) => (
              <div
                key={step.step}
                data-animate-id={`journey-step-${step.step}`}
                className={`
                  flex flex-col md:flex-row items-center gap-8 p-8 bg-white rounded-2xl shadow-lg
                  transition-all duration-700
                  ${isVisible(`journey-step-${step.step}`) ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}
                  ${index % 2 === 1 ? "md:flex-row-reverse" : ""}
                `}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* Icon/Visual Side */}
                <div className={`flex-shrink-0 w-32 h-32 rounded-2xl bg-gradient-to-r ${step.color} flex items-center justify-center shadow-xl`}>
                  <step.icon className="h-16 w-16 text-white" />
                </div>

                {/* Content Side */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                    <span className="text-sm font-bold text-gray-400">STEP {step.step}</span>
                    {step.badge && (
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                        {step.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-lg">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 3: PARTNERS / SOCIAL PROOF */}
      {/* ============================================ */}
      <section className="py-16 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <h3 className="text-center text-gray-500 text-sm font-medium mb-8 tracking-wider uppercase">
            Trusted by Leading Business Advisors
          </h3>
          <div className="relative">
            <div className="flex animate-scroll-left">
              {[...Array(2)].map((_, setIndex) => (
                <div key={setIndex} className="flex items-center gap-16 px-8">
                  {["transworld", "sunbelt", "dealveinc", "murphy", "businessexits", "songline", "ravenstone"].map((partner) => (
                    <img
                      key={`${setIndex}-${partner}`}
                      src={`/partners/${partner}.webp`}
                      alt={partner}
                      className="h-10 md:h-12 object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 4: PLATFORM FEATURES (Tabbed) */}
      {/* ============================================ */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12" data-animate-id="features-header">
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 transition-all duration-700 ${isVisible("features-header") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              Everything You Need to Close Deals Faster
            </h2>
            <p className={`text-xl text-gray-600 max-w-2xl mx-auto transition-all duration-700 delay-150 ${isVisible("features-header") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              One platform for the entire M&A deal lifecycle
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex bg-white rounded-xl p-1 shadow-md">
              {(["marketing", "creation", "management"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFeatureTab(tab)}
                  className={`
                    px-6 py-3 rounded-lg font-medium transition-all duration-300
                    ${activeFeatureTab === tab
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}
                  `}
                >
                  {featureCategories[tab].title}
                </button>
              ))}
            </div>
          </div>

          {/* Feature Cards */}
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {featureCategories[activeFeatureTab].features.map((feature, index) => (
                <Card
                  key={feature.title}
                  className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500">
                        <feature.icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{feature.title}</h3>
                          {feature.isNew && (
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">NEW</span>
                          )}
                          {feature.isEnhanced && (
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">ENHANCED</span>
                          )}
                        </div>
                        <p className="text-gray-600">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 5: E-SIGNATURES SPOTLIGHT */}
      {/* ============================================ */}
      <section className="py-20 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16" data-animate-id="esign-header">
            <span className="text-blue-400 font-medium text-sm tracking-wider uppercase mb-4 block">Enterprise Feature</span>
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 text-white transition-all duration-700 ${isVisible("esign-header") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              Enterprise E-Signatures, Built for M&A
            </h2>
            <p className={`text-xl text-gray-400 max-w-2xl mx-auto transition-all duration-700 delay-150 ${isVisible("esign-header") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              DocuSign-level power designed specifically for deal workflows
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {esignFeatures.map((feature, index) => (
                <div
                  key={feature.title}
                  data-animate-id={`esign-feature-${index}`}
                  className={`
                    bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10
                    hover:bg-white/10 transition-all duration-300
                    ${isVisible(`esign-feature-${index}`) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
                  `}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <feature.icon className="h-10 w-10 text-blue-400 mb-4" />
                  <h3 className="text-white font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link href="/features/esignatures">
                <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white">
                  See E-Signatures in Action
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 6: PRICING */}
      {/* ============================================ */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600 mb-8">Choose the plan that fits your deal flow</p>
            <PricingToggle value={billingPeriod} onChange={setBillingPeriod} />
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Free Plan */}
            <Card className="border-2 hover:border-gray-300 transition-all">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">Free</CardTitle>
                <div className="text-4xl font-bold">$0</div>
                <p className="text-gray-500 text-sm">1 CIM document</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> 1 CIM document</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> AI-powered generation</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> NDA protection</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> AI Teasers</li>
                </ul>
                <Button className="w-full mt-6" variant="outline" onClick={() => handlePricingClick('free')}>
                  Get Started
                </Button>
              </CardContent>
            </Card>

            {/* Starter Plan */}
            <Card className="border-2 hover:border-blue-300 transition-all">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">Starter</CardTitle>
                <div className="text-4xl font-bold">${billingPeriod === "annual" ? "599" : "59"}</div>
                <p className="text-gray-500 text-sm">{billingPeriod === "annual" ? "/year" : "/month"}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> 3 CIMs per year</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Everything in Free</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Public Listings Page</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Unlimited E-Signatures</li>
                </ul>
                <Button className="w-full mt-6" onClick={() => handlePricingClick('starter')}>
                  Choose Starter
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-blue-500 shadow-xl scale-105 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                MOST POPULAR
              </div>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">Pro</CardTitle>
                <div className="text-4xl font-bold">${billingPeriod === "annual" ? "999" : "99"}</div>
                <p className="text-gray-500 text-sm">{billingPeriod === "annual" ? "/year" : "/month"}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> 10 CIMs per year</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Everything in Starter</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> SDE Analyzer</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Priority Support</li>
                </ul>
                <Button className="w-full mt-6 bg-blue-500 hover:bg-blue-600" onClick={() => handlePricingClick('pro')}>
                  Choose Pro
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border-2 hover:border-gray-300 transition-all">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">Enterprise</CardTitle>
                <div className="text-4xl font-bold">Custom</div>
                <p className="text-gray-500 text-sm">Unlimited CIMs</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Unlimited CIMs</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Everything in Pro</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> White-label option</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Dedicated support</li>
                </ul>
                <Button className="w-full mt-6" variant="outline" onClick={() => handlePricingClick('enterprise')}>
                  Contact Us
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 7: FAQ */}
      {/* ============================================ */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="listings" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-medium">
                How do public listings work?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Each broker gets their own branded listings page (e.g., cimshare.com/listings/your-company).
                You can add deals with teasers, set them as featured, and buyers can browse, filter, and search
                your available opportunities - all without needing to sign an NDA until they want to see the full CIM.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="teaser-vs-cim" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-medium">
                What is a teaser vs a CIM?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                A teaser is an anonymized, high-level summary of a business opportunity - it includes industry,
                deal type, and key financials without revealing the company name. Buyers see this before signing
                an NDA. The CIM (Confidential Information Memorandum) is the full document with all details,
                only accessible after the NDA is signed.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="mobile-nda" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-medium">
                Can buyers sign NDAs on mobile?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Yes! Our e-signature system is fully mobile-optimized. Buyers can review and sign NDAs from
                any smartphone or tablet. The signing experience is touch-friendly with a responsive design
                that works on all screen sizes.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="esign-comparison" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-medium">
                How does your e-signature compare to DocuSign?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Our e-signature system offers similar capabilities to DocuSign - templates, sequential signing,
                audit trails, completion certificates, and custom branding. The key difference is it's built
                specifically for M&A workflows and integrated directly with your CIMs and NDAs, so there's no
                switching between platforms. Plus, it includes AI document summarization for signers.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="how-fast" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-medium">
                How quickly can I create a CIM?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Most users create their first CIM in under 30 minutes. Our AI extracts business information
                from websites and documents, and you can customize the output with our intuitive editor.
                Complex CIMs with extensive financial data may take a bit longer.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-secure" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left font-medium">
                Is my data secure?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Absolutely. We use bank-level encryption for all data in transit and at rest. NDAs are
                required before accessing confidential information, and we maintain complete audit trails
                of who viewed what and when. Your data is never shared or used for training AI models.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 8: FINAL CTA */}
      {/* ============================================ */}
      <section className="py-20 bg-gradient-to-br from-cyan-400 via-blue-500 via-purple-500 via-pink-500 to-orange-400 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
            Ready to Streamline Your Entire Deal Flow?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of M&A professionals using CIM Share to manage deals from listing to closing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 shadow-lg text-lg px-8">
                Start Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/20 text-lg px-8">
                Book a Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Signup Modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Your Account</DialogTitle>
            <DialogDescription>
              Sign up to get started with CIM Share
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Link href="/login">
              <Button className="w-full" size="lg">
                Continue to Sign Up
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSS Animations */}
      <style>{`
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

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-scroll-left {
          animation: scroll-left 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
