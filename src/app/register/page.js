"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";

import {
  ErrorMessage,
  Field,
  Form,
  Formik,
} from "formik";

import {
  calculateAge,
  registrationSchema,
} from "@/validations/registrationSchema";

const initialValues = {
  firstName: "",
  lastName: "",
  email: "",
  dateOfBirth: "",
  parentEmail: "",
};

function normalizeName(value) {
  return value
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, "")
    .replace(/\s{2,}/g, " ");
}

export default function RegisterPage() {
  const router = useRouter();

  const [registrationError, setRegistrationError] =
    useState("");

  const handleRegistration = async (
    values,
    formikHelpers
  ) => {
    const {
      setSubmitting,
      setErrors,
    } = formikHelpers;

    try {
      setRegistrationError("");

      const requestBody = {
        firstName: values.firstName
          .trim()
          .replace(/\s+/g, " "),

        lastName: values.lastName
          .trim()
          .replace(/\s+/g, " "),

        email: values.email.trim().toLowerCase(),

        dateOfBirth: values.dateOfBirth,

        parentEmail: values.parentEmail
          ? values.parentEmail.trim().toLowerCase()
          : "",
      };

      const response = await fetch("/api/register", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (responseData.fieldErrors) {
          setErrors(responseData.fieldErrors);
        }

        throw new Error(
          responseData.message ||
            "Registration could not be completed."
        );
      }

      sessionStorage.setItem(
        "pendingRegistration",
        JSON.stringify({
          registrationId:
            responseData.registrationId,

          email:
            responseData.email,

          firstName:
            responseData.firstName,

          parentEmailMasked:
            responseData.parentEmailMasked ||
            null,

          resendToken:
            responseData.resendToken ||
            null,

          emailSent:
            responseData.emailSent ??
            true,
        })
      );

      if (
        responseData.nextStep === "set_password" &&
        responseData.setupToken
      ) {
        router.push(
          `/set-password/${encodeURIComponent(
            responseData.registrationId
          )}?token=${encodeURIComponent(
            responseData.setupToken
          )}`
        );

        return;
      }

      router.push(
        `/consent-pending?registrationId=${encodeURIComponent(
          responseData.registrationId
        )}`
      );
    } catch (error) {
      console.error("Registration error:", error);

      setRegistrationError(
        error.message ||
          "We could not complete your registration. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="register-page">
      <section className="register-page-shell">
        <div className="register-form-panel">
          <header className="auth-header">
            <button
              type="button"
              className="auth-back-button"
              aria-label="Return to the previous page"
              onClick={() => router.back()}
            >
              <ArrowLeft
                size={29}
                strokeWidth={2.4}
              />
            </button>

            <Link href="/" className="auth-logo-link">
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

          <div className="register-content">
            <div className="auth-heading">
              <h1>Create Your Account</h1>

              <p>
                Enter your information to get started.
              </p>
            </div>

            <Formik
              initialValues={initialValues}
              validationSchema={registrationSchema}
              validateOnBlur
              validateOnChange
              onSubmit={handleRegistration}
            >
              {({
                values,
                errors,
                touched,
                isSubmitting,
                setFieldValue,
              }) => {
                const studentAge =
                  calculateAge(values.dateOfBirth);

                const requiresParentalConsent =
                  studentAge !== null &&
                  studentAge < 18;

                return (
                  <Form
                    className="register-form"
                    noValidate
                  >
                    <div className="register-fields">
                      <div className="auth-form-group">
                        <label
                          htmlFor="firstName"
                          className="auth-form-label"
                        >
                          First Name
                        </label>

                        <Field
                          id="firstName"
                          name="firstName"
                          type="text"
                          autoComplete="given-name"
                          maxLength={40}
                          placeholder="Enter your first name"
                          className={`auth-form-input ${
                            errors.firstName &&
                            touched.firstName
                              ? "auth-input-error"
                              : ""
                          }`}
                          onChange={(event) => {
                            setFieldValue(
                              "firstName",
                              normalizeName(
                                event.target.value
                              )
                            );
                          }}
                        />

                        <ErrorMessage
                          name="firstName"
                          component="p"
                          className="auth-error-message"
                        />
                      </div>

                      <div className="auth-form-group">
                        <label
                          htmlFor="lastName"
                          className="auth-form-label"
                        >
                          Last Name
                        </label>

                        <Field
                          id="lastName"
                          name="lastName"
                          type="text"
                          autoComplete="family-name"
                          maxLength={40}
                          placeholder="Enter your last name"
                          className={`auth-form-input ${
                            errors.lastName &&
                            touched.lastName
                              ? "auth-input-error"
                              : ""
                          }`}
                          onChange={(event) => {
                            setFieldValue(
                              "lastName",
                              normalizeName(
                                event.target.value
                              )
                            );
                          }}
                        />

                        <ErrorMessage
                          name="lastName"
                          component="p"
                          className="auth-error-message"
                        />
                      </div>

                      <div className="auth-form-group">
                        <label
                          htmlFor="email"
                          className="auth-form-label"
                        >
                          Email Address
                        </label>

                        <Field
                          id="email"
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          maxLength={254}
                          placeholder="name@example.com"
                          className={`auth-form-input ${
                            errors.email &&
                            touched.email
                              ? "auth-input-error"
                              : ""
                          }`}
                          onChange={(event) => {
                            setFieldValue(
                              "email",
                              event.target.value
                                .replace(/\s/g, "")
                                .toLowerCase()
                            );
                          }}
                        />

                        <ErrorMessage
                          name="email"
                          component="p"
                          className="auth-error-message"
                        />
                      </div>

                      <div className="auth-form-group">
                        <label
                          htmlFor="dateOfBirth"
                          className="auth-form-label"
                        >
                          Date of Birth
                        </label>

                        <div
                          className={`auth-date-wrapper ${
                            errors.dateOfBirth &&
                            touched.dateOfBirth
                              ? "auth-input-error"
                              : ""
                          }`}
                        >
                          <Field
                            id="dateOfBirth"
                            name="dateOfBirth"
                            type="date"
                            autoComplete="bday"
                            className="auth-date-input"
                          />
                        </div>

                        <ErrorMessage
                          name="dateOfBirth"
                          component="p"
                          className="auth-error-message"
                        />
                      </div>

                      {requiresParentalConsent && (
                        <div className="auth-form-group">
                          <label
                            htmlFor="parentEmail"
                            className="auth-form-label"
                          >
                            Parent / Guardian Email
                          </label>

                          <Field
                            id="parentEmail"
                            name="parentEmail"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            maxLength={254}
                            placeholder="parent@example.com"
                            className={`auth-form-input ${
                              errors.parentEmail &&
                              touched.parentEmail
                                ? "auth-input-error"
                                : ""
                            }`}
                            onChange={(event) => {
                              setFieldValue(
                                "parentEmail",
                                event.target.value
                                  .replace(/\s/g, "")
                                  .toLowerCase()
                              );
                            }}
                          />

                          <ErrorMessage
                            name="parentEmail"
                            component="p"
                            className="auth-error-message"
                          />
                        </div>
                      )}

                      {registrationError && (
                        <div
                          className="registration-server-error"
                          role="alert"
                        >
                          {registrationError}
                        </div>
                      )}
                    </div>

                    <div className="register-actions">
                      <button
                        type="submit"
                        className="register-submit-button"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <LoaderCircle
                              size={20}
                              className="button-spinner"
                            />

                            Creating Account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </button>

                      <p className="register-login-text">
                        Already have an account?{" "}
                        <Link href="/login">
                          Login
                        </Link>
                      </p>
                    </div>
                  </Form>
                );
              }}
            </Formik>
          </div>
        </div>

        <aside className="register-information-panel">
          <div className="register-information-overlay" />

          <div className="register-information-content">
            <span className="register-information-label">
              SAIT Youth Initiative
            </span>

            <h2>
              Your journey starts with one simple step.
            </h2>

            <p>
              Create your student profile, complete the
              parent-supported setup and begin exploring
              learning opportunities.
            </p>

            <div className="registration-process-list">
              <div>
                <span>
                  <Mail size={20} />
                </span>

                <div>
                  <strong>
                    Consent email
                  </strong>

                  <p>
                    We send a secure consent link to the
                    email entered.
                  </p>
                </div>
              </div>

              <div>
                <span>
                  <ShieldCheck size={20} />
                </span>

                <div>
                  <strong>
                    Parent-supported setup
                  </strong>

                  <p>
                    A parent or guardian approves consent
                    and creates the password.
                  </p>
                </div>
              </div>

              <div>
                <span>
                  <CheckCircle2 size={20} />
                </span>

                <div>
                  <strong>
                    Account activated
                  </strong>

                  <p>
                    The student receives their unique Youth
                    Initiative ID.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}