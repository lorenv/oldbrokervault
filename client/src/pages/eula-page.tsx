export default function EulaPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">End User License Agreement (EULA)</h1>
        
        <div className="prose max-w-none space-y-6">
          <p className="text-sm text-gray-600 mb-8">
            <strong>Last Updated:</strong> January 2024
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Agreement to Terms</h2>
            <p>
              This End User License Agreement ("EULA") is a legal agreement between you ("User" or "You") and Dealve Inc., a Delaware corporation ("Company," "We," or "Us") for the use of the CIM God software platform ("Software" or "Service"). By registering for an account, accessing, or using our Service, you agree to be bound by the terms of this EULA.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Grant of License</h2>
            <p>
              Subject to your compliance with this EULA, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Software for your business purposes in accordance with your chosen subscription plan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Permitted Uses</h2>
            <p>You may use the Software to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Create, edit, and manage Confidential Information Memorandums (CIMs)</li>
              <li>Upload and analyze business transcripts using our AI-powered tools</li>
              <li>Export documents in supported formats (PDF, Word, HTML, Google Docs)</li>
              <li>Share documents securely with authorized parties</li>
              <li>Manage NDA protection and document access controls</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Restrictions</h2>
            <p>You may NOT:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Reverse engineer, decompile, or disassemble the Software</li>
              <li>Attempt to gain unauthorized access to our systems or other users' data</li>
              <li>Use the Software for illegal activities or to violate any applicable laws</li>
              <li>Share your account credentials or allow unauthorized access to your account</li>
              <li>Upload malicious content, viruses, or harmful code</li>
              <li>Exceed the usage limits of your subscription plan</li>
              <li>Use the Software to create competing products or services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Ownership and Privacy</h2>
            <p>
              You retain ownership of all content and data you upload to the Software ("Your Data"). We do not claim ownership rights to Your Data. However, you grant us a limited license to process, store, and analyze Your Data solely to provide the Service. We implement industry-standard security measures to protect Your Data and will not share it with third parties except as necessary to provide the Service or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. AI and Data Processing</h2>
            <p>
              Our Software uses artificial intelligence and machine learning technologies to analyze and structure your business information. By using the Service, you consent to the processing of your uploaded content through these automated systems. We may use aggregated, anonymized data to improve our AI models, but will never use your specific confidential information for training purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Subscription and Payment Terms</h2>
            <p>
              Access to certain features requires a paid subscription. Subscription fees are billed in advance and are non-refundable except as required by law. We may change subscription prices with 30 days' notice. Your subscription will automatically renew unless canceled before the renewal date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Termination</h2>
            <p>
              This EULA is effective until terminated. You may terminate this agreement by canceling your account. We may terminate or suspend your access immediately for breach of this EULA or for any other reason at our discretion. Upon termination, your right to use the Software ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Disclaimers</h2>
            <p>
              THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SOFTWARE WILL BE UNINTERRUPTED OR ERROR-FREE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM THIS EULA OR YOUR USE OF THE SOFTWARE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. WE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Indemnification</h2>
            <p>
              You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from your use of the Software, your violation of this EULA, or your violation of any rights of another party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Governing Law</h2>
            <p>
              This EULA shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes arising under this EULA shall be subject to the exclusive jurisdiction of the courts in Delaware.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Changes to This EULA</h2>
            <p>
              We may update this EULA from time to time. We will notify you of material changes by email or through the Software. Your continued use of the Software after such changes constitutes acceptance of the updated EULA.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Contact Information</h2>
            <p>
              If you have questions about this EULA, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> legal@cimgod.com<br />
              <strong>Address:</strong> Dealve Inc., Legal Department, 123 Business District, Suite 456, New York, NY 10001
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Entire Agreement</h2>
            <p>
              This EULA constitutes the entire agreement between you and us regarding the Software and supersedes all prior agreements and understandings, whether written or oral, relating to the subject matter herein.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}