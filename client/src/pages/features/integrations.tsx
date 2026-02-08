import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Workflow,
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

export default function IntegrationsFeaturePage() {
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
        title="Integrations - Connect Your M&A Workflow to 5,000+ Apps"
        description="Automate your M&A workflows with powerful integrations. Connect CIM Share to Zapier, HubSpot, Salesforce, Slack, and thousands more. Get instant notifications for CIM views, NDA signatures, and more."
        canonicalUrl="https://brokervault.ai/features/integrations"
      />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors duration-300">
              <Workflow className="h-4 w-4 mr-2" />
              Automations & Integrations
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-bold mb-6 pb-1 text-slate-900 leading-tight animate-text-gradient">
              Connect Your M&A Workflow to Everything
            </h1>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Automate your deal flow with powerful integrations. Connect to Zapier, HubSpot, Salesforce, Slack, and thousands more apps to streamline your M&A process.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <Workflow className="mr-2 h-5 w-5" />
                  Set Up Integrations
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="https://cimshare.documentationai.com/integrations" target="_blank" rel="noopener noreferrer">
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
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Real-Time Automation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Trigger workflows instantly when events happen - no manual work required</p>
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
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">5,000+ App Connections</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Connect to Zapier, Make, n8n, or build custom integrations</p>
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
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300">Secure & Reliable</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Enterprise-grade security with signed payloads and automatic retries</p>
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
              17+ Trigger Events
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Automate Every Important Action</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Create workflows triggered by the events that matter to your business
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
                  <img src="/zapier-icon.svg" alt="Zapier" loading="lazy" className="w-12 h-12 object-contain" />
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
                  <img src="/hubspot.png" alt="HubSpot" loading="lazy" className="w-12 h-12 object-contain" />
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
                  <img src="/salesforce.png" alt="Salesforce" loading="lazy" className="w-12 h-12 object-contain" />
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
                  <img src="/slack.png" alt="Slack" loading="lazy" className="w-12 h-12 object-contain" />
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
                  <img src="/makeicon.png" alt="Make" loading="lazy" className="w-12 h-12 object-contain" />
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

      {/* Use Cases Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-100 text-green-700 border border-green-200">
              <Workflow className="h-4 w-4 mr-2" />
              Workflow Examples
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Popular Automation Workflows</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              See how M&A professionals use integrations to save time
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border border-slate-200 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Signature className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">NDA to CRM Pipeline</h3>
                    <p className="text-slate-600 text-sm mb-3">
                      When an NDA is signed, automatically create a deal in HubSpot or Salesforce with buyer details pre-populated.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="bg-slate-100 px-2 py-1 rounded">NDA Signed</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="bg-slate-100 px-2 py-1 rounded">Create Deal</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Eye className="h-6 w-6 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Engagement Alerts</h3>
                    <p className="text-slate-600 text-sm mb-3">
                      Get Slack notifications when a buyer views your CIM for the first time or downloads the PDF.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="bg-slate-100 px-2 py-1 rounded">CIM Viewed</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="bg-slate-100 px-2 py-1 rounded">Slack Alert</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Contact Sync</h3>
                    <p className="text-slate-600 text-sm mb-3">
                      Sync new contacts from CIM Share to your CRM, email marketing tool, or spreadsheet automatically.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="bg-slate-100 px-2 py-1 rounded">Contact Created</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="bg-slate-100 px-2 py-1 rounded">Add to CRM</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Message Response</h3>
                    <p className="text-slate-600 text-sm mb-3">
                      When a buyer sends a message, create a task in your project management tool or send an email alert.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="bg-slate-100 px-2 py-1 rounded">Message Received</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="bg-slate-100 px-2 py-1 rounded">Create Task</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Security & Reliability */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
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
                Your integration payloads are cryptographically signed so you can verify they came from CIM Share.
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
                    <span className="font-medium">Integration Payload</span>
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
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Settings className="h-4 w-4 mr-2" />
              Easy Management
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Full Control Over Your Integrations</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Create, test, and manage integrations with an intuitive interface
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
                <p className="text-sm text-slate-600">At-a-glance view of integration health and recent activity</p>
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
              <Workflow className="h-8 w-8 text-white" />
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
                  <Workflow className="mr-2 h-5 w-5" />
                  Set Up Integrations
                </Button>
              </Link>
              <a href="https://cimshare.documentationai.com/integrations" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300">
                  View API Documentation
                </Button>
              </a>
            </div>

            <p className="text-blue-300 text-sm mt-6">
              Full documentation available • Test endpoints included • No-code setup with Zapier
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
