import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderLock,
  Users,
  FileCheck,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Lock,
  Eye,
  BarChart3,
  Zap
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function DataRoomPage() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const couponCode = "brokervault";

  const handleCopyCoupon = () => {
    navigator.clipboard.writeText(couponCode);
    setCopied(true);
    toast({
      title: "Coupon code copied!",
      description: "Use code 'brokervault' for 25% off at VettingVault.com",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const features = [
    {
      icon: Lock,
      title: "Bank-Level Security",
      description: "256-bit encryption protects your sensitive deal documents"
    },
    {
      icon: Eye,
      title: "Granular Permissions",
      description: "Control exactly who sees what with folder and file-level access"
    },
    {
      icon: BarChart3,
      title: "Detailed Analytics",
      description: "Track document views, time spent, and engagement metrics"
    },
    {
      icon: FileCheck,
      title: "Q&A Management",
      description: "Streamlined buyer questions and seller responses in one place"
    },
    {
      icon: Users,
      title: "Unlimited Users",
      description: "Invite as many buyers, advisors, and team members as needed"
    },
    {
      icon: Clock,
      title: "Watermarking & Expiry",
      description: "Auto-watermark documents and set access expiration dates"
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Virtual Data Room</h1>
        <p className="text-gray-600 mt-1">Secure document management for M&A transactions</p>
      </div>

      {/* Coming Soon Integration Banner */}
      <Card className="mb-6 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Zap className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">VettingVault Integration Coming Soon!</p>
              <p className="text-sm text-gray-600">
                We're building a direct integration with VettingVault. In the meantime, sign up below to get started with their platform.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Promotion Card */}
      <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 mb-8">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Left side - Content */}
            <div className="p-8 md:p-12 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 text-sm font-medium px-3 py-1 rounded-full w-fit mb-6">
                <Sparkles className="h-4 w-4" />
                Recommended Partner
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Get Started with VettingVault
              </h2>

              <p className="text-slate-300 text-lg mb-6 leading-relaxed">
                VettingVault provides enterprise-grade virtual data rooms designed specifically
                for business brokers and M&A professionals. Sign up today and get an exclusive
                discount as a BrokerVault user.
              </p>

              {/* Coupon Code Box */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-indigo-300 text-sm font-medium uppercase tracking-wide">
                    Exclusive BrokerVault Discount
                  </span>
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                    25% OFF
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3">
                    <code className="text-2xl font-mono font-bold text-white tracking-wider">
                      {couponCode}
                    </code>
                  </div>
                  <Button
                    onClick={handleCopyCoupon}
                    variant="secondary"
                    className="h-12 px-4 bg-white hover:bg-gray-100 text-slate-900"
                  >
                    {copied ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  Apply at checkout for 25% off any plan
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                >
                  <a
                    href="https://vettingvault.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Try VettingVault Free
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-slate-400 text-white hover:bg-slate-700 hover:text-white"
                >
                  <a
                    href="https://vettingvault.com/features"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Features
                  </a>
                </Button>
              </div>
            </div>

            {/* Right side - Logo and visual */}
            <div className="relative hidden md:flex items-center justify-center bg-gradient-to-br from-indigo-600/20 to-purple-600/20 p-12">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15)_0%,transparent_70%)]" />

              {/* Decorative elements */}
              <div className="absolute top-8 right-8 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl" />
              <div className="absolute bottom-12 left-8 w-32 h-32 bg-purple-500/10 rounded-full blur-xl" />

              {/* Logo */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white rounded-2xl p-6 shadow-2xl shadow-black/20">
                  <img
                    src="/VVlogo.png"
                    alt="VettingVault"
                    className="w-32 h-32 object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Why Use a Virtual Data Room?</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <Card key={index} className="border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">{feature.title}</h4>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <Card className="bg-gradient-to-r from-slate-50 to-indigo-50 border-indigo-100">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <FolderLock className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Ready to secure your deal documents?</p>
                <p className="text-sm text-gray-600">Start your free trial today - no credit card required</p>
              </div>
            </div>
            <Button
              asChild
              className="bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
            >
              <a
                href="https://vettingvault.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get Started Free
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
