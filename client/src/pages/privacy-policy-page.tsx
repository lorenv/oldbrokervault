import { Link } from "wouter";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose max-w-none space-y-6">
          <p className="text-sm text-gray-600 mb-8">
            <strong>Last Updated:</strong> December 2025
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Dealve Inc. ("Company," "we," "us," or "our") operates the CIM Share platform ("Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. By using CIM Share, you agree to the collection and use of information in accordance with this policy.
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
              <li>Browser type and operating system</li>
              <li>Usage patterns and feature interactions</li>
              <li>Device identifiers and performance data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">E-Signature Information</h3>
            <p>For electronic signatures on NDAs and other documents, we collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>IP Addresses:</strong> Collected at the time of signature to comply with the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and similar regulations</li>
              <li><strong>Estimated City Location:</strong> Derived from IP addresses to approximate the signer's city-level location only (never precise location)</li>
              <li><strong>Timestamp:</strong> Exact date and time of signature</li>
              <li><strong>Signer Information:</strong> Name and email address as provided</li>
            </ul>
            <p className="mt-2 text-sm text-gray-600">
              <strong>Important:</strong> IP addresses are collected solely for e-signature compliance and fraud prevention. We only derive estimated city-level location from IP addresses - we do not track precise locations or use GPS data. IP addresses are not used for marketing or sold to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve the CIM Share service</li>
              <li>Process AI analysis of your business content</li>
              <li>Generate and format CIM documents according to your specifications</li>
              <li>Process payments and manage subscriptions</li>
              <li>Communicate with you about your account and our services</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Ensure security and prevent fraud</li>
              <li>Comply with legal obligations including e-signature regulations</li>
              <li>Maintain audit trails for electronic signatures as required by law</li>
              <li>Display aggregated geographic distribution of document signers (city-level only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. AI Processing and Data Privacy</h2>

            <h3 className="text-lg font-medium mb-2">Third-Party AI Services</h3>
            <p>To generate and analyze CIM documents, we transmit your business content to the following AI service providers:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>OpenAI (GPT-4)</strong> - Used for document generation, content analysis, and text processing.
                <br /><span className="text-sm text-gray-600">Data Processing Agreement: Enterprise API terms with zero training commitment</span>
              </li>
              <li>
                <strong>Anthropic (Claude)</strong> - Used for document analysis and image/vision processing.
                <br /><span className="text-sm text-gray-600">Data Processing Agreement: API terms with explicit no-training policy</span>
              </li>
              <li>
                <strong>Perplexity AI</strong> - Used for market research and competitive analysis features.
                <br /><span className="text-sm text-gray-600">Data Processing Agreement: API terms for business use</span>
              </li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">Your Data Is NOT Used for AI Training</h3>
            <p>
              <strong>We want to be absolutely clear:</strong> Your confidential business information is NEVER used to train AI models. All AI providers we use have contractual commitments that API data is not used for model training. This means:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Your financial data, business metrics, and trade secrets remain confidential</li>
              <li>Your documents cannot influence or appear in AI responses to other users</li>
              <li>Your competitive information is not learned by the AI systems</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">Data Transmission Security</h3>
            <p>When your data is sent to AI providers:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Encryption in Transit:</strong> All data is transmitted over TLS 1.2+ encrypted connections</li>
              <li><strong>No Persistent Storage:</strong> AI providers process your data in real-time and do not permanently store it</li>
              <li><strong>Temporary Retention:</strong> Providers may retain data for up to 30 days for abuse monitoring, then it is deleted</li>
              <li><strong>Access Controls:</strong> Only authorized API endpoints can process your data</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">AI Provider Certifications</h3>
            <p>Our AI providers maintain the following security certifications and compliance:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>SOC 2 Type II compliance</li>
              <li>GDPR compliance for EU data subjects</li>
              <li>CCPA compliance for California residents</li>
              <li>Enterprise-grade security infrastructure</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">What Data Is Sent to AI Services</h3>
            <p>The following types of data may be transmitted to AI providers for processing:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Meeting transcripts and business descriptions you upload</li>
              <li>Financial information included in your documents</li>
              <li>Company descriptions and market positioning</li>
              <li>Uploaded images for analysis (logos, charts, screenshots)</li>
              <li>Website content for competitive analysis (when you use this feature)</li>
            </ul>
            <p className="mt-2 text-sm text-gray-600">
              <strong>Note:</strong> We do NOT send your account credentials, payment information, or personal contact details to AI providers.
            </p>

            <h3 className="text-lg font-medium mb-2 mt-4">Your Control Over AI Processing</h3>
            <p>
              AI processing is essential to our core service of generating CIM documents. If you have specific concerns about AI processing of your data, please contact us at privacy@cimshare.com to discuss your requirements.
            </p>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm">
                <strong>Want more details?</strong> View our complete{" "}
                <Link href="/data-security" className="text-blue-600 hover:underline font-medium">
                  Data Security & Privacy page
                </Link>
                {" "}for a visual data flow diagram and full list of third-party service certifications.
              </p>
            </div>
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
              We implement appropriate technical and organizational security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. This includes encryption in transit and at rest, access controls, and regular security assessments. E-signature records, including IP addresses, are encrypted and stored securely in compliance with regulatory requirements. However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
            <p>
              We retain your information for as long as necessary to provide the service and fulfill the purposes outlined in this policy. Account information is retained until you delete your account. CIM documents and associated content are retained according to your subscription plan and may be deleted after account termination. E-signature records, including IP addresses and audit trails, are retained for a minimum of 7 years to comply with legal requirements.
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
            <p className="mt-3">To exercise these rights, please contact us at privacy@cimshare.com.</p>
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
              <strong>Email:</strong> privacy@cimshare.com<br />
              <strong>Mail:</strong> Dealve Inc., Privacy Department, 123 Business District, Suite 456, New York, NY 10001<br />
              <strong>Phone:</strong> +1 (555) 123-4567
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}