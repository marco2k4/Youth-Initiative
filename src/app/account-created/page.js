"use client";

import Image from "next/image";
import Link from "next/link";

import {
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  CheckCircle2,
  Copy,
} from "lucide-react";

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export default function AccountCreatedPage() {
  const isClient =
    useSyncExternalStore(
      subscribe,
      getClientSnapshot,
      getServerSnapshot
    );

  const [copied, setCopied] =
    useState(false);

  const account =
    useMemo(() => {
      if (!isClient) {
        return null;
      }

      const savedAccount =
        window.sessionStorage.getItem(
          "createdAccount"
        );

      if (!savedAccount) {
        return null;
      }

      try {
        return JSON.parse(
          savedAccount
        );
      } catch {
        return null;
      }
    }, [isClient]);

  const youthId =
    account?.youthId ||
    "Youth ID unavailable";

  const copyYouthId =
    async () => {
      if (!account?.youthId) {
        return;
      }

      await navigator.clipboard.writeText(
        account.youthId
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1800);
    };

  return (
    <main className="account-created-page">
      <section className="account-created-card">
        <Image
          src="/images/landing/sait-logo.jpg"
          alt="Southern Alberta Institute of Technology"
          width={245}
          height={80}
          className="account-created-logo"
          priority
        />

        <div className="account-success-icon">
          <CheckCircle2
            size={56}
          />
        </div>

        <h1>
          Account Created Successfully!
        </h1>

        <p>
          The student account is now active.
          Use the Youth Initiative ID below
          with the password that was just
          created.
        </p>

        <div className="youth-id-result">
          <span>
            Youth Initiative ID
          </span>

          <div>
            <strong>
              {youthId}
            </strong>

            <button
              type="button"
              onClick={
                copyYouthId
              }
              disabled={
                !account?.youthId
              }
            >
              <Copy
                size={18}
              />

              {copied
                ? "Copied"
                : "Copy"}
            </button>
          </div>
        </div>

        <div className="account-created-warning">
          Save this ID securely. The student
          needs it every time they log in.
        </div>

        <Link
          href="/login"
          className="account-created-login"
        >
          Return to Login
        </Link>
      </section>
    </main>
  );
}