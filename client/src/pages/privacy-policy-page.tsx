export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose max-w-none space-y-6">
          <p className="text-sm text-gray-600 mb-8">
            <strong>Last Updated:</strong> January 2024
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Dealve Inc. ("Company," "we," "us," or "our") operates the CIM God platform ("Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. By using CIM God, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium mb-2">Personal Information</h3>
            <p>We collect information you provide directly to us, such as:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name and email address when you create an account</li>
              <li>Profile information including business details and contact information</li>
              <li>Payment information processed through Stripe (we do not store payment details)</li>
              <li>Communications with our support team</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">Business Content</h3>
            <p>We collect and process business information you upload to create CIM documents, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Meeting transcripts and business descriptions</li>
              <li>Financial information and business metrics</li>
              <li>Company logos and images</li>
              <li>Website URLs and extracted content</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">Technical Information</h3>
            <p>We automatically collect certain information, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address, browser type, and operating system</li>
              <li>Usage patterns and feature interactions</li>
              <li>Device identifiers and performance data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve the CIM God service</li>
              <li>Process AI analysis of your business content</li>
              <li>Generate and format CIM documents according to your specifications</li>
              <li>Process payments and manage subscriptions</li>
              <li>Communicate with you about your account and our services</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Ensure security and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. AI Processing and Data Usage</h2>
            <p>
              Your business content is processed through artificial intelligence systems to analyze and structure information for CIM generation. We use secure third-party AI services including OpenAI and Perplexity AI. Your specific confidential business information is never used to train AI models. We may use aggregated, anonymized usage patterns to improve our AI analysis capabilities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Information Sharing and Disclosure</h2>
            <p>We do not sell, trade, or otherwise transfer your personal information to third parties except in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service Providers:</strong> We share information with trusted third parties who assist in operating our service (AI processing, payment processing, hosting)</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>Consent:</strong> When you explicitly authorize us to share your information</li>
              <li><strong>Security:</strong> To protect our rights, property, or safety and that of our users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. This includes encryption in transit and at rest, access controls, and regular security assessments. However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
            <p>
              We retain your information for as long as necessary to provide the service and fulfill the purposes outlined in this policy. Account information is retained until you delete your account. CIM documents and associated content are retained according to your subscription plan and may be deleted after account termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Your Rights and Choices</h2>
            <p>Depending on your location, you may have the following rights regarding your personal information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Objection:</strong> Object to certain processing of your information</li>
              <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
            </ul>
            <p className="mt-3">To exercise these rights, please contact us at privacy@cimgod.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for international transfers, including standard contractual clauses and adequacy decisions where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Children's Privacy</h2>
            <p>
              Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will delete that information immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. California Privacy Rights</h2>
            <p>
              California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to delete personal information, and the right to opt-out of the sale of personal information. We do not sell personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date. Significant changes will be communicated via email or prominent notice in the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> privacy@cimgod.com<br />
              <strong>Mail:</strong> Dealve Inc., Privacy Department, 123 Business District, Suite 456, New York, NY 10001<br />
              <strong>Phone:</strong> +1 (555) 123-4567
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}