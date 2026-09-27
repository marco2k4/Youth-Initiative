"use client";

import Image from "next/image";
import Link from "next/link";

import {
  MailCheck,
  ShieldCheck,
} from "lucide-react";

import {
  useMemo,
  useSyncExternalStore,
} from "react";

const STORAGE_KEY =
  "pendingRegistration";

function subscribe() {
  return () => {};
}

function getServerSnapshot() {
  return null;
}

function getClientSnapshot() {
  return sessionStorage.getItem(
    STORAGE_KEY
  );
}

export default function EmailVerificationPendingPage() {
  const savedRegistration =
    useSyncExternalStore(
      subscribe,
      getClientSnapshot,
      getServerSnapshot
    );

  const registration =
    useMemo(() => {
      if (
        !savedRegistration
      ) {
        return null;
      }

      try {
        return JSON.parse(
          savedRegistration
        );
      } catch {
        return null;
      }
    }, [
      savedRegistration,
    ]);

  const firstName =
    registration?.firstName ||
    "";

  const email =
    registration?.email ||
    "";

  return (
    <main className="set-password-page">
      <section className="set-password-card">
        <Image
          src="/images/landing/sait-logo.jpg"
          alt="Southern Alberta Institute of Technology"
          width={245}
          height={80}
          className="set-password-logo"
          priority
        />

        <div className="set-password-icon">
          <MailCheck
            size={36}
          />
        </div>

        <h1>
          Check Your Email
        </h1>

        <p className="set-password-introduction">
          {firstName
            ? `Hi ${firstName}, we sent a verification link to your email address.`
            : "We sent a verification link to your email address."}
        </p>

        {email && (
          <div
            style={{
              margin:
                "18px 0",
              padding:
                "14px 18px",
              background:
                "#f5f6f7",
              borderRadius:
                "8px",
              fontWeight:
                "700",
              wordBreak:
                "break-word",
              textAlign:
                "center",
            }}
          >
            {email}
          </div>
        )}

        <div
          style={{
            display:
              "flex",
            alignItems:
              "flex-start",
            gap:
              "12px",
            margin:
              "22px 0",
            padding:
              "16px",
            border:
              "1px solid #e1e5ea",
            borderRadius:
              "10px",
            textAlign:
              "left",
          }}
        >
          <ShieldCheck
            size={24}
            style={{
              flexShrink:
                0,
              marginTop:
                "2px",
            }}
          />

          <div>
            <strong>
              Verify your email
            </strong>

            <p
              style={{
                margin:
                  "6px 0 0",
                lineHeight:
                  "1.5",
              }}
            >
              Open the email and
              select{" "}
              <strong>
                Verify Email
              </strong>
              . After verification,
              you&apos;ll be taken
              to create your
              password.
            </p>
          </div>
        </div>

        <p
          style={{
            fontSize:
              "14px",
            lineHeight:
              "1.6",
            color:
              "#666",
            marginBottom:
              "22px",
          }}
        >
          The verification link
          expires in 30 minutes.
          Check your spam or junk
          folder if you don&apos;t
          see the email.
        </p>

        <Link
          href="/login"
          className="set-password-submit"
        >
          Return to Login
        </Link>
      </section>
    </main>
  );
}