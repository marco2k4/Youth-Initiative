"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  LoaderCircle,
  QrCode,
} from "lucide-react";

import {
  adminFetch,
} from "@/services/adminApi";

export default function AdminAttendancePage() {
  const [workshops, setWorkshops] =
    useState([]);

  const [workshopId, setWorkshopId] =
    useState("");

  const [duration, setDuration] =
    useState(15);

  const [qrImage, setQrImage] =
    useState("");

  const [expiresAt, setExpiresAt] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    async function loadWorkshops() {
      try {
        const response =
          await adminFetch(
            "/api/admin/workshops"
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Could not load workshops."
          );
        }

        setWorkshops(
          data.workshops || []
        );
      } catch (error) {
        console.error(
          "Load workshops error:",
          error
        );

        setErrorMessage(
          error.message ||
            "Could not load workshops."
        );
      }
    }

    loadWorkshops();
  }, []);

  async function generateQr() {
    try {
      if (!workshopId) {
        setErrorMessage(
          "Please select a workshop."
        );

        return;
      }

      setLoading(true);
      setErrorMessage("");
      setQrImage("");

      const response =
        await adminFetch(
          "/api/admin/attendance",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              workshopId,

              durationMinutes:
                Number(duration),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "QR code could not be generated."
        );
      }

      const qrPayload =
        JSON.stringify({
          attendanceSessionId:
            data.attendanceSessionId,

          code:
            data.code,
        });

      const generatedQrImage =
        await QRCode.toDataURL(
          qrPayload,
          {
            width: 380,
            margin: 2,
          }
        );

      setQrImage(
        generatedQrImage
      );

      setExpiresAt(
        data.expiresAt
      );
    } catch (error) {
      console.error(
        "Generate attendance QR error:",
        error
      );

      setErrorMessage(
        error.message ||
          "QR code could not be generated."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-attendance-page">
      <section className="admin-attendance-card">
        <div className="admin-attendance-heading">
          <QrCode size={42} />

          <span>
            ATTENDANCE MANAGEMENT
          </span>

          <h1>
            Generate Attendance QR
          </h1>

          <p>
            Select a workshop and create a temporary
            QR code for students to mark attendance.
          </p>
        </div>

        {errorMessage && (
          <div className="attendance-error">
            {errorMessage}
          </div>
        )}

        <div className="admin-attendance-form">
          <label>
            Workshop

            <select
              value={workshopId}
              onChange={(event) =>
                setWorkshopId(
                  event.target.value
                )
              }
            >
              <option value="">
                Select workshop
              </option>

              {workshops.map(
                (workshop) => (
                  <option
                    key={
                      workshop.id
                    }
                    value={
                      workshop.id
                    }
                  >
                    {
                      workshop.title
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            QR Valid For

            <select
              value={duration}
              onChange={(event) =>
                setDuration(
                  event.target.value
                )
              }
            >
              <option value="5">
                5 minutes
              </option>

              <option value="10">
                10 minutes
              </option>

              <option value="15">
                15 minutes
              </option>

              <option value="30">
                30 minutes
              </option>
            </select>
          </label>

          <button
            type="button"
            disabled={
              !workshopId ||
              loading
            }
            onClick={
              generateQr
            }
          >
            {loading ? (
              <>
                <LoaderCircle
                  size={19}
                  className="button-spinner"
                />

                Generating QR...
              </>
            ) : (
              <>
                <QrCode
                  size={19}
                />

                Generate QR Code
              </>
            )}
          </button>
        </div>

        {qrImage && (
          <div className="attendance-qr-result">
            <h2>
              Attendance QR Code
            </h2>

            <p>
              Students can now scan this code from
              the attendance scanner.
            </p>

            <img
              src={qrImage}
              alt="Workshop attendance QR code"
            />

            <div className="attendance-qr-active">
              QR Code Active
            </div>

            {expiresAt && (
              <p>
                Expires at{" "}
                <strong>
                  {new Date(
                    expiresAt
                  ).toLocaleTimeString()}
                </strong>
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}