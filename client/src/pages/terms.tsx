import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Flame,
  Gavel,
  Lock,
  Mail,
  Shield,
  UserCheck,
} from "lucide-react";

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-[#060b18]" data-testid="page-terms">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6"
            data-testid="link-terms-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-emerald-500 flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">FuelIQ NG</span>
          </div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-terms-title">
            Terms of Use
          </h1>
          <p className="text-sm text-slate-500 mt-2">Last updated: September 6, 2026</p>
          <p className="text-sm text-slate-400 leading-relaxed mt-4">
            These Terms of Use govern your access to and use of the FuelIQ NG
            petroleum market intelligence platform. By creating an account or
            using the service, you agree to these terms.
          </p>
        </div>

        <div className="space-y-8">
          <Section
            icon={UserCheck}
            title="1. Eligibility and Accounts"
            content={[
              "You must be at least 18 years old and legally able to enter into a binding agreement to use FuelIQ NG. If you use the service for a business or organisation, you confirm that you have authority to bind that organisation.",
              "You are responsible for providing accurate registration information, keeping your password and authentication credentials confidential, and all activity carried out through your account.",
              "You must notify us promptly if you believe your account has been accessed without permission. We may suspend or restrict an account where we reasonably suspect fraud, abuse, or a security risk.",
            ]}
          />

          <Section
            icon={FileText}
            title="2. The Service and Market Information"
            content={[
              "FuelIQ NG provides petroleum market information, historical data, estimates, forecasts, alerts, signals, and related analytical tools. Features may vary by subscription tier and may change as the service develops.",
              "Information is compiled from sources believed to be reliable, but it may be incomplete, delayed, inaccurate, or unavailable. We do not guarantee the accuracy, completeness, timeliness, or suitability of any information.",
              "Forecasts, recommendations, price ranges, hedge ideas, and signals are generated for informational and educational purposes only. They are not financial, investment, trading, legal, tax, accounting, procurement, or other professional advice. You remain solely responsible for your decisions and should obtain independent professional advice where appropriate.",
            ]}
          />

          <div className="rounded-xl bg-amber-500/[0.05] border border-amber-500/20 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-amber-300">3. No Guarantee of Results</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Past performance, historical prices, model confidence scores, and
              forecast accuracy are not guarantees of future results. FuelIQ NG
              does not guarantee profits, savings, availability of fuel, price
              movements, transaction outcomes, or uninterrupted access to the
              platform. Never commit funds or inventory solely on the basis of
              information displayed by FuelIQ NG.
            </p>
          </div>

          <Section
            icon={CheckCircle2}
            title="4. Subscriptions, Billing, and Cancellation"
            content={[
              "Some features require a paid subscription. Prices, features, usage limits, and billing periods are shown at checkout or on the applicable subscription page. Payments are processed by third-party payment providers and are subject to their terms.",
              "Unless otherwise stated at checkout, paid subscriptions renew for the selected billing period until cancelled. You authorise the applicable payment provider to charge the payment method associated with your subscription.",
              "You may cancel renewal through the available account or subscription controls. Cancellation normally takes effect at the end of the current paid period, and access to paid features may continue until then.",
              "Except where required by applicable law or expressly stated at checkout, payments are non-refundable. We may issue a refund or credit at our discretion where a service failure or billing error warrants it.",
            ]}
          />

          <Section
            icon={Shield}
            title="5. Acceptable Use"
            content={[
              "You may use FuelIQ NG only for lawful business or personal purposes and in accordance with these terms.",
              "You must not resell, sublicense, publish, scrape, systematically copy, reverse engineer, interfere with, overload, or attempt to gain unauthorised access to the service or its underlying systems.",
              "You must not upload unlawful, deceptive, abusive, defamatory, infringing, malicious, or privacy-invasive content, or use the platform to facilitate fraud, market manipulation, sanctions evasion, or other unlawful activity.",
              "You must not share account access in a way that circumvents subscription limits. We may remove content or suspend access when necessary to protect the service, users, or third parties.",
            ]}
          />

          <Section
            icon={Lock}
            title="6. Your Content and Our Intellectual Property"
            content={[
              "You retain ownership of information and business records that you submit to FuelIQ NG. You grant us a limited licence to host, process, transmit, and display that content only as needed to operate, secure, and improve the service.",
              "You are responsible for ensuring that you have the rights and permissions needed to submit your content and that it does not violate any law or third-party right.",
              "FuelIQ NG, including its software, interface, branding, reports, models, databases, and original content, is owned by or licensed to us and is protected by applicable intellectual-property laws. Except for the limited right to use the service under these terms, no ownership rights are transferred to you.",
            ]}
          />

          <Section
            icon={Gavel}
            title="7. Privacy and Third-Party Services"
            content={[
              "Our Privacy Policy explains how we collect, use, disclose, retain, and protect personal information. By using FuelIQ NG, you acknowledge that processing described in that policy is part of the service.",
              "The platform may link to or use third-party services, including payment, messaging, hosting, data, analytics, and communications providers. Third-party services are governed by their own terms and policies, and we are not responsible for their independent acts or omissions.",
            ]}
          />

          <Section
            icon={AlertTriangle}
            title="8. Disclaimers and Limitation of Liability"
            content={[
              "To the maximum extent permitted by law, the service is provided on an 'as is' and 'as available' basis without warranties of any kind, whether express, implied, or statutory, including warranties of accuracy, fitness for a particular purpose, merchantability, availability, title, and non-infringement.",
              "To the maximum extent permitted by law, FuelIQ NG and its owners, employees, contractors, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive loss, or for loss of profits, revenue, data, business opportunities, goodwill, fuel, inventory, or trading value arising from your use of or reliance on the service.",
              "Nothing in these terms excludes or limits liability that cannot legally be excluded or limited under applicable law.",
            ]}
          />

          <Section
            icon={FileText}
            title="9. Suspension and Termination"
            content={[
              "You may stop using the service at any time. We may suspend or terminate access, with or without notice where reasonably necessary, for breach of these terms, non-payment, suspected fraud or abuse, security concerns, legal requirements, or discontinuation of the service.",
              "On termination, your right to use the service ends immediately. Provisions that by their nature should survive termination, including intellectual property, disclaimers, limitations of liability, dispute provisions, and outstanding payment obligations, will continue to apply.",
            ]}
          />

          <Section
            icon={Gavel}
            title="10. Governing Law and Disputes"
            content={[
              "These terms are governed by the laws of the Federal Republic of Nigeria, without regard to conflict-of-law principles.",
              "The parties will first attempt in good faith to resolve any dispute through written notice and reasonable discussions. If the dispute cannot be resolved amicably, it will be subject to the jurisdiction of the competent courts of Lagos State, Nigeria, unless applicable law requires otherwise.",
            ]}
          />

          <Section
            icon={FileText}
            title="11. Changes to These Terms"
            content={[
              "We may update these terms when the service, law, or business practices change. We will post the updated version with a new effective date and may provide additional notice for material changes.",
              "Your continued use of FuelIQ NG after the effective date of an updated version means that you accept the revised terms. If you do not agree, you must stop using the service and cancel any active subscription.",
            ]}
          />

          <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-emerald-400">12. Contact Us</h2>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Questions about these Terms of Use can be sent to:
            </p>
            <div className="text-sm text-white">
              <p>Email: legal@fueliq.ng</p>
              <p>FuelIQ NG — Petroleum Market Intelligence Platform</p>
              <p>Lagos, Nigeria</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.06] text-center">
          <div className="flex items-center justify-center gap-4 text-sm text-slate-500 mb-3">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <span aria-hidden="true">•</span>
            <Link href="/terms" className="text-emerald-400">Terms of Use</Link>
          </div>
          <p className="text-sm text-slate-600">&copy; 2026 FuelIQ NG. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  content,
}: {
  icon: typeof FileText;
  title: string;
  content: string[];
}) {
  return (
    <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-2">
        {content.map((paragraph) => (
          <p key={paragraph} className="text-sm text-slate-400 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
