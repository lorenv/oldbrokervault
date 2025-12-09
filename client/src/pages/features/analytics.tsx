import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  BarChart3,
  Eye,
  Clock,
  Users,
  TrendingUp,
  FileText,
  MapPin,
  Calendar,
  Activity,
  CheckCircle,
  ArrowRight,
  Globe,
  MousePointer,
  Timer,
  Download,
  PieChart,
  Target,
  Sparkles
} from "lucide-react";
import { useState, useEffect } from "react";
import { SEOHead } from "@/components/seo-head";

export default function AnalyticsFeaturePage() {
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-animate-id');
          if (entry.isIntersecting && id) {
            setVisibleElements(prev => new Set([...prev, id]));
          }
        });
      },
      { threshold: 0.1, rootMargin: '-50px 0px -50px 0px' }
    );

    const elementsToObserve = document.querySelectorAll('[data-animate-id]');
    elementsToObserve.forEach(el => observer.observe(el));

    return () => elementsToObserve.forEach(el => observer.unobserve(el));
  }, []);

  const isVisible = (id: string) => visibleElements.has(id);

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Analytics Dashboard - Track CIM Engagement & Buyer Interest | CIM Share"
        description="Get real-time insights into how buyers engage with your CIMs. Track views, time spent, geographic distribution, section engagement, and identify your hottest prospects."
        canonicalUrl="https://cimshare.com/features/analytics"
      />
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 transition-colors duration-300">
              <BarChart3 className="h-4 w-4 mr-2" />
              Real-Time Analytics
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-slate-900 leading-tight animate-text-gradient">
              Know Exactly Who's Interested
            </h1>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Track every view, measure engagement, and identify serious buyers. CIM Share's analytics
              dashboard gives you unprecedented visibility into how prospects interact with your deals.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  View Analytics Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="https://meetings-na2.hubspot.com/rob-kale" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-slate-300 hover:bg-slate-50 hover:scale-105 transition-all duration-300">
                  Book a Demo
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshot Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
            <img
              src="/analytics-ss.png"
              alt="CIM Share Analytics Dashboard - Track buyer engagement and document views"
              className="w-full"
            />
          </div>
          <p className="text-center text-sm text-slate-500 mt-4">
            Real-time analytics showing buyer engagement with your CIMs
          </p>
        </div>
      </section>

      {/* Key Metrics Overview */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Sparkles className="h-4 w-4 mr-2" />
              Key Metrics
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">
              Track What Matters Most
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Essential metrics at a glance to understand buyer interest and engagement
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Eye className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-2xl text-slate-900 mb-1">Total Views</h3>
                  <p className="text-sm text-slate-600">Track how many times your CIM has been viewed</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-2xl text-slate-900 mb-1">Unique Viewers</h3>
                  <p className="text-sm text-slate-600">Number of distinct individuals who viewed</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-14 h-14 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Timer className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-2xl text-slate-900 mb-1">Avg. Time Spent</h3>
                  <p className="text-sm text-slate-600">How long viewers engage with your document</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-2xl text-slate-900 mb-1">Engagement Rate</h3>
                  <p className="text-sm text-slate-600">Percentage of viewers who engage deeply</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Viewer Activity Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                <Activity className="h-4 w-4 mr-2" />
                Viewer Activity
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                See Who Viewed Your CIM and When
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Get a complete activity log of every viewer interaction. Know exactly when buyers
                accessed your document, how long they spent, and which sections captured their attention.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mt-1">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Real-Time Tracking</h4>
                    <p className="text-slate-600 text-sm">See views as they happen with live activity updates</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Viewer Identification</h4>
                    <p className="text-slate-600 text-sm">See names and emails of NDA signers who accessed your CIM</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center mt-1">
                    <Target className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Repeat Visitors</h4>
                    <p className="text-slate-600 text-sm">Identify highly interested buyers by return visit patterns</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-slate-50 rounded-2xl p-6 shadow-lg border border-slate-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                    <span className="font-medium">Recent Activity</span>
                    <Badge className="bg-green-100 text-green-700">Live</Badge>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Eye className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Sarah Martinez</p>
                        <p className="text-xs text-slate-500">Viewed 12 minutes ago • 8:42 avg time</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <Eye className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">James Wu</p>
                        <p className="text-xs text-slate-500">Viewed 2 hours ago • 15:23 avg time</p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 text-xs">2nd visit</Badge>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <Eye className="h-5 w-5 text-slate-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Anonymous Viewer</p>
                        <p className="text-xs text-slate-500">Viewed yesterday • 3:15 avg time</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Geographic Distribution */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <Globe className="h-6 w-6 text-blue-600" />
                  <span className="font-medium text-slate-900">Viewer Locations</span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700">New York, NY</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-blue-600 rounded-full"></div>
                      <span className="text-sm font-medium text-slate-900">34%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700">Los Angeles, CA</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-emerald-600 rounded-full"></div>
                      <span className="text-sm font-medium text-slate-900">22%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700">Chicago, IL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-2 bg-slate-600 rounded-full"></div>
                      <span className="text-sm font-medium text-slate-900">18%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700">Miami, FL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-2 bg-amber-500 rounded-full"></div>
                      <span className="text-sm font-medium text-slate-900">12%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700">Other</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-2 bg-slate-400 rounded-full"></div>
                      <span className="text-sm font-medium text-slate-900">14%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 order-1 lg:order-2">
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
                <MapPin className="h-4 w-4 mr-2" />
                Geographic Insights
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                See Where Interest Is Coming From
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Understand your buyer geography at a glance. See which cities and regions are
                showing the most interest in your deal, helping you target follow-ups effectively.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">City-level location tracking</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Regional interest heatmaps</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Identify unexpected markets</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Privacy-compliant location data</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Features */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Comprehensive Analytics Features</h2>
            <p className="text-xl text-slate-600">
              Everything you need to understand and optimize buyer engagement
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Time-Based Trends</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  See how interest changes over time. Identify peak engagement days and
                  optimal times to share your CIM for maximum visibility.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Daily trends</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Weekly patterns</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                    <MousePointer className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Engagement Scoring</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Automatically score and rank viewers based on engagement metrics.
                  Focus your follow-up efforts on the most interested buyers.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Interest scoring</Badge>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Hot leads</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Export Reports</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Download comprehensive analytics reports to share with your team
                  or clients. Get all the data you need in presentation-ready format.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">PDF export</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">CSV data</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Multi-CIM Dashboard</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Compare engagement across all your CIMs in one unified dashboard.
                  Identify your best-performing deals and optimize underperformers.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Comparison view</Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Portfolio insights</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Analytics Matter */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Why Analytics Matter for M&A</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Data-driven insights that help you close deals faster
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center">
              <CardContent className="pt-8">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">Prioritize Follow-ups</h3>
                <p className="text-slate-600">
                  Focus your time on the buyers showing the most interest based on their engagement metrics.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center">
              <CardContent className="pt-8">
                <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">Optimize Your CIM</h3>
                <p className="text-slate-600">
                  Understand which sections resonate and which need improvement based on actual buyer behavior.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center">
              <CardContent className="pt-8">
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">Perfect Timing</h3>
                <p className="text-slate-600">
                  Know the best times to reach out based on when buyers are actively engaging with your deal.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-slate-900 border-0 text-white text-center">
          <CardContent className="p-12">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Understand Your Buyers Better?
            </h2>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Start tracking engagement and identify your most interested buyers with powerful analytics.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Try Analytics Free
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-400 text-slate-300 hover:bg-slate-800">
                  View Pricing
                </Button>
              </Link>
            </div>

            <p className="text-slate-400 text-sm mt-6">
              Real-time tracking • Geographic insights • Section engagement • Export reports
            </p>
          </CardContent>
        </Card>
      </section>

      {/* CSS Animations */}
      <style jsx>{`
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

        @keyframes text-gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out;
        }

        .animate-text-gradient {
          background: linear-gradient(-45deg, #1e293b, #059669, #10b981, #0f172a);
          background-size: 400% 400%;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: text-gradient 8s ease infinite;
        }
      `}</style>
    </div>
  );
}
