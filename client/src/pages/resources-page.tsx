import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Play, BookOpen, ArrowRight, ExternalLink } from "lucide-react";
import { YouTubeLite } from "@/components/youtube-lite";
import { SEOHead } from "@/components/seo-head";

const videos = [
  {
    id: "0sAqXGDRUHQ",
    title: "AI-Powered CIM Generator",
    description: "Learn how to create professional Confidential Information Memorandums in minutes using our AI-powered generator.",
    feature: "AI CIM Generator",
    featureLink: "/features/ai-powered-cim"
  },
  {
    id: "CNJvDmFTwYU",
    title: "Message Center Overview",
    description: "Discover how to communicate securely with investors and manage all your deal communications in one place.",
    feature: "Message Center",
    featureLink: "/features/messages"
  },
  {
    id: "J94mwM7rEOs",
    title: "E-Signatures",
    description: "See how to get NDAs and documents signed electronically with our integrated e-signature solution.",
    feature: "E-Signatures",
    featureLink: "/features/esignatures"
  }
];

export default function ResourcesPage() {
  return (
    <>
      <SEOHead
        title="Resources | CIM Share"
        description="Video tutorials, guides, and resources to help you get the most out of CIM Share for your M&A transactions."
        keywords="CIM Share tutorials, M&A resources, CIM generator guide, deal room tutorials, business broker resources"
        canonicalUrl="https://cimshare.com/resources"
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Resources & Tutorials
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Everything you need to master CIM Share and streamline your M&A process.
                Watch our video tutorials and explore our documentation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://cimshare.documentationai.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center"
                >
                  <Button size="lg" variant="outline" className="gap-2">
                    <BookOpen className="w-5 h-5" />
                    View Documentation
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Video Tutorials Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Video Tutorials
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Quick video walkthroughs to help you get started with each feature
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {videos.map((video) => (
                <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video">
                    <YouTubeLite
                      videoId={video.id}
                      title={video.title}
                      className="w-full h-full"
                    />
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {video.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {video.description}
                    </p>
                    <Link href={video.featureLink}>
                      <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto text-blue-600 hover:text-blue-700">
                        Learn more about {video.feature}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Documentation CTA Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <BookOpen className="w-16 h-16 text-blue-600 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Need More Help?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Our comprehensive documentation covers everything from getting started
                to advanced features. Find step-by-step guides, FAQs, and best practices.
              </p>
              <a
                href="https://cimshare.documentationai.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="gap-2">
                  <BookOpen className="w-5 h-5" />
                  Browse Documentation
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Create your first AI-powered CIM in minutes and see how CIM Share
              can transform your M&A workflow.
            </p>
            <Link href="/login">
              <Button size="lg" variant="secondary" className="gap-2">
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
