"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  LoaderCircle,
  QrCode,
} from "lucide-react";

import {
  Html5Qrcode,
} from "html5-qrcode";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  studentFetch,
} from "@/services/studentApi";

export default function ScanAttendancePage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const scannerReference =
    useRef(null);

  const [scanning, setScanning] =
    useState(false);

  const [verifying, setVerifying] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

    useEffect(() => {
      return () => {
        const scanner = scannerReference.current;

        if (scanner && scanner.isScanning) {
          scanner.stop().catch(() => {});
        }
      };
    }, []);

  async function verifyQr(qrText) {
    try {
      setVerifying(true);
      setErrorMessage("");

      const qrData =
        JSON.parse(qrText);

      if (
        !qrData.attendanceSessionId ||
        !qrData.code
      ) {
        throw new Error(
          "This QR code is not a valid workshop attendance code."
        );
      }

      const response =
        await studentFetch(
          "/api/attendance/verify",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                qrData
              ),
          },
          {
            limitedUse: true,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message
        );
      }

      sessionStorage.setItem(
        "latestReward",
        JSON.stringify({
          workshop:
            data.workshop,

          reward:
            data.reward,
        })
      );

      router.push(
        "/reward"
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
          "QR code could not be verified."
      );

      setVerifying(false);
    }
  }

  async function startScanner() {
    try {
      setErrorMessage("");

      const scanner =
        new Html5Qrcode(
          "attendance-reader"
        );

      scannerReference.current =
        scanner;

      setScanning(true);

      await scanner.start(
        {
          facingMode:
            "environment",
        },
        {
          fps: 10,
          qrbox: {
            width: 240,
            height: 240,
          },
        },
        async (decodedText) => {
          if (scanner.isScanning) {
            await scanner.stop();
          }

          setScanning(false);

          verifyQr(
            decodedText
          );
        },
        () => {}
      );
    } catch (error) {
      console.error(
        "Scanner error:",
        error
      );

      setScanning(false);

      setErrorMessage(
        "Camera could not be started. Please allow camera permission."
      );
    }
  }

  if (
    !authLoading &&
    !user
  ) {
    return (
      <main className="attendance-login-required">
        <h1>
          Login Required
        </h1>

        <Link href="/login">
          Login
        </Link>
      </main>
    );
  }

  return (
    <main className="scan-attendance-page">
      <section className="scan-attendance-card">
        <div className="scan-heading">
          <QrCode size={38} />

          <span>
            WORKSHOP ATTENDANCE
          </span>

          <h1>
            Scan Attendance Code
          </h1>

          <p>
            Scan the QR code provided by
            the workshop instructor.
          </p>
        </div>

        <div
          id="attendance-reader"
          className="attendance-camera"
        >
          
        </div>

        {errorMessage && (
          <div className="attendance-error">
            {errorMessage}
          </div>
        )}

        {verifying ? (
          <button
            disabled
            className="attendance-scan-button"
          >
            <LoaderCircle
              size={20}
              className="button-spinner"
            />

            Verifying Attendance...
          </button>
        ) : (
          <button
            type="button"
            className="attendance-scan-button"
            disabled={
              scanning ||
              authLoading
            }
            onClick={
              startScanner
            }
          >
            <Camera size={20} />

            {scanning
              ? "Scanning..."
              : "Open Camera"}
          </button>
        )}

        <Link
          href="/registered-workshops"
          className="attendance-back-link"
        >
          Back to Upcoming Workshops
        </Link>
      </section>
    </main>
  );
}