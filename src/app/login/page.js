"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";

import {
  Formik,
  Form,
  Field,
  ErrorMessage,
} from "formik";

import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/services/firebase";
import * as Yup from "yup";

const loginSchema = Yup.object({
  youthId: Yup.string()
    .trim()
    .required(
      "Youth Initiative ID is required."
    )
    .min(
      6,
      "Youth Initiative ID must contain at least 6 characters."
    )
    .max(
      20,
      "Youth Initiative ID cannot exceed 20 characters."
    )
    .matches(
      /^[A-Za-z0-9-]+$/,
      "Youth Initiative ID can only contain letters, numbers and hyphens."
    ),
  password: Yup.string()
    .required("Password is required.")
    .min(
      10,
      "Password must contain at least 10 characters."
    )
    .max(
      64,
      "Password cannot exceed 64 characters."
    ),
});

export default function LoginPage() {
  const router = useRouter();

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    loginError,
    setLoginError,
  ] = useState("");

  const handleLogin = async (
    values,
    formikHelpers
  ) => {
    const {
      setSubmitting,
    } = formikHelpers;

    try {
      setLoginError("");

      const cleanedYouthId =
        values.youthId
          .trim()
          .toLowerCase();

      const internalEmail =
        `${cleanedYouthId}@youthinitiative.local`;

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          internalEmail,
          values.password
        );

      const studentSnapshot =
        await getDoc(
          doc(
            db,
            "students",
            userCredential.user.uid
          )
        );

      /*
        Authentication alone is not enough.

        The student record must also exist
        and be a valid active student account.
      */

      if (!studentSnapshot.exists()) {
        await signOut(auth);

        throw new Error(
          "invalid-student-record"
        );
      }

      const studentData =
        studentSnapshot.data();

      const youthIdMatches =
        typeof studentData.youthId ===
          "string" &&
        studentData.youthId
          .toLowerCase() ===
          cleanedYouthId;

      const uidMatches =
        studentData.firebaseUid ===
        userCredential.user.uid;

      const accountIsActive =
        studentData.accountStatus ===
        "active";

      const studentRoleIsValid =
        studentData.role ===
        "student";

      const parentalConsentIsValid =
        studentData
          .requiresParentalConsent !==
          true ||
        studentData.consentStatus ===
          "approved";

      if (
        !youthIdMatches ||
        !uidMatches ||
        !accountIsActive ||
        !studentRoleIsValid ||
        !parentalConsentIsValid
      ) {
        await signOut(auth);

        throw new Error(
          "invalid-account-state"
        );
      }

      if (
        !studentData.onboardingCompleted
      ) {
        router.replace(
          "/learning-preference"
        );

        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      /*
        Keep this generic.

        Do not tell someone whether the
        Youth ID, password or account status
        was the part that failed.
      */

      setLoginError(
        "Invalid Youth Initiative ID or password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="login-page-shell">
        <div className="login-mobile-panel">
          <header className="auth-header">
            <button
              type="button"
              className="auth-back-button"
              aria-label="Return to the previous page"
              onClick={() =>
                router.back()
              }
            >
              <ArrowLeft
                size={29}
                strokeWidth={2.4}
              />
            </button>

            <Link
              href="/"
              className="auth-logo-link"
            >
              <Image
                src="/images/landing/sait-logo.jpg"
                alt="Southern Alberta Institute of Technology"
                width={250}
                height={80}
                className="auth-logo-image"
                priority
              />
            </Link>
          </header>

          <div className="login-content">
            <div className="auth-heading">
              <h1>Login</h1>

              <p>
                Enter your information to access
                your account.
              </p>
            </div>

            <Formik
              initialValues={{
                youthId: "",
                password: "",
              }}
              validationSchema={
                loginSchema
              }
              validateOnBlur
              validateOnChange
              onSubmit={
                handleLogin
              }
            >
              {({
                errors,
                touched,
                isSubmitting,
                setFieldValue,
              }) => (
                <Form
                  className="login-form"
                  noValidate
                >
                  <div className="login-form-fields">
                    <div className="auth-form-group">
                      <label
                        htmlFor="youthId"
                        className="auth-form-label"
                      >
                        Youth Initiative ID
                      </label>

                      <Field
                        id="youthId"
                        name="youthId"
                        type="text"
                        autoComplete="username"
                        inputMode="text"
                        placeholder=""
                        maxLength={20}
                        className={`auth-form-input ${
                          errors.youthId &&
                          touched.youthId
                            ? "auth-input-error"
                            : ""
                        }`}
                        onChange={(
                          event
                        ) => {
                          const cleanedValue =
                            event.target.value
                              .replace(
                                /\s/g,
                                ""
                              )
                              .toUpperCase();

                          setFieldValue(
                            "youthId",
                            cleanedValue
                          );
                        }}
                      />

                      <ErrorMessage
                        name="youthId"
                        component="p"
                        className="auth-error-message"
                      />
                    </div>

                    <div className="auth-form-group">
                      <label
                        htmlFor="password"
                        className="auth-form-label"
                      >
                        Password
                      </label>

                      <div
                        className={`auth-password-wrapper ${
                          errors.password &&
                          touched.password
                            ? "auth-input-error"
                            : ""
                        }`}
                      >
                        <Field
                          id="password"
                          name="password"
                          type={
                            showPassword
                              ? "text"
                              : "password"
                          }
                          autoComplete="current-password"
                          maxLength={64}
                          className="auth-password-input"
                        />

                        <button
                          type="button"
                          className="password-visibility-button"
                          aria-label={
                            showPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          onClick={() =>
                            setShowPassword(
                              (
                                currentValue
                              ) =>
                                !currentValue
                            )
                          }
                        >
                          {showPassword ? (
                            <EyeOff
                              size={25}
                              strokeWidth={
                                2.4
                              }
                            />
                          ) : (
                            <Eye
                              size={25}
                              strokeWidth={
                                2.4
                              }
                            />
                          )}
                        </button>
                      </div>

                      <ErrorMessage
                        name="password"
                        component="p"
                        className="auth-error-message"
                      />
                    </div>

                    {loginError && (
                      <div
                        className="login-server-error"
                        role="alert"
                      >
                        {
                          loginError
                        }
                      </div>
                    )}
                  </div>

                  <div className="login-actions">
                    <button
                      type="submit"
                      className="login-submit-button"
                      disabled={
                        isSubmitting
                      }
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle
                            size={20}
                            className="button-spinner"
                          />

                          Logging in...
                        </>
                      ) : (
                        "Login"
                      )}
                    </button>

                    <p className="forgot-password-text">
                      Forgot Password?{" "}
                      <Link href="/forgot-password">
                        Click here
                      </Link>
                    </p>

                    <p className="forgot-password-text">
                      Forgot Youth Initiative ID?{" "}
                      <Link href="/forgot-youth-id">
                        Click here
                      </Link>
                    </p>

                    <p className="create-account-text">
                      Don&apos;t have an
                      account?{" "}
                      <Link href="/register">
                        Create Account
                      </Link>
                    </p>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>

        <aside className="login-desktop-panel">
          <div className="login-desktop-overlay" />

          <div className="login-desktop-content">
            <span className="login-desktop-label">
              SAIT Youth Initiative
            </span>

            <h2>
              Your learning journey starts
              here.
            </h2>

            <p>
              Explore workshops, build
              meaningful skills, earn
              achievements and discover future
              SAIT pathways.
            </p>

            <div className="login-feature-list">
              <div>
                <span>01</span>
                Personalized workshop
                recommendations
              </div>

              <div>
                <span>02</span>
                Track progress, XP and badges
              </div>

              <div>
                <span>03</span>
                Discover future education
                pathways
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}