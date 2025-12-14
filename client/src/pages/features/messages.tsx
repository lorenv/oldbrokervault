import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  MessageSquare,
  Mail,
  Search,
  Archive,
  Filter,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Bell,
  Inbox,
  Send,
  Reply,
  Users,
  FileText,
  Clock,
  Paperclip,
  Sparkles,
  Globe,
  Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import { SEOHead } from "@/components/seo-head";

export default function MessagesFeaturePage() {
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
        title="Message Center - Centralized Communication for Deal Flow | CIM Share"
        description="Manage all buyer inquiries in one place with CIM Share's integrated message center. Bidirectional email sync, smart filtering, search, and archive features keep your deal communications organized."
        canonicalUrl="https://cimshare.com/features/messages"
      />
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors duration-300">
              <MessageSquare className="h-4 w-4 mr-2" />
              Centralized Communication
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-bold mb-6 pb-1 text-slate-900 leading-tight animate-text-gradient">
              One Inbox for All Your Deals
            </h1>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Never miss an inquiry again. CIM Share's Message Center consolidates all buyer communications
              with bidirectional email sync, smart filtering, and powerful search.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Try Message Center
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
              src="/Messages.png"
              alt="CIM Share Message Center - Unified inbox for all buyer communications"
              className="w-full"
            />
          </div>
          <p className="text-center text-sm text-slate-500 mt-4">
            All your buyer communications in one organized inbox
          </p>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Sparkles className="h-4 w-4 mr-2" />
              Why Use Message Center
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">
              Stop Juggling Emails Across Deals
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              All buyer communications in one organized dashboard, automatically linked to the right CIM
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Inbox className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Unified Inbox</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">All inquiries from contact forms, emails, and direct messages in one place. Filter by deal, status, or date.</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Bidirectional Email Sync</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">Reply from CIM Share or your email client - both stay in sync. Recipients never know the difference.</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl text-slate-900">Deal Context</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">Every message is automatically linked to its CIM document. See the full conversation history with one click.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Bidirectional Sync Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                <RefreshCw className="h-4 w-4 mr-2" />
                Email Sync
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Bidirectional Email Sync
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Reply to buyer inquiries directly from CIM Share, and your response goes to their email.
                When they reply back, it appears in your Message Center. You can also reply from your own
                email client and it syncs back to CIM Share.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mt-1">
                    <Send className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Reply from Anywhere</h4>
                    <p className="text-slate-600 text-sm">Use CIM Share or your favorite email client - both stay perfectly synced</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Bell className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Instant Notifications</h4>
                    <p className="text-slate-600 text-sm">Get notified immediately when new inquiries arrive via email alerts</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center mt-1">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">CC Support</h4>
                    <p className="text-slate-600 text-sm">CC team members on replies to keep everyone in the loop</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <RefreshCw className="h-6 w-6 text-blue-600" />
                    <span className="font-medium">Email Sync Status</span>
                    <Badge className="bg-green-100 text-green-700 ml-auto">Active</Badge>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Outbound emails syncing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Inbound replies captured</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Thread history preserved</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <MessageSquare className="h-4 w-4 mr-2" />
              Powerful Features
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">
              Everything You Need to Manage Communications
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Built-in tools to keep your inbox organized and your responses fast
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div
              data-animate-id="feature-1"
              className={`transition-all duration-700 ${
                isVisible('feature-1') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Search className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-xl">Powerful Search</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-600">
                    Search across all messages by sender name, email, subject, or message content.
                    Find any conversation in seconds, even across hundreds of threads.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">Full-text search</Badge>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">Instant results</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div
              data-animate-id="feature-2"
              className={`transition-all duration-700 delay-100 ${
                isVisible('feature-2') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                      <Filter className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-xl">Smart Filtering</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-600">
                    Filter messages by CIM document to focus on a specific deal. See only unread messages
                    or archived conversations. Quickly identify what needs your attention.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">By CIM</Badge>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">By status</Badge>
                    <Badge variant="secondary" className="bg-slate-200 text-slate-700">Unread only</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div
              data-animate-id="feature-3"
              className={`transition-all duration-700 delay-200 ${
                isVisible('feature-3') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center">
                      <Archive className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-xl">Archive & Organize</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-600">
                    Archive completed conversations to keep your inbox clean. Archived messages are
                    still searchable and can be reactivated anytime if the conversation resumes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">One-click archive</Badge>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">Restore anytime</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div
              data-animate-id="feature-4"
              className={`transition-all duration-700 delay-300 ${
                isVisible('feature-4') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                      <Paperclip className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-xl">Rich Attachments</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-600">
                    Send and receive attachments directly through Message Center. Documents, images,
                    and files are automatically captured and linked to the conversation thread.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">File uploads</Badge>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">Download history</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">How Message Center Works</h2>
            <p className="text-xl text-slate-600">
              From inquiry to deal close, every conversation is tracked
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">1</span>
                </div>
                <CardTitle className="text-lg">Buyer Inquires</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Potential buyer fills out contact form on your CIM</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Bell className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">You Get Notified</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Instant email notification with full message content</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Reply className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Reply Anywhere</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Respond from CIM Share or your email - it all syncs</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Full History</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">Complete thread history preserved for reference</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Form Integration */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Sarah Martinez</p>
                      <p className="text-xs text-slate-500">2 minutes ago</p>
                    </div>
                    <Badge className="ml-auto bg-blue-100 text-blue-700">New</Badge>
                  </div>
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">James Wu</p>
                      <p className="text-xs text-slate-500">1 hour ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Patricia Chen</p>
                      <p className="text-xs text-slate-500">Yesterday</p>
                    </div>
                    <Badge className="ml-auto bg-slate-100 text-slate-700">Replied</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 order-1 lg:order-2">
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                <Globe className="h-4 w-4 mr-2" />
                Integrated Contact Forms
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Every CIM Has a Built-in Contact Form
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                When you publish a CIM, a professional contact form is automatically included.
                Buyers can reach out with questions, and their messages flow directly into your
                Message Center - no setup required.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Automatic form on every CIM</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">No coding or configuration needed</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Messages linked to specific CIM</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-slate-700">Buyer info captured automatically</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="container mx-auto px-4 py-16 bg-gradient-to-br from-slate-50 to-cyan-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-cyan-100 text-cyan-700 border border-cyan-200">
              <Zap className="h-4 w-4 mr-2" />
              Automations & Integrations
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Automate Your Message Workflows</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Connect message events to your favorite tools. Automatically log conversations to your CRM, notify your team of new inquiries, or trigger custom workflows.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardContent className="p-6 text-center">
                <img src="/hubspot.png" alt="HubSpot" loading="lazy" className="h-12 mx-auto mb-4 object-contain" />
                <h3 className="font-semibold text-slate-900 mb-2">HubSpot</h3>
                <p className="text-sm text-slate-600">
                  Automatically log buyer inquiries and create tasks when new messages arrive.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardContent className="p-6 text-center">
                <img src="/slack.png" alt="Slack" loading="lazy" className="h-12 mx-auto mb-4 object-contain" />
                <h3 className="font-semibold text-slate-900 mb-2">Slack</h3>
                <p className="text-sm text-slate-600">
                  Get instant notifications in your team channels when buyers send messages.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardContent className="p-6 text-center">
                <img src="/zapier-icon.svg" alt="Zapier" loading="lazy" className="h-12 mx-auto mb-4 object-contain" />
                <h3 className="font-semibold text-slate-900 mb-2">Zapier</h3>
                <p className="text-sm text-slate-600">
                  Connect to 5,000+ apps and automate any workflow when messages are received.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <Link href="/features/integrations">
              <Button variant="outline" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50">
                Explore All Integrations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-slate-900 border-0 text-white text-center">
          <CardContent className="p-12">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Streamline Your Deal Communications?
            </h2>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Stop missing inquiries. Start managing all your buyer communications in one organized inbox.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Try Message Center
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-400 text-white hover:bg-slate-800">
                  View Pricing
                </Button>
              </Link>
            </div>

            <p className="text-slate-400 text-sm mt-6">
              Bidirectional sync • Smart filtering • Full search • Archive
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
          background: linear-gradient(-45deg, #1e293b, #2563eb, #1d4ed8, #0f172a);
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
