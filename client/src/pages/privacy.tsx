import { Link } from "wouter";
import { Flame, Shield, Lock, Eye, Server, Bell, Trash2, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#060b18]" data-testid="page-privacy">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6" data-testid="link-privacy-back">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-emerald-500 flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">FuelIQ NG</span>
          </div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-privacy-title">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-2">Last updated: March 6, 2026</p>
        </div>

        <div className="space-y-8">
          <Section
            icon={Eye}
            title="1. Information We Collect"
            content={[
              "Account Information: When you register, we collect your name, email address, and create a secure password hash. We never store your password in plain text.",
              "Business Data: Terminal selections, inventory records, transaction history, and trading signals you submit to the platform.",
              "Usage Data: We collect analytics about how you interact with FuelIQ NG, including pages visited, features used, and forecast queries made.",
              "Device Information: Browser type, IP address, and device identifiers for security and fraud prevention purposes.",
            ]}
          />

          <Section
            icon={Lock}
            title="2. Data Encryption & Security"
            content={[
              "Encryption in Transit: All data transmitted between your device and our servers is encrypted using TLS 1.2+ (HTTPS). We enforce secure connections for all API communications.",
              "Encryption at Rest: Sensitive data including passwords are encrypted using bcrypt with industry-standard salt rounds. Database connections use SSL encryption.",
              "Authentication: We use JSON Web Tokens (JWT) with cryptographic signing for secure session management. Tokens expire after 7 days and can be refreshed.",
              "Rate Limiting: Authentication endpoints are protected with rate limiting (20 attempts per 15 minutes) to prevent brute-force attacks.",
              "Security Headers: We implement HTTP security headers via Helmet.js including X-Frame-Options, X-Content-Type-Options, and Strict-Transport-Security.",
            ]}
          />

          <Section
            icon={Shield}
            title="3. How We Use Your Data"
            content={[
              "Market Intelligence: Your terminal and product selections are used to generate personalized AI-powered price forecasts, hedge recommendations, and arbitrage opportunities.",
              "Service Improvement: Aggregated and anonymized usage data helps us improve our forecasting algorithms and user experience.",
              "Notifications: If you opt in, we use your phone number and/or WhatsApp number to send price alerts, forecast updates, and morning digest reports.",
              "We do NOT sell, trade, or rent your personal information to third parties.",
              "We do NOT share your individual trading data, inventory positions, or business intelligence with other users or external parties.",
            ]}
          />

          <Section
            icon={Server}
            title="4. Data Storage & Retention"
            content={[
              "Your data is stored on secure PostgreSQL databases hosted within Replit's infrastructure with automated backups.",
              "Account data is retained for the duration of your subscription. Forecast history and market data are retained for analytics and historical reference.",
              "Transaction and inventory records are maintained for the life of your account to support audit trails and P&L calculations.",
              "You may request deletion of your account and associated data at any time by contacting our support team.",
            ]}
          />

          <Section
            icon={Bell}
            title="5. Notifications & Communications"
            content={[
              "SMS and WhatsApp notifications are opt-in only. You can enable or disable these at any time from your Dashboard Settings tab.",
              "We may send important service announcements (security alerts, terms updates) to your registered email regardless of notification preferences.",
              "Marketing communications are minimal and always include an opt-out mechanism.",
            ]}
          />

          <Section
            icon={Trash2}
            title="6. Your Rights"
            content={[
              "Access: You can view all your stored data through the FuelIQ NG dashboard at any time.",
              "Correction: You can update your profile information through the Settings tab.",
              "Deletion: You may request complete deletion of your account and all associated data.",
              "Portability: You can export your forecast history, inventory data, and transaction records (available on Elite tier).",
              "Consent Withdrawal: You can disable notifications and revoke data processing consent at any time.",
            ]}
          />

          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">7. Third-Party Services</h2>
            <div className="space-y-2 text-sm text-slate-400 leading-relaxed">
              <p>FuelIQ NG integrates with the following third-party services to deliver our platform:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                <li>NNPC for petroleum price data feeds</li>
                <li>Exchange rate providers for USD/NGN rates</li>
                <li>Twilio/Termii for SMS notifications (when enabled)</li>
                <li>Meta Cloud API for WhatsApp notifications (when enabled)</li>
              </ul>
              <p>Each third-party service is bound by their own privacy policies. We share only the minimum data required for each service to function.</p>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">8. Changes to This Policy</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any material changes by posting a notice on the platform and, where possible, sending you a notification. Your continued use of FuelIQ NG after changes are posted constitutes acceptance of the updated policy.
            </p>
          </div>

          <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-emerald-400">9. Contact Us</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              If you have questions about this privacy policy or your data, please contact us at:
            </p>
            <div className="text-sm text-white">
              <p>Email: privacy@fueliq.ng</p>
              <p>FuelIQ NG — Petroleum Market Intelligence Platform</p>
              <p>Lagos, Nigeria</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.06] text-center">
          <p className="text-sm text-slate-600">&copy; 2026 FuelIQ NG. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, content }: { icon: any; title: string; content: string[] }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-2">
        {content.map((paragraph, i) => (
          <p key={i} className="text-sm text-slate-400 leading-relaxed">{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
