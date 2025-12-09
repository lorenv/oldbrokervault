import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  WandSparkles,
  FileSpreadsheet,
  Zap,
  Brain,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  Target,
  Upload,
  BarChart3,
  AlertCircle,
  Calculator,
  DollarSign,
  FileText,
  PieChart,
  Sparkles,
  Shield
} from "lucide-react";
import { useState, useEffect } from "react";
import { SEOHead } from "@/components/seo-head";

export default function SdeAnalyzerPage() {
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
        title="AI-Powered SDE Analyzer - Calculate Seller's Discretionary Earnings"
        description="Calculate SDE in minutes with AI. Upload financial documents and let AI automatically identify revenue patterns, extract addbacks, and calculate Seller's Discretionary Earnings for accurate business valuations."
        canonicalUrl="https://cimshare.com/features/sde-analyzer"
      />
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors duration-300">
              <WandSparkles className="h-4 w-4 mr-2" />
              AI-Powered Financial Analysis
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-slate-900 leading-tight animate-text-gradient">
              Calculate SDE in Minutes, Not Hours
            </h1>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Upload financial documents and let AI automatically identify revenue patterns, extract addbacks, and calculate Seller's Discretionary Earnings with professional accuracy.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <Zap className="mr-2 h-5 w-5" />
                  Try SDE Analyzer Free
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

          {/* Product Screenshot */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
              <img
                src="/sde.png"
                alt="SDE Analyzer Interface - AI-powered Seller's Discretionary Earnings calculation"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits Grid */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div
              data-animate-id="benefit-1"
              className={`transition-all duration-700 ${
                isVisible('benefit-1') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="text-center border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group h-full">
                <CardHeader>
                  <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Clock className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Save Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Reduce SDE analysis from hours of manual work to minutes with AI automation</p>
                </CardContent>
              </Card>
            </div>

            <div
              data-animate-id="benefit-2"
              className={`transition-all duration-700 delay-100 ${
                isVisible('benefit-2') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="text-center border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group h-full">
                <CardHeader>
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">AI-Powered</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Advanced AI automatically identifies addbacks and normalizes financial statements</p>
                </CardContent>
              </Card>
            </div>

            <div
              data-animate-id="benefit-3"
              className={`transition-all duration-700 delay-200 ${
                isVisible('benefit-3') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="text-center border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group h-full">
                <CardHeader>
                  <div className="w-16 h-16 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Target className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Accurate Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Consistent, professional-grade SDE calculations you can trust for valuations</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* What is SDE Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                <Calculator className="h-4 w-4 mr-2" />
                Understanding SDE
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                What is Seller's Discretionary Earnings?
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Seller's Discretionary Earnings (SDE) is a key metric used to value small to mid-sized businesses.
                It represents the total financial benefit a single owner-operator would receive from owning and running the business.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mt-1">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Net Profit Base</h4>
                    <p className="text-slate-600 text-sm">Starts with reported net income from financial statements</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Owner Compensation</h4>
                    <p className="text-slate-600 text-sm">Adds back owner salary, benefits, and perks to show true earning potential</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center mt-1">
                    <PieChart className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Discretionary Expenses</h4>
                    <p className="text-slate-600 text-sm">Identifies personal expenses run through the business that a new owner wouldn't have</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <Calculator className="h-6 w-6 text-blue-600" />
                    <span className="font-medium">SDE Calculation Example</span>
                  </div>
                  <div className="space-y-3 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Net Profit</span>
                      <span className="text-slate-900">$150,000</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>+ Owner Salary</span>
                      <span>$120,000</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>+ Owner Benefits</span>
                      <span>$25,000</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>+ Depreciation</span>
                      <span>$15,000</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>+ One-Time Expenses</span>
                      <span>$10,000</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between font-bold text-lg">
                      <span className="text-slate-900">SDE Total</span>
                      <span className="text-blue-600">$320,000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Zap className="h-4 w-4 mr-2" />
              Simple Process
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">How the SDE Analyzer Works</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Three simple steps to get professional SDE calculations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">1. Upload Documents</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Upload P&L statements, tax returns, or financial spreadsheets in PDF or Excel format</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">2. AI Analysis</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Our AI scans documents to identify revenue, expenses, and potential addbacks automatically</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">3. Get Results</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Receive a detailed SDE breakdown with identified addbacks and annual revenue summary</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Capabilities Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">What Our AI Identifies</h2>
            <p className="text-xl text-slate-600">
              Comprehensive analysis of financial documents for accurate SDE calculations
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Revenue Recognition</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  AI extracts and summarizes annual revenue figures from financial documents,
                  identifying trends and patterns across multiple years.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Gross Revenue</Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Net Revenue</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">YoY Trends</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Owner Addbacks</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Automatically identifies owner-related expenses that should be added back to
                  calculate true discretionary earnings for a buyer.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Owner Salary</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Health Insurance</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Auto Expenses</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center">
                    <PieChart className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Discretionary Expenses</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Identifies personal or non-essential business expenses that a new owner
                  may not incur, increasing the effective earnings.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Travel & Entertainment</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Personal Expenses</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">Family Wages</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl">Non-Cash & One-Time Items</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Recognizes depreciation, amortization, and non-recurring expenses that
                  should be normalized for accurate valuation purposes.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Depreciation</Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Amortization</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">One-Time Costs</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Before/After Comparison */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Manual vs AI-Powered SDE Analysis</h2>
            <p className="text-xl text-slate-600">See how automation transforms your workflow</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Traditional Method */}
            <Card className="border-2 border-red-200 bg-red-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl text-red-700">Manual Analysis</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-red-600" />
                    <span className="text-slate-700">2-4 hours per financial statement</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-4 w-4 text-red-600" />
                    <span className="text-slate-700">Manual data entry into spreadsheets</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Target className="h-4 w-4 text-red-600" />
                    <span className="text-slate-700">Easy to miss addbacks</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calculator className="h-4 w-4 text-red-600" />
                    <span className="text-slate-700">Inconsistent methodologies</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI-Powered Method */}
            <Card className="border-2 border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                    <WandSparkles className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl text-green-700">AI-Powered Analysis</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700">Results in under 5 minutes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Upload className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700">Simple drag-and-drop upload</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Brain className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700">AI catches hidden addbacks</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700">Consistent, reliable methodology</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Perfect For</h2>
            <p className="text-xl text-slate-600">
              Professionals who need fast, accurate SDE calculations
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-slate-900">Business Brokers</h3>
                  <p className="text-slate-600">
                    Quickly analyze multiple businesses to provide accurate valuations
                    and prepare professional CIMs for your listings.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-slate-900">M&A Advisors</h3>
                  <p className="text-slate-600">
                    Streamline due diligence and financial analysis for your
                    merger and acquisition engagements.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-slate-900">Business Owners</h3>
                  <p className="text-slate-600">
                    Understand your business's true earning potential before
                    entering sale negotiations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-slate-900 border-0 text-white text-center">
          <CardContent className="p-12">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <WandSparkles className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Automate Your SDE Analysis?
            </h2>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Join business brokers and M&A advisors who save hours every week with AI-powered financial analysis.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100">
                  <Zap className="mr-2 h-5 w-5" />
                  Start Analyzing Free
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-400 text-slate-300 hover:bg-slate-800">
                  View Pricing Plans
                </Button>
              </Link>
            </div>

            <p className="text-slate-400 text-sm mt-6">
              No credit card required • Start with our free trial
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
          background: linear-gradient(-45deg, #1e293b, #3b82f6, #1e40af, #0f172a);
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
