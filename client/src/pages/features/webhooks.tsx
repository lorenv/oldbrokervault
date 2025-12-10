import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Webhook,
  Zap,
  CheckCircle,
  ArrowRight,
  Clock,
  Shield,
  RefreshCw,
  Code,
  Bell,
  Settings,
  FileText,
  Users,
  Eye,
  MessageSquare,
  FolderOpen,
  Signature,
  Send,
  Activity,
  Lock,
  History,
  AlertTriangle,
  Globe,
  Server,
  Plug
} from "lucide-react";
import { useState, useEffect } from "react";
import { SEOHead } from "@/components/seo-head";

export default function WebhooksFeaturePage() {
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-animate-id');
          if (entry.isIntersecting && id) {
            setVisibleElements(prev => {
              const newSet = new Set(prev);
              newSet.add(id);
              return newSet;
            });
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
        title="Webhooks - Real-Time Integrations for M&A Workflows"
        description="Connect CIM Share to your existing tools with real-time webhooks. Integrate with Zapier, HubSpot, Salesforce, or custom systems. Get instant notifications for CIM views, NDA signatures, and more."
        canonicalUrl="https://cimshare.com/features/webhooks"
      />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors duration-300">
              <Webhook className="h-4 w-4 mr-2" />
              Real-Time Integrations
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-slate-900 leading-tight animate-text-gradient">
              Connect Your M&A Workflow to Everything
            </h1>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Send real-time events to Zapier, HubSpot, Salesforce, or your own systems.
              Get notified instantly when buyers view CIMs, sign NDAs, or take action on your deals.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <Webhook className="mr-2 h-5 w-5" />
                  Set Up Webhooks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="https://cimshare.documentationai.com/webhooks" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-slate-300 hover:bg-slate-50 hover:scale-105 transition-all duration-300">
                  <Code className="mr-2 h-4 w-4" />
                  View API Docs
                </Button>
              </a>
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
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Real-Time Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Get instant notifications the moment something happens - no polling required</p>
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
                  <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Plug className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Universal Integration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Works with Zapier, Make, n8n, or any system that accepts webhooks</p>
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
                  <div className="w-16 h-16 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Secure & Signed</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">HMAC-signed payloads ensure data integrity and authenticity</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Event Types Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Bell className="h-4 w-4 mr-2" />
              17+ Event Types
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Track Every Important Action</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Subscribe to the events that matter to your workflow
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CIM Events */}
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-lg">CIM Events</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>CIM Created</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>CIM Updated</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>CIM Published</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>CIM Viewed</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>CIM Downloaded</span>
                </div>
              </CardContent>
            </Card>

            {/* NDA Events */}
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Signature className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-lg">NDA Events</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>NDA Sent</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>NDA Signed</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>NDA Declined</span>
                </div>
              </CardContent>
            </Card>

            {/* Contact Events */}
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-lg">Contact Events</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Contact Created</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Contact Updated</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Contact Deleted</span>
                </div>
              </CardContent>
            </Card>

            {/* Data Room & Message Events */}
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                    <FolderOpen className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-lg">More Events</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>File Uploaded</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>File Viewed</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Access Granted</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Message Received</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Message Sent</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Integration Examples */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-700 border border-blue-200">
              <Globe className="h-4 w-4 mr-2" />
              Popular Integrations
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Connect to Your Favorite Tools</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Automate your M&A workflows with powerful integrations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <img src="/zapier-icon.svg" alt="Zapier" className="w-12 h-12 object-contain" />
                  <div>
                    <h3 className="font-semibold text-lg">Zapier</h3>
                    <p className="text-sm text-slate-500">5,000+ app connections</p>
                  </div>
                </div>
                <p className="text-slate-600 text-sm">
                  Trigger Zaps when NDAs are signed, CIMs are viewed, or contacts are created.
                  Connect to Slack, Gmail, Trello, and thousands more.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <img src="/hubspot.png" alt="HubSpot" className="w-12 h-12 object-contain" />
                  <div>
                    <h3 className="font-semibold text-lg">HubSpot</h3>
                    <p className="text-sm text-slate-500">CRM & Marketing</p>
                  </div>
                </div>
                <p className="text-slate-600 text-sm">
                  Sync buyer activity to HubSpot. Create deals when NDAs are signed,
                  update contact engagement scores, and trigger email sequences.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <img src="/salesforce.png" alt="Salesforce" className="w-12 h-12 object-contain" />
                  <div>
                    <h3 className="font-semibold text-lg">Salesforce</h3>
                    <p className="text-sm text-slate-500">Enterprise CRM</p>
                  </div>
                </div>
                <p className="text-slate-600 text-sm">
                  Push deal activity to Salesforce. Create opportunities, log activities,
                  and keep your CRM in sync with every buyer interaction.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <img src="/slack.png" alt="Slack" className="w-12 h-12 object-contain" />
                  <div>
                    <h3 className="font-semibold text-lg">Slack</h3>
                    <p className="text-sm text-slate-500">Team Communication</p>
                  </div>
                </div>
                <p className="text-slate-600 text-sm">
                  Get instant Slack notifications when buyers view your CIMs,
                  sign NDAs, or send messages. Never miss an opportunity.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <img src="/makeicon.png" alt="Make" className="w-12 h-12 object-contain" />
                  <div>
                    <h3 className="font-semibold text-lg">Make (Integromat)</h3>
                    <p className="text-sm text-slate-500">Visual Automation</p>
                  </div>
                </div>
                <p className="text-slate-600 text-sm">
                  Create complex automation scenarios with visual workflows.
                  Connect to Google Sheets, Airtable, Monday.com, and more.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                    <Code className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Custom Systems</h3>
                    <p className="text-sm text-slate-500">Your Own APIs</p>
                  </div>
                </div>
                <p className="text-slate-600 text-sm">
                  Build custom integrations with your proprietary systems.
                  Full API documentation and signature verification included.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Security & Reliability */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-green-100 text-green-700 border border-green-200">
                <Lock className="h-4 w-4 mr-2" />
                Enterprise-Grade Security
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Secure & Reliable Delivery
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Your webhook payloads are cryptographically signed so you can verify they came from CIM Share.
                Automatic retries ensure delivery even when your endpoint is temporarily unavailable.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mt-1">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">HMAC Signature Verification</h4>
                    <p className="text-slate-600 text-sm">Every payload includes a cryptographic signature you can verify</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mt-1">
                    <RefreshCw className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Automatic Retries</h4>
                    <p className="text-slate-600 text-sm">Failed deliveries are automatically retried with exponential backoff</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <History className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Delivery History</h4>
                    <p className="text-slate-600 text-sm">Full visibility into delivery attempts, response codes, and timing</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center mt-1">
                    <AlertTriangle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Health Monitoring</h4>
                    <p className="text-slate-600 text-sm">Automatic disabling after consecutive failures with alerts</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 shadow-lg border border-green-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <Code className="h-6 w-6 text-green-600" />
                    <span className="font-medium">Webhook Payload</span>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4 text-sm font-mono text-green-400 overflow-x-auto">
                    <pre>{`{
  "event": "nda.signed",
  "timestamp": "2025-01-15T14:30:00Z",
  "data": {
    "cimId": 123,
    "signerId": 456,
    "signerEmail": "buyer@example.com",
    "signerName": "John Smith",
    "documentTitle": "Project Alpha NDA"
  }
}`}</pre>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Lock className="h-4 w-4 text-green-600" />
                      <span>Signed with: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">X-CIMShare-Signature</code></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Management Features */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Settings className="h-4 w-4 mr-2" />
              Easy Management
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Full Control Over Your Webhooks</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Create, test, and manage webhooks with an intuitive interface
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Send className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Test Events</h3>
                <p className="text-sm text-slate-600">Send test payloads to verify your endpoint is working correctly</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Delivery Logs</h3>
                <p className="text-sm text-slate-600">View detailed logs of every delivery attempt and response</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <RefreshCw className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Manual Retry</h3>
                <p className="text-sm text-slate-600">Retry failed deliveries with a single click</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Secret Rotation</h3>
                <p className="text-sm text-slate-600">Regenerate signing secrets anytime for enhanced security</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Event Filtering</h3>
                <p className="text-sm text-slate-600">Subscribe only to the events you need</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Health Status</h3>
                <p className="text-sm text-slate-600">At-a-glance view of webhook health and recent activity</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-blue-900 to-slate-900 border-0 text-white text-center">
          <CardContent className="p-12">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Webhook className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Automate Your M&A Workflow?
            </h2>

            <p className="text-xl text-blue-200 mb-8 max-w-2xl mx-auto">
              Connect CIM Share to your existing tools and get real-time notifications for every deal activity.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="bg-white text-blue-900 hover:bg-slate-100">
                  <Webhook className="mr-2 h-5 w-5" />
                  Set Up Webhooks
                </Button>
              </Link>
              <a href="https://cimshare.documentationai.com/webhooks" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-blue-400 text-blue-200 hover:bg-blue-800">
                  View API Documentation
                </Button>
              </a>
            </div>

            <p className="text-blue-300 text-sm mt-6">
              Full documentation available • Test endpoints included
            </p>
          </CardContent>
        </Card>
      </section>

      {/* CSS Animations */}
      <style>{`
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
          background: linear-gradient(-45deg, #1e293b, #3b82f6, #2563eb, #0f172a);
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
