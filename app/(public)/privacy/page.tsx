import { Metadata } from "next";
import LegalPageWrapper from "@/components/legal/LegalPageWrapper";
import { generateLegalMetadata } from "@/lib/metadata";
import TableOfContents from "@/components/legal/TableOfContents";
import LegalLayout from "@/components/legal/LegalLayout";

const lastUpdated = "2025-06-30";

export const metadata: Metadata = generateLegalMetadata(
  "Privacy Policy",
  "Privacy Policy for ShipKit.ai - How we collect, use, and protect your personal information in compliance with GDPR and CCPA."
);

const tocSections = [
  { id: "introduction", title: "Introduction", level: 1 },
  { id: "compliance", title: "🛡️ GDPR & CCPA Compliance", level: 1 },
  { id: "information", title: "Information We Collect", level: 1 },
  { id: "usage", title: "How We Use Information", level: 1 },
  { id: "sharing", title: "Information Sharing", level: 1 },
  { id: "retention", title: "Data Retention", level: 1 },
  { id: "security", title: "Data Security", level: 1 },
  { id: "rights", title: "Your Privacy Rights", level: 1 },
  { id: "cookies", title: "Cookies and Tracking", level: 1 },
  { id: "international", title: "International Transfers", level: 1 },
  { id: "children", title: "Children's Privacy", level: 1 },
  { id: "changes", title: "Changes to This Policy", level: 1 },
  { id: "contact", title: "Contact Information", level: 1 },
];

export default function PrivacyPolicy() {
  return (
    <LegalLayout tocSidebar={<TableOfContents sections={tocSections} />}>
      <LegalPageWrapper
        title="Privacy Policy"
        lastUpdated={lastUpdated}
        description="This Privacy Policy describes how ShipKit.ai collects, uses, and protects your personal information when you use our AI chat platform."
      >
        <section id="introduction">
          <h2>1. Introduction</h2>
          <p>
            ShipKit.ai (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;) respects your privacy and is committed to
            protecting your personal information. This Privacy Policy explains
            how we collect, use, disclose, and safeguard your information when
            you use our AI chat platform service.
          </p>
          <p>
            By using our Service, you consent to the collection and use of
            information in accordance with this Privacy Policy. If you do not
            agree with the terms of this Privacy Policy, please do not access or
            use the Service.
          </p>
          <p>
            This Privacy Policy complies with the General Data Protection
            Regulation (GDPR), California Consumer Privacy Act (CCPA), and other
            applicable privacy laws.
          </p>
        </section>

        {/* Compliance Banner */}
        <section
          id="compliance"
          className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8"
        >
          <h2 className="text-xl font-semibold mb-4 text-primary">
            🛡️ Privacy Compliance Statement
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
              <h3 className="font-semibold mb-2 flex items-center">
                🇪🇺 GDPR Compliant
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Full compliance with European Union General Data Protection
                Regulation
              </p>
              <ul className="text-sm space-y-1">
                <li>✓ Lawful basis for data processing</li>
                <li>✓ Right to access, rectify, and delete data</li>
                <li>✓ Data portability and objection rights</li>
                <li>✓ Data Protection Officer available</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
              <h3 className="font-semibold mb-2 flex items-center">
                🇺🇸 CCPA Compliant
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Full compliance with California Consumer Privacy Act
              </p>
              <ul className="text-sm space-y-1">
                <li>✓ Right to know what data we collect</li>
                <li>✓ Right to delete personal information</li>
                <li>
                  ✓ Right to opt-out of data sales (we don&rsquo;t sell data)
                </li>
                <li>✓ Non-discrimination for exercising rights</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              <strong>Contact our Data Protection Officer:</strong>{" "}
              <a
                href="mailto:privacy@shipkit.ai"
                className="text-primary hover:underline"
              >
                privacy@shipkit.ai
              </a>
            </p>
          </div>
        </section>

        <section id="information">
          <h2>2. Information We Collect</h2>
          <p>
            We collect several types of information from and about users of our
            Service:
          </p>

          <h3>2.1 Personal Information</h3>
          <ul>
            <li>
              <strong>Account Information:</strong> Email address, name, and
              authentication credentials
            </li>
            <li>
              <strong>Profile Information:</strong> Optional profile details you
              choose to provide
            </li>
            <li>
              <strong>Communication Data:</strong> Your chat conversations with
              AI models
            </li>
            <li>
              <strong>Contact Information:</strong> When you contact our support
              team
            </li>
          </ul>

          <h3>2.2 Usage Information</h3>
          <ul>
            <li>
              <strong>Service Usage:</strong> Features used, models accessed,
              usage frequency
            </li>
            <li>
              <strong>Performance Data:</strong> Response times, error rates,
              service availability
            </li>
            <li>
              <strong>Preferences:</strong> Settings, theme choices, model
              preferences
            </li>
          </ul>

          <h3>2.4 Technical Information</h3>
          <ul>
            <li>
              <strong>Device Information:</strong> Browser type, operating
              system, device identifiers
            </li>
            <li>
              <strong>Log Data:</strong> IP addresses, access times, pages
              viewed
            </li>
            <li>
              <strong>Cookies:</strong> Browser cookies and similar tracking
              technologies
            </li>
          </ul>
        </section>

        <section id="usage">
          <h2>3. How We Use Information</h2>
          <p>We use the collected information for the following purposes:</p>

          <h3>3.1 Service Provision</h3>
          <ul>
            <li>Provide and maintain our AI chat platform</li>
            <li>Process your requests and facilitate AI model interactions</li>
            <li>Manage your account and preferences</li>
            <li>Store and retrieve your conversation history</li>
          </ul>

          <h3>3.2 Communication</h3>
          <ul>
            <li>Send service-related notifications and updates</li>
            <li>Respond to your inquiries and support requests</li>
            <li>Notify you of changes to our Service or policies</li>
          </ul>

          <h3>3.3 Service Improvement</h3>
          <ul>
            <li>
              Analyze usage patterns to improve AI model performance and chat
              interface
            </li>
            <li>Monitor service performance and reliability</li>
            <li>Develop new AI model integrations and chat features</li>
          </ul>

          <h3>3.4 Legal and Security</h3>
          <ul>
            <li>Comply with legal obligations and regulations</li>
            <li>Protect against fraud, abuse, and security threats</li>
            <li>Enforce our Terms of Service</li>
            <li>Resolve disputes and investigate violations</li>
          </ul>
        </section>

        <section id="sharing">
          <h2>4. Information Sharing and Disclosure</h2>
          <p>
            We do not sell, trade, or otherwise transfer your personal
            information to third parties except as described below:
          </p>

          <h3>4.1 Service Providers</h3>
          <ul>
            <li>
              <strong>Authentication:</strong> Supabase for user authentication
              and account management
            </li>
            <li>
              <strong>Infrastructure:</strong> Cloud hosting providers for data
              storage and service delivery
            </li>
            <li>
              <strong>Hosting & Analytics:</strong> Cloud hosting and basic
              usage monitoring
            </li>
          </ul>

          <h3>4.2 Third-Party AI Services</h3>
          <p>Our Service integrates with third-party AI model providers:</p>
          <ul>
            <li>
              <strong>OpenAI:</strong> For GPT model access and processing
            </li>
            <li>
              <strong>Anthropic:</strong> For Claude model access and processing
            </li>
            <li>
              <strong>Google:</strong> For Gemini model access and processing
            </li>
            <li>
              <strong>Other AI Providers:</strong> Additional model providers as
              we expand our offerings
            </li>
          </ul>
          <p>
            These providers may process your conversation data to generate
            responses. We encourage you to review their privacy policies.
          </p>

          <h3>4.3 Legal Requirements</h3>
          <p>
            We may disclose your information if required by law or in good faith
            belief that such disclosure is necessary to:
          </p>
          <ul>
            <li>Comply with legal processes or government requests</li>
            <li>Protect our rights, property, or safety</li>
            <li>Protect the rights, property, or safety of our users</li>
            <li>Investigate potential violations of our Terms of Service</li>
          </ul>

          <h3>4.4 Business Transfers</h3>
          <p>
            In the event of a merger, acquisition, or sale of assets, your
            information may be transferred as part of that transaction. We will
            provide notice before your information becomes subject to a
            different privacy policy.
          </p>
        </section>

        <section id="retention">
          <h2>5. Data Retention</h2>
          <p>
            We retain your information for as long as necessary to provide our
            Service and fulfill the purposes outlined in this Privacy Policy:
          </p>
          <ul>
            <li>
              <strong>Account Information:</strong> Until you delete your
              account plus 30 days for backup purposes
            </li>
            <li>
              <strong>Conversation History:</strong> Until you delete it or
              close your account
            </li>
            <li>
              <strong>Usage Data:</strong> Basic usage patterns (anonymized)
              retained for service improvement
            </li>
            <li>
              <strong>Legal Holds:</strong> Information may be retained longer
              if required by law or legal proceedings
            </li>
          </ul>
          <p>
            You can request deletion of your data at any time by contacting us
            or using account deletion features in our Service.
          </p>
        </section>

        <section id="security">
          <h2>6. Data Security</h2>
          <p>
            We implement appropriate technical and organizational security
            measures to protect your personal information:
          </p>
          <ul>
            <li>
              <strong>Encryption:</strong> Data encryption in transit and at
              rest
            </li>
            <li>
              <strong>Access Controls:</strong> Limited access to personal
              information on a need-to-know basis
            </li>
            <li>
              <strong>Authentication:</strong> Multi-factor authentication for
              administrative access
            </li>
            <li>
              <strong>Regular Audits:</strong> Security assessments and
              vulnerability testing
            </li>
            <li>
              <strong>Incident Response:</strong> Procedures for detecting and
              responding to security breaches
            </li>
          </ul>
          <p>
            However, no method of transmission over the Internet or electronic
            storage is 100% secure. While we strive to protect your personal
            information, we cannot guarantee absolute security.
          </p>
        </section>

        <section id="rights">
          <h2>7. Your Privacy Rights</h2>
          <p>
            Depending on your location, you may have the following rights
            regarding your personal information:
          </p>
          <ul>
            <li>
              <strong>Access:</strong> Request access to your personal
              information
            </li>
            <li>
              <strong>Correction:</strong> Request correction of inaccurate or
              incomplete information
            </li>
            <li>
              <strong>Deletion:</strong> Request deletion of your personal
              information
            </li>
            <li>
              <strong>Portability:</strong> Request a copy of your data in a
              portable format
            </li>
            <li>
              <strong>Restriction:</strong> Request restriction of processing in
              certain circumstances
            </li>
            <li>
              <strong>Objection:</strong> Object to processing based on
              legitimate interests
            </li>
            <li>
              <strong>Withdraw Consent:</strong> Withdraw consent for processing
              where consent is the legal basis
            </li>
          </ul>

          <h3>7.1 GDPR Rights (EU Users)</h3>
          <p>
            If you are located in the European Union, you have additional rights
            under the GDPR:
          </p>
          <ul>
            <li>
              <strong>Legal Basis:</strong> We process your data based on
              contract performance, legitimate interests, and consent
            </li>
            <li>
              <strong>Data Protection Officer:</strong> You can contact our DPO
              at privacy@shipkit.ai
            </li>
            <li>
              <strong>Supervisory Authority:</strong> You have the right to
              lodge a complaint with your local data protection authority
            </li>
            <li>
              <strong>Automated Decision-Making:</strong> We do not engage in
              automated decision-making that significantly affects you
            </li>
          </ul>
        </section>

        <section id="ccpa">
          <h3>7.2 CCPA Rights (California Users)</h3>
          <p>
            If you are a California resident, you have specific rights under the
            CCPA:
          </p>
          <ul>
            <li>
              <strong>Right to Know:</strong> Request disclosure of personal
              information collected, used, or shared
            </li>
            <li>
              <strong>Right to Delete:</strong> Request deletion of personal
              information
            </li>
            <li>
              <strong>Right to Opt-Out:</strong> Opt-out of the sale of personal
              information (we do not sell personal information)
            </li>
            <li>
              <strong>Right to Non-Discrimination:</strong> Not be discriminated
              against for exercising your rights
            </li>
          </ul>
        </section>

        <section id="cookies">
          <h2>8. Cookies and Tracking Technologies</h2>
          <p>
            We use cookies and similar tracking technologies to enhance your
            experience:
          </p>
          <ul>
            <li>
              <strong>Essential Cookies:</strong> Required for basic site
              functionality and security
            </li>
            <li>
              <strong>Preference Cookies:</strong> Remember your settings and
              preferences
            </li>
            <li>
              <strong>Analytics Cookies:</strong> Help us understand how you use
              our Service
            </li>
          </ul>
          <p>
            You can control cookie settings through your browser preferences.
            However, disabling certain cookies may affect the functionality of
            our Service. For more detailed information, please see our Cookie
            Policy.
          </p>
        </section>

        <section id="international">
          <h2>9. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries
            other than your own. We ensure appropriate safeguards are in place:
          </p>
          <ul>
            <li>
              <strong>Adequacy Decisions:</strong> Transfers to countries with
              adequate data protection laws
            </li>
            <li>
              <strong>Standard Contractual Clauses:</strong> EU-approved
              contractual protections
            </li>
            <li>
              <strong>Certification Programs:</strong> Privacy Shield successors
              and similar frameworks
            </li>
            <li>
              <strong>Consent:</strong> Your explicit consent for transfers
              where required
            </li>
          </ul>
        </section>

        <section id="children">
          <h2>10. Children&apos;s Privacy</h2>
          <p>
            Our Service is not intended for children under 13 years of age. We
            do not knowingly collect personal information from children under
            13. If you are a parent or guardian and believe your child has
            provided us with personal information, please contact us
            immediately.
          </p>
          <p>
            If we learn that we have collected personal information from
            children under 13 without verification of parental consent, we will
            take steps to remove that information from our servers.
          </p>
        </section>

        <section id="changes">
          <h2>11. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect
            changes in our practices or applicable laws. We will notify you of
            any material changes by:
          </p>
          <ul>
            <li>Posting the updated policy on our website</li>
            <li>
              Sending an email notification to your registered email address
            </li>
            <li>Displaying a prominent notice on our Service</li>
          </ul>
          <p>
            Your continued use of our Service after the effective date of any
            changes constitutes your acceptance of the updated Privacy Policy.
          </p>
        </section>

        <section id="contact">
          <h2>12. Contact Information</h2>
          <p>
            If you have any questions, concerns, or requests regarding this
            Privacy Policy or our data practices, please contact us:
          </p>
          <div className="bg-muted/30 p-4 rounded-lg border">
            <p>
              <strong>Privacy Officer:</strong> privacy@shipkit.ai
            </p>
            <p>
              <strong>General Contact:</strong> support@shipkit.ai
            </p>
            <p>
              <strong>Address:</strong> [Your Company Address]
            </p>
            <p>
              <strong>Phone:</strong> [Your Phone Number]
            </p>
          </div>
          <p>
            We will respond to your requests within the timeframes required by
            applicable law, typically within 30 days.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            <strong>Last Updated:</strong> {lastUpdated}
          </p>
        </section>

        <div className="section-divider"></div>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            This Privacy Policy is effective as of {lastUpdated}. We reserve the
            right to modify this policy at any time, so please review it
            frequently.
          </p>
        </div>
      </LegalPageWrapper>
    </LegalLayout>
  );
}
