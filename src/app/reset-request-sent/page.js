import Link from "next/link";

import {
  CheckCircle2,
  Mail,
} from "lucide-react";

export default function ResetRequestSentPage() {
  return (
    <main className="password-flow-page">
      <section className="password-flow-card password-sent-card">
        <div className="password-email-icon">
          <Mail size={36} />
        </div>

        <CheckCircle2
          size={25}
          className="password-small-check"
        />

        <span className="password-flow-label">
          REQUEST RECEIVED
        </span>

        <h1>
          Check your email
        </h1>

        <p>
          If the Youth Initiative ID is valid
          and eligible for password recovery,
          a secure recovery email will be sent
          to the appropriate registered email
          address.
        </p>

        <div className="password-security-note">
          Recovery links expire in 30 minutes.
          Check your inbox and spam folder
          before requesting another link.
        </div>

        <Link
          href="/login"
          className="password-login-link"
        >
          Return to Login
        </Link>
      </section>
    </main>
  );
}