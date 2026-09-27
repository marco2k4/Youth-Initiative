import {
  Resend,
} from "resend";

const resend =
  new Resend(
    process.env.RESEND_API_KEY
  );

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function getEmailFrom() {
  return (
    process.env.EMAIL_FROM ||
    "SAIT Youth Initiative <onboarding@resend.dev>"
  );
}

function getReplyTo() {
  return (
    process.env.EMAIL_REPLY_TO ||
    "youth.programs@sait.ca"
  );
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export async function sendWelcomeEmail({
  firstName,
  email,
  parentEmail,
  youthId,
  requiresParentalConsent,
}) {
  const safeFirstName =
    escapeHtml(
      firstName
    );

  const safeYouthId =
    escapeHtml(
      youthId
    );

  const loginUrl =
    `${getAppUrl()}/login`;

  /*
    Adult students have already
    verified ownership of their
    contact email.

    For minors, the student email
    itself has not been independently
    verified during the parental
    consent flow.

    Because the Youth ID is an
    account credential identifier,
    send the account-created message
    to the approved parent or guardian
    instead of an unverified student
    email.
  */

  const recipientEmail =
    requiresParentalConsent
      ? parentEmail
      : email;

  if (
    typeof recipientEmail !==
      "string" ||
    !recipientEmail.trim()
  ) {
    return {
      success:
        false,

      skipped:
        true,

      error:
        "A welcome email recipient was not available.",
    };
  }

  const subject =
    requiresParentalConsent
      ? "Youth Initiative Account Created"
      : "Welcome to SAIT Youth Initiative";

  const heading =
    requiresParentalConsent
      ? "Account Created Successfully"
      : "Welcome to SAIT Youth Initiative";

  const introduction =
    requiresParentalConsent
      ? `
          <p>
            The SAIT Youth Initiative
            account for
            <strong>
              ${safeFirstName}
            </strong>
            has been created
            successfully.
          </p>
        `
      : `
          <p>
            Hi ${safeFirstName},
          </p>

          <p>
            Welcome to the SAIT Youth
            Initiative. Your account
            has been created
            successfully and is ready
            to use.
          </p>
        `;

  try {
    const emailResult =
      await resend.emails.send(
        {
          from:
            getEmailFrom(),

          to: [
            recipientEmail
              .trim()
              .toLowerCase(),
          ],

          replyTo:
            getReplyTo(),

          subject,

          html: `
            <!doctype html>

            <html lang="en">
              <body
                style="
                  margin:0;
                  padding:30px;
                  background:#f4f5f7;
                  font-family:Arial,Helvetica,sans-serif;
                  color:#222;
                "
              >
                <div
                  style="
                    max-width:620px;
                    margin:auto;
                    background:#ffffff;
                    border-radius:14px;
                    padding:32px;
                    border-top:4px solid #e2232a;
                  "
                >
                  <div
                    style="
                      color:#e2232a;
                      font-size:34px;
                      font-weight:900;
                    "
                  >
                    SAIT
                  </div>

                  <p
                    style="
                      margin-top:4px;
                      color:#555;
                      font-weight:700;
                    "
                  >
                    Youth Initiative
                  </p>

                  <h1>
                    ${heading}
                  </h1>

                  ${introduction}

                  <p>
                    The Youth ID for
                    this account is:
                  </p>

                  <div
                    style="
                      margin:20px 0;
                      padding:18px;
                      background:#f4f5f7;
                      border-radius:10px;
                      text-align:center;
                    "
                  >
                    <div
                      style="
                        color:#666;
                        font-size:13px;
                        font-weight:700;
                        text-transform:uppercase;
                        letter-spacing:0.8px;
                      "
                    >
                      Youth ID
                    </div>

                    <div
                      style="
                        margin-top:7px;
                        font-size:24px;
                        font-weight:900;
                        letter-spacing:1px;
                        color:#222;
                      "
                    >
                      ${safeYouthId}
                    </div>
                  </div>

                  <p>
                    Keep this Youth ID
                    somewhere safe. It
                    will be used to sign
                    in to the Youth
                    Initiative
                    application.
                  </p>

                  <a
                    href="${loginUrl}"
                    style="
                      display:inline-block;
                      margin-top:12px;
                      padding:14px 24px;
                      background:#e2232a;
                      color:#ffffff;
                      text-decoration:none;
                      border-radius:8px;
                      font-weight:700;
                    "
                  >
                    Sign In
                  </a>

                  <p
                    style="
                      margin-top:28px;
                      color:#777;
                      font-size:13px;
                      line-height:1.6;
                    "
                  >
                    For security, your
                    password is never
                    included in this
                    email.
                  </p>

                  <p
                    style="
                      color:#777;
                      font-size:13px;
                      line-height:1.6;
                    "
                  >
                    If you have
                    questions about the
                    Youth Initiative,
                    reply to this email
                    or contact
                    youth.programs@sait.ca.
                  </p>
                </div>
              </body>
            </html>
          `,
        }
      );

    if (
      emailResult.error
    ) {
      return {
        success:
          false,

        skipped:
          false,

        error:
          emailResult
            .error
            .message ||
          "Welcome email could not be sent.",
      };
    }

    return {
      success:
        true,

      skipped:
        false,

      emailId:
        emailResult
          .data
          ?.id ||
        null,
    };
  } catch (
    error
  ) {
    console.error(
      "Welcome email error:",
      error
    );

    return {
      success:
        false,

      skipped:
        false,

      error:
        error?.message ||
        "Welcome email could not be sent.",
    };
  }
}

export async function sendPasswordChangedEmail({
  firstName,
  email,
  parentEmail,
  recoveryMode,
}) {
  /*
    Use the same trusted recipient
    that authorized the password
    recovery flow.

    Adult/student recovery:
      verified student contact email.

    Guardian recovery:
      approved parent or guardian
      email.
  */

  const recipientEmail =
    recoveryMode ===
    "guardian"
      ? parentEmail
      : email;

  if (
    typeof recipientEmail !==
      "string" ||
    !recipientEmail.trim()
  ) {
    return {
      success:
        false,

      skipped:
        true,

      error:
        "A password-change notification recipient was not available.",
    };
  }

  const safeFirstName =
    escapeHtml(
      firstName ||
      "Student"
    );

  const loginUrl =
    `${getAppUrl()}/login`;

  const isGuardianRecovery =
    recoveryMode ===
    "guardian";

  const heading =
    "Password Changed Successfully";

  const introduction =
    isGuardianRecovery
      ? `
          <p>
            The password for
            <strong>
              ${safeFirstName}
            </strong>
            &apos;s SAIT Youth
            Initiative account was
            changed successfully.
          </p>
        `
      : `
          <p>
            Hi ${safeFirstName},
          </p>

          <p>
            The password for your
            SAIT Youth Initiative
            account was changed
            successfully.
          </p>
        `;

  try {
    const emailResult =
      await resend.emails.send(
        {
          from:
            getEmailFrom(),

          to: [
            recipientEmail
              .trim()
              .toLowerCase(),
          ],

          replyTo:
            getReplyTo(),

          subject:
            "Password Changed – SAIT Youth Initiative",

          html: `
            <!doctype html>

            <html lang="en">
              <body
                style="
                  margin:0;
                  padding:30px;
                  background:#f4f5f7;
                  font-family:Arial,Helvetica,sans-serif;
                  color:#222;
                "
              >
                <div
                  style="
                    max-width:620px;
                    margin:auto;
                    background:#ffffff;
                    border-radius:14px;
                    padding:32px;
                    border-top:4px solid #e2232a;
                  "
                >
                  <div
                    style="
                      color:#e2232a;
                      font-size:34px;
                      font-weight:900;
                    "
                  >
                    SAIT
                  </div>

                  <p
                    style="
                      margin-top:4px;
                      color:#555;
                      font-weight:700;
                    "
                  >
                    Youth Initiative
                  </p>

                  <h1>
                    ${heading}
                  </h1>

                  ${introduction}

                  <p>
                    Existing signed-in
                    sessions have been
                    invalidated for
                    security.
                  </p>

                  <p>
                    The new password
                    must be used the
                    next time the
                    account signs in.
                  </p>

                  <a
                    href="${loginUrl}"
                    style="
                      display:inline-block;
                      margin-top:12px;
                      padding:14px 24px;
                      background:#e2232a;
                      color:#ffffff;
                      text-decoration:none;
                      border-radius:8px;
                      font-weight:700;
                    "
                  >
                    Sign In
                  </a>

                  <div
                    style="
                      margin-top:28px;
                      padding:16px;
                      background:#fff4f4;
                      border-radius:10px;
                      line-height:1.6;
                    "
                  >
                    <strong>
                      Didn&apos;t make this change?
                    </strong>

                    <p
                      style="
                        margin:8px 0 0;
                      "
                    >
                      Contact the Youth
                      Initiative team as
                      soon as possible at
                      youth.programs@sait.ca.
                    </p>
                  </div>

                  <p
                    style="
                      margin-top:24px;
                      color:#777;
                      font-size:13px;
                      line-height:1.6;
                    "
                  >
                    For security, your
                    password is never
                    included in this
                    email.
                  </p>
                </div>
              </body>
            </html>
          `,
        }
      );

    if (
      emailResult.error
    ) {
      return {
        success:
          false,

        skipped:
          false,

        error:
          emailResult
            .error
            .message ||
          "Password-change notification could not be sent.",
      };
    }

    return {
      success:
        true,

      skipped:
        false,

      emailId:
        emailResult
          .data
          ?.id ||
        null,
    };
  } catch (
    error
  ) {
    console.error(
      "Password-change notification error:",
      error
    );

    return {
      success:
        false,

      skipped:
        false,

      error:
        error?.message ||
        "Password-change notification could not be sent.",
    };
  }
}