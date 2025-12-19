import { Metadata } from "next";
import LegalPageWrapper from "@/components/legal/LegalPageWrapper";
import { generateLegalMetadata } from "@/lib/metadata";
import TableOfContents from "@/components/legal/TableOfContents";
import LegalLayout from "@/components/legal/LegalLayout";

const lastUpdated = "2025-06-30";

export const metadata: Metadata = generateLegalMetadata(
  "Cookie Policy",
  "Cookie Policy for ShipKit.ai - Information about cookies and tracking technologies we use to enhance your experience."
);

const tocSections = [
  { id: "introduction", title: "What Are Cookies", level: 1 },
  { id: "types", title: "Types of Cookies We Use", level: 1 },
  { id: "essential", title: "Essential Cookies", level: 2 },
  { id: "preference", title: "Preference Cookies", level: 2 },
  { id: "analytics", title: "Analytics Cookies", level: 2 },
  { id: "thirdparty", title: "Third-Party Cookies", level: 1 },
  { id: "control", title: "Managing Cookie Preferences", level: 1 },
  { id: "impact", title: "Impact of Disabling Cookies", level: 1 },
  { id: "updates", title: "Updates to This Policy", level: 1 },
  { id: "contact", title: "Contact Information", level: 1 },
];

export default function CookiePolicy() {
  return (
    <LegalLayout tocSidebar={<TableOfContents sections={tocSections} />}>
      <LegalPageWrapper
        title="Cookie Policy"
        lastUpdated={lastUpdated}
        description="This Cookie Policy explains how ShipKit.ai uses cookies and similar tracking technologies to enhance your experience and improve our services."
      >
        <section id="introduction">
          <h2>1. What Are Cookies</h2>
          <p>
            Cookies are small text files that are stored on your device
            (computer, tablet, or mobile) when you visit a website. They help
            websites remember your preferences and improve your browsing
            experience.
          </p>
          <p>
            Similar technologies include web beacons, pixels, and local storage,
            which serve similar purposes to cookies. This policy covers all
            these technologies, collectively referred to as
            &ldquo;cookies.&rdquo;
          </p>
          <p>
            ShipKit.ai uses cookies to provide essential functionality, remember
            your preferences, analyze usage patterns, and improve our AI chat
            platform service.
          </p>
        </section>

        {/* Compliance Notice */}
        <section className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="text-lg">🇪🇺</span>
              <strong>GDPR Compliant</strong>
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="flex items-center gap-2">
              <span className="text-lg">🇺🇸</span>
              <strong>CCPA Compliant</strong>
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              Contact:{" "}
              <a
                href="mailto:privacy@shipkit.ai"
                className="text-primary hover:underline"
              >
                privacy@shipkit.ai
              </a>
            </span>
          </div>
        </section>

        <section id="types">
          <h2>2. Types of Cookies We Use</h2>
          <p>
            We use different types of cookies for various purposes. Here&apos;s
            a breakdown of each category:
          </p>
        </section>

        <section id="essential">
          <h3>2.1 Essential Cookies</h3>
          <p>
            These cookies are necessary for our website to function properly and
            cannot be disabled. They enable core functionality such as:
          </p>
          <ul>
            <li>
              <strong>Authentication:</strong> Keeping you logged in during your
              session
            </li>
            <li>
              <strong>Security:</strong> Protecting against cross-site request
              forgery and other security threats
            </li>
            <li>
              <strong>Session Management:</strong> Maintaining your active
              session and preventing data loss
            </li>
            <li>
              <strong>Theme Preference:</strong> Remembering your light/dark
              mode choice
            </li>
          </ul>
          <div className="bg-muted/30 p-4 rounded-lg border mt-4">
            <h4 className="font-medium mb-2">Essential Cookies Used:</h4>
            <ul className="text-sm space-y-1">
              <li>
                <strong>supabase-auth-token:</strong> Authentication token for
                secure login
              </li>
              <li>
                <strong>session-id:</strong> Session identifier for maintaining
                your active session
              </li>
              <li>
                <strong>theme-preference:</strong> Your selected theme
                preference
              </li>
            </ul>
          </div>
        </section>

        <section id="preference">
          <h3>2.2 Preference Cookies</h3>
          <p>
            These cookies remember your choices and preferences to provide a
            more personalized experience:
          </p>
          <ul>
            <li>
              <strong>Language Settings:</strong> Your preferred language for
              the interface
            </li>
            <li>
              <strong>UI Preferences:</strong> Layout choices, sidebar
              preferences, and display options
            </li>
            <li>
              <strong>Model Preferences:</strong> Your preferred AI models and
              conversation settings
            </li>
          </ul>
          <div className="bg-muted/30 p-4 rounded-lg border mt-4">
            <h4 className="font-medium mb-2">Preference Cookies Used:</h4>
            <ul className="text-sm space-y-1">
              <li>
                <strong>user-preferences:</strong> General user interface and
                interaction preferences
              </li>
              <li>
                <strong>model-settings:</strong> Preferred AI models and
                conversation configurations
              </li>
            </ul>
          </div>
        </section>

        <section id="analytics">
          <h3>2.3 Analytics Cookies</h3>
          <p>
            These cookies help us understand how visitors use our website,
            allowing us to improve performance and user experience:
          </p>
          <ul>
            <li>
              <strong>Usage Analytics:</strong> Page views, feature usage, and
              user interactions
            </li>
            <li>
              <strong>Performance Monitoring:</strong> Load times, error rates,
              and service availability
            </li>
            <li>
              <strong>User Engagement:</strong> How users interact with our
              platform
            </li>
          </ul>
          <div className="bg-muted/30 p-4 rounded-lg border mt-4">
            <h4 className="font-medium mb-2">Analytics Cookies Used:</h4>
            <ul className="text-sm space-y-1">
              <li>
                <strong>_ga:</strong> Google Analytics identifier for tracking
                user sessions
              </li>
              <li>
                <strong>app-analytics:</strong> Internal analytics for feature
                usage and performance
              </li>
            </ul>
            <p className="text-sm mt-2 text-muted-foreground">
              <strong>Note:</strong> All analytics data is aggregated and
              anonymized. We do not track individual user behavior or link
              analytics data to your personal account information.
            </p>
          </div>
        </section>

        <section id="thirdparty">
          <h2>3. Third-Party Cookies</h2>
          <p>
            Some cookies are set by third-party services we use to provide our
            platform functionality:
          </p>

          <h3>3.1 Authentication Services</h3>
          <ul>
            <li>
              <strong>Supabase:</strong> User authentication and account
              management
            </li>
          </ul>

          <h3>3.3 AI Model Providers</h3>
          <ul>
            <li>
              <strong>OpenAI, Anthropic, Google:</strong> AI model access and
              processing
            </li>
          </ul>

          <h3>3.4 Analytics</h3>
          <ul>
            <li>
              <strong>Google Analytics:</strong> Website usage analytics
            </li>
          </ul>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mt-4">
            <p className="text-sm">
              <strong>Note:</strong> Third-party cookies are governed by the
              respective third party&apos;s privacy policy. We encourage you to
              review the privacy policies of these services for more information
              about their data practices.
            </p>
          </div>
        </section>

        <section id="control">
          <h2>4. Managing Your Cookie Preferences</h2>
          <p>
            You have several options for controlling how cookies are used on
            your device:
          </p>

          <h3>4.1 Browser Settings</h3>
          <p>
            Most web browsers allow you to control cookies through their
            settings. Here&apos;s how to manage cookies in popular browsers:
          </p>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="bg-muted/30 p-4 rounded-lg border">
              <h4 className="font-medium mb-2">Google Chrome</h4>
              <ol className="text-sm space-y-1">
                <li>1. Click the three dots menu → Settings</li>
                <li>
                  2. Go to Privacy and security → Cookies and other site data
                </li>
                <li>3. Choose your preferred cookie settings</li>
              </ol>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border">
              <h4 className="font-medium mb-2">Mozilla Firefox</h4>
              <ol className="text-sm space-y-1">
                <li>1. Click the menu button → Settings</li>
                <li>2. Go to Privacy & Security</li>
                <li>3. Choose your cookie and tracking settings</li>
              </ol>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border">
              <h4 className="font-medium mb-2">Safari</h4>
              <ol className="text-sm space-y-1">
                <li>1. Safari menu → Preferences</li>
                <li>2. Go to Privacy tab</li>
                <li>3. Choose your cookie preferences</li>
              </ol>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border">
              <h4 className="font-medium mb-2">Microsoft Edge</h4>
              <ol className="text-sm space-y-1">
                <li>1. Click the three dots menu → Settings</li>
                <li>2. Go to Cookies and site permissions</li>
                <li>3. Manage cookies and site data</li>
              </ol>
            </div>
          </div>

          <h3>4.2 Cookie Consent</h3>
          <p>
            When you first visit our website, you can choose your cookie
            preferences through our consent banner.
          </p>
        </section>

        <section id="impact">
          <h2>5. Impact of Disabling Cookies</h2>
          <p>
            While you have the right to disable cookies, doing so may affect
            your experience on our platform:
          </p>

          <h3>5.1 Disabling Essential Cookies</h3>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm">
              <strong>Warning:</strong> Disabling essential cookies will prevent
              you from using our service. You may not be able to log in,
              maintain your session, or access core platform features.
            </p>
          </div>

          <h3>5.2 Disabling Preference Cookies</h3>
          <ul>
            <li>
              Your theme preference (light/dark mode) won&apos;t be remembered
            </li>
            <li>Language and interface settings will reset each visit</li>
            <li>
              Model preferences and conversation settings won&apos;t be saved
            </li>
            <li>You&apos;ll need to reconfigure settings on each visit</li>
          </ul>

          <h3>5.3 Disabling Analytics Cookies</h3>
          <ul>
            <li>
              We won&apos;t be able to track usage patterns to improve our
              service
            </li>
            <li>Performance monitoring will be limited</li>
            <li>You&apos;ll still have full access to all platform features</li>
            <li>Your privacy will be enhanced with less data collection</li>
          </ul>
        </section>

        <section id="updates">
          <h2>6. Updates to This Cookie Policy</h2>
          <p>
            We may update this Cookie Policy from time to time to reflect
            changes in our practices, new technologies, or legal requirements.
            When we make significant changes, we will:
          </p>
          <ul>
            <li>
              Update the &ldquo;Last Updated&rdquo; date at the top of this
              policy
            </li>
            <li>
              Notify you through our website or email if you&apos;re a
              registered user
            </li>
            <li>Request renewed consent for any new types of cookies</li>
            <li>Provide clear information about what has changed</li>
          </ul>
          <p>
            We encourage you to review this Cookie Policy periodically to stay
            informed about our cookie practices.
          </p>
        </section>

        <section id="contact">
          <h2>7. Contact Information</h2>
          <p>
            If you have any questions or concerns about our use of cookies or
            this Cookie Policy, please contact us:
          </p>
          <div className="bg-muted/30 p-4 rounded-lg border">
            <p>
              <strong>Privacy Officer:</strong> privacy@shipkit.ai
            </p>
            <p>
              <strong>General Support:</strong> support@shipkit.ai
            </p>
            <p>
              <strong>Address:</strong> [Your Company Address]
            </p>
          </div>
          <p>
            We&apos;re committed to transparency about our cookie practices and
            will respond to your inquiries promptly.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            <strong>Last Updated:</strong> {lastUpdated}
          </p>
        </section>

        <div className="section-divider"></div>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            This Cookie Policy is effective as of {lastUpdated}. By continuing
            to use our service, you acknowledge that you have read and
            understood this policy.
          </p>
        </div>
      </LegalPageWrapper>
    </LegalLayout>
  );
}
