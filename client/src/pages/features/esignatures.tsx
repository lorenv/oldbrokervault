import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Signature,
  FileText,
  Zap,
  CheckCircle,
  ArrowRight,
  Clock,
  Shield,
  Smartphone,
  GripVertical,
  Users,
  RefreshCw,
  ClipboardList,
  Award,
  Brain,
  AlertCircle,
  ListOrdered,
  Layers,
  XCircle,
  Bell,
  MousePointer,
  History,
  FileCheck,
  Sparkles,
  Palette,
  Mail,
  Image,
  Copy,
  FolderOpen
} from "lucide-react";
import { useState, useEffect } from "react";
import { SEOHead } from "@/components/seo-head";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

export default function ESignaturesPage() {
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set());
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

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
        title="eSignatures - Secure Digital Document Signing for M&A"
        description="Streamline your M&A document signing with secure eSignatures. Features include parallel/sequential signing, audit logs, AI summarization, mobile signing, and certificate of completion."
        canonicalUrl="https://cimshare.com/features/esignatures"
      />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-6 bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 transition-colors duration-300">
              <Signature className="h-4 w-4 mr-2" />
              Secure eSignatures
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-slate-900 leading-tight animate-text-gradient">
              eSignatures Built for M&A Professionals
            </h1>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Streamline your deal documentation with secure, legally-binding electronic signatures. From NDAs to LOIs, close deals faster with intelligent signing workflows.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                  <Signature className="mr-2 h-5 w-5" />
                  Start Signing Documents
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

      {/* Screenshot Showcase */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">See It In Action</h2>
            <p className="text-lg text-slate-600">A powerful, intuitive eSignature experience</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div
              className="rounded-2xl overflow-hidden shadow-xl border border-slate-200 hover:shadow-2xl transition-shadow duration-300 cursor-pointer"
              onClick={() => setEnlargedImage("/esign1.png")}
            >
              <img
                src="/esign1.png"
                alt="eSignature Dashboard - Manage all your signing envelopes"
                className="w-full h-auto hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div
              className="rounded-2xl overflow-hidden shadow-xl border border-slate-200 hover:shadow-2xl transition-shadow duration-300 cursor-pointer"
              onClick={() => setEnlargedImage("/esign2.png")}
            >
              <img
                src="/esign2.png"
                alt="Document Editor - Drag and drop signature fields"
                className="w-full h-auto hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div
              className="rounded-2xl overflow-hidden shadow-xl border border-slate-200 hover:shadow-2xl transition-shadow duration-300 cursor-pointer"
              onClick={() => setEnlargedImage("/esign3.png")}
            >
              <img
                src="/esign3.png"
                alt="Signing Experience - Mobile-friendly document signing"
                className="w-full h-auto hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 mt-4">Click any image to enlarge</p>
        </div>
      </section>

      {/* Image Lightbox Dialog */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          <img
            src={enlargedImage || ""}
            alt="Enlarged screenshot"
            className="w-full h-auto rounded-lg shadow-2xl"
          />
        </DialogContent>
      </Dialog>

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
                  <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-indigo-600 transition-colors duration-300">Legally Binding</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Compliant with ESIGN Act and UETA for enforceable electronic signatures</p>
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
                    <Clock className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-indigo-600 transition-colors duration-300">Close Deals Faster</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Reduce signing time from days to minutes with streamlined workflows</p>
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
                  <div className="w-16 h-16 bg-indigo-700 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-slate-900 group-hover:text-indigo-600 transition-colors duration-300">AI-Powered</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Smart document summarization helps signers understand key terms quickly</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* AI Summarization Feature */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-purple-100 text-purple-700 border border-purple-200">
                <Sparkles className="h-4 w-4 mr-2" />
                AI-Powered
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                AI Document Summarization
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Help your signers understand what they're signing. Our AI automatically generates clear,
                concise summaries of complex legal documents, highlighting key terms, obligations, and important clauses.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center mt-1">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Smart Summaries</h4>
                    <p className="text-slate-600 text-sm">AI extracts and explains key terms, dates, and obligations in plain language</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mt-1">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Key Clause Highlighting</h4>
                    <p className="text-slate-600 text-sm">Important sections are automatically identified and summarized for quick review</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Faster Comprehension</h4>
                    <p className="text-slate-600 text-sm">Signers can understand complex documents in minutes, not hours</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 shadow-lg border border-purple-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                    <span className="font-medium">AI Document Summary</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                      <span className="font-medium text-purple-700">Key Terms:</span>
                      <p className="text-slate-600 mt-1">12-month non-compete, $50K penalty clause, mutual NDA</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                      <span className="font-medium text-indigo-700">Important Dates:</span>
                      <p className="text-slate-600 mt-1">Effective immediately upon signing, expires Dec 31, 2025</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <span className="font-medium text-slate-700">Your Obligations:</span>
                      <p className="text-slate-600 mt-1">Maintain confidentiality, return all materials upon request</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Signing Workflows */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <Users className="h-4 w-4 mr-2" />
              Flexible Workflows
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Parallel or Sequential Signing</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Choose the signing order that works best for your deal
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="border border-indigo-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Layers className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">Parallel Signing</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Send documents to all parties at once. Everyone can sign simultaneously,
                  dramatically reducing turnaround time for multi-party agreements.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">Fastest turnaround</Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Multi-party deals</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">All at once</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                    <ListOrdered className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">Sequential Signing</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Define a specific signing order. Each party receives the document only after
                  the previous party has signed, ensuring proper approval chains.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">Approval chains</Badge>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">Controlled flow</Badge>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700">In order</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Reusable Templates */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-amber-100 text-amber-700 border border-amber-200">
                <Copy className="h-4 w-4 mr-2" />
                Save Time
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Reusable Document Templates
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Create templates once, use them forever. Set up your NDAs, LOIs, and other frequently used
                documents with pre-placed signature fields, then send them out in seconds.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center mt-1">
                    <FolderOpen className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Template Library</h4>
                    <p className="text-slate-600 text-sm">Organize all your document templates in one central location</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mt-1">
                    <GripVertical className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Pre-Placed Fields</h4>
                    <p className="text-slate-600 text-sm">Signature, date, and form fields are saved with your template</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">One-Click Sending</h4>
                    <p className="text-slate-600 text-sm">Select a template, add recipients, and send - no document prep needed</p>
                  </div>
                </div>

              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 shadow-lg border border-amber-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <FolderOpen className="h-6 w-6 text-amber-600" />
                    <span className="font-medium">Template Library</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <FileText className="h-5 w-5 text-amber-600" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-700">Standard NDA</span>
                        <p className="text-xs text-slate-500">2 signature fields</p>
                      </div>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Ready</Badge>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <FileText className="h-5 w-5 text-indigo-600" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-700">Letter of Intent</span>
                        <p className="text-xs text-slate-500">4 signature fields</p>
                      </div>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Ready</Badge>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <FileText className="h-5 w-5 text-slate-600" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-700">Purchase Agreement</span>
                        <p className="text-xs text-slate-500">8 signature fields</p>
                      </div>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Ready</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Drag and Drop Field Placement */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="bg-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <MousePointer className="h-6 w-6 text-indigo-600" />
                    <span className="font-medium">Document Editor</span>
                  </div>
                  <div className="space-y-4">
                    <div className="h-8 bg-slate-100 rounded flex items-center px-3">
                      <span className="text-sm text-slate-500">Agreement Header</span>
                    </div>
                    <div className="h-16 bg-slate-50 rounded border-2 border-dashed border-indigo-300 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <GripVertical className="h-4 w-4" />
                        <span className="text-sm font-medium">Signature Field</span>
                      </div>
                    </div>
                    <div className="h-8 bg-slate-50 rounded border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <span className="text-xs text-slate-500">Date Field</span>
                    </div>
                    <div className="h-8 bg-slate-50 rounded border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <span className="text-xs text-slate-500">Initials</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 order-1 lg:order-2">
              <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200">
                <GripVertical className="h-4 w-4 mr-2" />
                Easy Setup
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Drag and Drop Field Placement
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Easily place signature fields, initials, dates, and custom fields anywhere on your documents.
                Our intuitive drag-and-drop interface makes document preparation effortless.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mt-1">
                    <Signature className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Signature Fields</h4>
                    <p className="text-slate-600 text-sm">Drop signature boxes anywhere signers need to sign</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Multiple Field Types</h4>
                    <p className="text-slate-600 text-sm">Initials, dates, text fields, checkboxes, and more</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-700 rounded-lg flex items-center justify-center mt-1">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Assign to Signers</h4>
                    <p className="text-slate-600 text-sm">Color-coded fields for each signer make it clear who signs where</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Signing & Cached Signatures */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-indigo-100 text-indigo-700 border border-indigo-200">
              <Smartphone className="h-4 w-4 mr-2" />
              Sign Anywhere
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Mobile-First Signing Experience</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Sign documents from any device, anywhere in the world
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Smartphone className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">Mobile Signing</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  Our responsive signing experience works beautifully on phones and tablets.
                  Signers can review and sign documents on-the-go without any app downloads.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700 text-sm">No app required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700 text-sm">Touch-friendly signature capture</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700 text-sm">Optimized for all screen sizes</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">Cached Signatures</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">
                  For documents requiring multiple signatures, signers can save their signature
                  and apply it to all required fields with a single click. No need to re-draw each time.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700 text-sm">One-time signature capture</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700 text-sm">Apply to all signature fields</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-slate-700 text-sm">Perfect for multi-page documents</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Document Control */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-100 text-slate-700 border border-slate-200">
              <RefreshCw className="h-4 w-4 mr-2" />
              Full Control
            </Badge>
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Correct, Void, or Remind</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Complete control over your signing envelopes at every stage
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <FileCheck className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-lg">Correct Documents</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">
                  Made an error? Correct document details or update signer information without
                  starting over. Maintain envelope history while fixing mistakes.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center">
                <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <XCircle className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-lg">Void Envelopes</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">
                  Cancel a signing request at any point. Void envelopes are permanently marked
                  and cannot be signed, with all parties notified automatically.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center">
                <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Bell className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-lg">Send Reminders</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-slate-600">
                  Gently nudge signers who haven't completed their signatures. Send manual reminders
                  or set up automatic reminder schedules.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Custom Branding */}
      <section className="container mx-auto px-4 py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-pink-100 text-pink-700 border border-pink-200">
                <Palette className="h-4 w-4 mr-2" />
                Your Brand, Everywhere
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Custom Branding & Colors
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Make every signing experience feel like your own. Upload your logo and our system
                automatically extracts your brand colors, applying them across all email notifications
                and the signing interface.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center mt-1">
                    <Image className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Auto Color Extraction</h4>
                    <p className="text-slate-600 text-sm">Upload your logo and we automatically extract your primary and secondary brand colors</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mt-1">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Branded Emails</h4>
                    <p className="text-slate-600 text-sm">Signature request emails feature your logo and colors for a professional look</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Signature className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Branded Signing Interface</h4>
                    <p className="text-slate-600 text-sm">Signers see your brand throughout the entire signing experience</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 shadow-lg border border-pink-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <Palette className="h-6 w-6 text-pink-600" />
                    <span className="font-medium">Brand Settings</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                        <Image className="h-6 w-6 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-700">Your Logo</span>
                        <p className="text-xs text-slate-500">Automatically analyzed</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <span className="text-sm font-medium text-slate-700 block mb-3">Extracted Colors</span>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 shadow-sm"></div>
                          <span className="text-xs text-slate-500">Primary</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-700 shadow-sm"></div>
                          <span className="text-xs text-slate-500">Secondary</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 shadow-sm border border-indigo-200"></div>
                          <span className="text-xs text-slate-500">Accent</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <span className="text-sm font-medium text-slate-700 block mb-2">Preview</span>
                      <div className="bg-indigo-600 text-white text-xs py-2 px-4 rounded text-center">
                        Sign Document
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audit Log & Certificate */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-green-100 text-green-700 border border-green-200">
                <Shield className="h-4 w-4 mr-2" />
                Complete Compliance
              </Badge>

              <h2 className="text-4xl font-bold mb-6 text-slate-900">
                Audit Log & Certificate of Completion
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                Every action is tracked with timestamps and IP addresses. When all parties have signed,
                a tamper-evident certificate of completion is automatically generated and attached.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mt-1">
                    <History className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Complete Audit Trail</h4>
                    <p className="text-slate-600 text-sm">Every view, click, and signature is recorded with timestamps and IP addresses</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mt-1">
                    <Award className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Certificate of Completion</h4>
                    <p className="text-slate-600 text-sm">Automatically generated certificate proves document authenticity and signing details</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mt-1">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Tamper-Evident</h4>
                    <p className="text-slate-600 text-sm">Cryptographic hashes ensure document integrity can be verified at any time</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 shadow-lg border border-green-200">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <ClipboardList className="h-6 w-6 text-green-600" />
                    <span className="font-medium">Audit Log</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-slate-600">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Document sent - Jan 15, 2025 9:00 AM</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>John viewed - Jan 15, 2025 9:15 AM</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>John signed - Jan 15, 2025 9:22 AM</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Sarah viewed - Jan 15, 2025 10:05 AM</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Sarah signed - Jan 15, 2025 10:12 AM</span>
                    </div>
                    <div className="flex items-center gap-3 text-green-700 font-medium">
                      <Award className="h-4 w-4 text-green-600" />
                      <span>Completed - Certificate generated</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature List */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Everything You Need for eSignatures</h2>
            <p className="text-xl text-slate-600">
              Comprehensive signing features built for M&A professionals
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">AI Summarization</h3>
                <p className="text-sm text-slate-600">Smart document summaries help signers understand key terms</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Parallel Signing</h3>
                <p className="text-sm text-slate-600">All parties can sign simultaneously for faster completion</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-indigo-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <ListOrdered className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Sequential Signing</h3>
                <p className="text-sm text-slate-600">Define approval chains with specific signing order</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Audit Log</h3>
                <p className="text-sm text-slate-600">Complete tracking of every action with timestamps</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Certificate of Completion</h3>
                <p className="text-sm text-slate-600">Tamper-evident proof of all signatures and completion</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Correct & Void</h3>
                <p className="text-sm text-slate-600">Fix errors or cancel envelopes at any stage</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Reminders</h3>
                <p className="text-sm text-slate-600">Automatic or manual reminders for pending signatures</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <GripVertical className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Drag & Drop Fields</h3>
                <p className="text-sm text-slate-600">Easy placement of signature and form fields</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Mobile Signing</h3>
                <p className="text-sm text-slate-600">Sign from any device, anywhere in the world</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <RefreshCw className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Cached Signatures</h3>
                <p className="text-sm text-slate-600">Apply saved signature to multiple fields instantly</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Legally Binding</h3>
                <p className="text-sm text-slate-600">Compliant with ESIGN Act and UETA regulations</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Fast Turnaround</h3>
                <p className="text-sm text-slate-600">Get signatures in minutes, not days</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Palette className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Custom Branding</h3>
                <p className="text-sm text-slate-600">Auto-extracted colors from your logo across emails and signing</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Copy className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Reusable Templates</h3>
                <p className="text-sm text-slate-600">Create once, use forever with pre-placed signature fields</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-900 to-slate-900 border-0 text-white text-center">
          <CardContent className="p-12">
            <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Signature className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Streamline Your Document Signing?
            </h2>

            <p className="text-xl text-indigo-200 mb-8 max-w-2xl mx-auto">
              Join M&A professionals who close deals faster with secure, intelligent eSignatures.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="bg-white text-indigo-900 hover:bg-slate-100">
                  <Signature className="mr-2 h-5 w-5" />
                  Start Signing for Free
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-indigo-400 text-indigo-200 hover:bg-indigo-800">
                  View Pricing Plans
                </Button>
              </Link>
            </div>

            <p className="text-indigo-300 text-sm mt-6">
              No credit card required • Start with our free trial
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
          background: linear-gradient(-45deg, #1e293b, #6366f1, #4f46e5, #0f172a);
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
