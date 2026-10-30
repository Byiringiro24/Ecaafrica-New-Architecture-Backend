const BRAND_NAME = "Education Care Africa";
const BRAND_TAGLINE = "Smart school management for Africa";
const SCHOOL_SUSPENSION_SUPPORT_EMAIL = "netrackltd@gmail.com";
const SCHOOL_SUSPENSION_SUPPORT_PHONES = ["+250 786 402 913", "+256 773 666 640"];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type EmailDetail = {
  label: string;
  value: string;
  monospace?: boolean;
};

type SharedEmailContent = {
  subject: string;
  bannerTitle: string;
  bannerSubtitle: string;
  greeting: string;
  intro: string;
  detailsTitle: string;
  details: EmailDetail[];
  securityTitle: string;
  securityNotes: string[];
  stepsTitle: string;
  stepsIntro: string;
  steps: string[];
  helpTitle: string;
  helpBody: string;
  actionLabel: string;
  actionUrl: string;
  footerLine: string;
};

const buildTextList = (items: string[], prefix: string) =>
  items.map((item, index) => `${prefix}${index + 1}. ${item}`).join("\n");

const buildDetailsText = (details: EmailDetail[]) =>
  details.map((detail) => `${detail.label}: ${detail.value}`).join("\n");

const buildSharedEmailText = (content: SharedEmailContent) => [
  content.greeting,
  "",
  content.intro,
  "",
  content.detailsTitle,
  buildDetailsText(content.details),
  "",
  content.securityTitle,
  buildTextList(content.securityNotes, "- "),
  "",
  content.stepsTitle,
  content.stepsIntro,
  buildTextList(content.steps, ""),
  "",
  content.helpTitle,
  content.helpBody,
  "",
  `${content.actionLabel}: ${content.actionUrl}`,
  "",
  content.footerLine
].join("\n");

const renderDetailValue = (detail: EmailDetail) => {
  const safeValue = escapeHtml(detail.value);
  if (detail.monospace) {
    if (/^https?:\/\//.test(detail.value)) {
      const safeHref = escapeHtml(detail.value);
      return `<a href="${safeHref}" target="_blank" style="display:inline-block;padding:4px 8px;border-radius:4px;background-color:#eef6fb;font-family:Consolas,Monaco,monospace;font-size:13px;color:#4b5b6b;word-break:break-all;text-decoration:none;">${safeValue}</a>`;
    }

    return `<span style="display:inline-block;padding:4px 8px;border-radius:4px;background-color:#eef6fb;font-family:Consolas,Monaco,monospace;font-size:13px;color:#4b5b6b;word-break:break-all;">${safeValue}</span>`;
  }

  return `<span style="color:#25324a;word-break:break-word;">${safeValue}</span>`;
};

const buildSharedEmailHtml = (content: SharedEmailContent) => {
  const detailsRows = content.details
    .map(
      (detail) => `
          <tr>
            <td style="padding:14px 0;border-top:1px solid #e4edf6;font-size:15px;line-height:1.6;color:#1f2d3d;font-weight:700;width:34%;vertical-align:top;">${escapeHtml(detail.label)}:</td>
            <td style="padding:14px 0;border-top:1px solid #e4edf6;font-size:15px;line-height:1.6;color:#25324a;vertical-align:top;">${renderDetailValue(detail)}</td>
          </tr>`
    )
    .join("");

  const securityNotes = content.securityNotes
    .map((note) => `<li style="margin:0 0 10px;">${escapeHtml(note)}</li>`)
    .join("");

  const steps = content.steps
    .map((step) => `<li style="margin:0 0 10px;">${escapeHtml(step)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f6f8;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f6f8;padding:16px 0;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:700px;background-color:#ffffff;border:1px solid #e7ebf0;border-radius:2px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:36px 24px;background:#77b26f;">
              <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:1.2;letter-spacing:0.01em;text-transform:uppercase;color:#ffffff;font-weight:700;">${escapeHtml(content.bannerTitle)}</h1>
              <p style="margin:12px 0 0;font-size:16px;line-height:1.5;color:rgba(255,255,255,0.92);font-weight:600;">${escapeHtml(content.bannerSubtitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 26px 10px;">
              <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.35;color:#1fa4de;font-weight:700;">${escapeHtml(content.greeting)}</p>
              <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#303a46;">${escapeHtml(content.intro)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 22px;border:2px solid #29aae2;border-radius:10px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 18px 10px;">
                    <p style="margin:0 0 8px;font-size:20px;line-height:1.35;color:#1fa4de;font-weight:700;">${escapeHtml(content.detailsTitle)}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailsRows}</table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;background:#fff6ce;border:1px solid #f2e2a0;border-radius:8px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 10px;font-size:20px;line-height:1.35;color:#8f6e19;font-weight:700;">${escapeHtml(content.securityTitle)}</p>
                    <ul style="margin:0;padding:0 0 0 20px;font-size:15px;line-height:1.7;color:#6f5514;">${securityNotes}</ul>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px;font-size:20px;line-height:1.35;color:#1fa4de;font-weight:700;">${escapeHtml(content.stepsTitle)}</p>
              <p style="margin:0 0 10px;font-size:16px;line-height:1.7;color:#303a46;">${escapeHtml(content.stepsIntro)}</p>
              <ol style="margin:0 0 22px;padding:0 0 0 22px;font-size:16px;line-height:1.7;color:#303a46;">${steps}</ol>
              <p style="margin:0 0 10px;font-size:20px;line-height:1.35;color:#1fa4de;font-weight:700;">${escapeHtml(content.helpTitle)}</p>
              <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#303a46;">${escapeHtml(content.helpBody)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
                <tr>
                  <td align="center" bgcolor="#1fa4de" style="border-radius:6px;background-color:#1fa4de;">
                    <a href="${escapeHtml(content.actionUrl)}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(content.actionLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 26px 28px;border-top:1px solid #e7ebf0;background:#fafafa;">
              <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#6b7682;">${escapeHtml(content.footerLine)}</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7682;">${escapeHtml(BRAND_NAME)} | ${escapeHtml(BRAND_TAGLINE)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export type SchoolWelcomeEmailContent = {
  schoolName?: string;
  recipientEmail: string;
  passwordUrl: string;
  hasResetToken: boolean;
  forgotPasswordUrl: string;
};

export type PasswordResetEmailContent = {
  recipientEmail: string;
  recipientName: string;
  resetUrl: string;
};

export type TeacherOnboardingEmailContent = {
  recipientEmail: string;
  recipientName?: string;
  forgotPasswordUrl: string;
};

export type SchoolSuspensionEmailContent = {
  schoolName?: string;
  recipientEmail: string;
};

export const schoolWelcomeEmailSubject = `Welcome to ${BRAND_NAME}`;
export const passwordResetEmailSubject = "Reset your password";
export const teacherOnboardingEmailSubject = "Your staff account is ready";
export const schoolSuspensionEmailSubject = "School account suspended";

export const buildSchoolWelcomeEmailText = ({
  schoolName,
  recipientEmail,
  passwordUrl,
  hasResetToken,
  forgotPasswordUrl
}: SchoolWelcomeEmailContent) =>
  buildSharedEmailText({
    subject: schoolWelcomeEmailSubject,
    bannerTitle: BRAND_NAME,
    bannerSubtitle: "Welcome to Your Account",
    greeting: `Dear ${schoolName ?? "School Admin"},`,
    intro: "Welcome to your account. Your school account is ready and the details below will help you sign in for the first time.",
    detailsTitle: "Your Account Details",
    details: [
      { label: "School", value: schoolName ?? "New school account" },
      { label: "Username", value: recipientEmail },
      { label: "Password", value: hasResetToken ? "Use the reset link to create a password" : "Request a reset link from the portal" },
      { label: "Reset Link", value: hasResetToken ? passwordUrl : forgotPasswordUrl, monospace: true }
    ],
    securityTitle: "Security Notice",
    securityNotes: [
      "Keep your login credentials confidential and secure.",
      "Do not share your username or password with anyone.",
      "Change your password after your first login.",
      "If you suspect unauthorized access, contact support immediately."
    ],
    stepsTitle: "Getting Started",
    stepsIntro: "To access your account:",
    steps: [
      "Visit the portal login page.",
      hasResetToken ? "Open the password setup link and create a secure password." : "Request a password reset link from the forgot password page.",
      "Sign in with your email address and new password.",
      "Review your dashboard and available school services."
    ],
    helpTitle: "Need Help?",
    helpBody: "If you encounter any issues, reply to this email or contact your school administrator.",
    actionLabel: hasResetToken ? "Set Your Password" : "Forgot Password",
    actionUrl: hasResetToken ? passwordUrl : forgotPasswordUrl,
    footerLine: "This is an automated message. Please do not reply to this email."
  });

export const buildSchoolWelcomeEmailHtml = ({
  schoolName,
  recipientEmail,
  passwordUrl,
  hasResetToken,
  forgotPasswordUrl
}: SchoolWelcomeEmailContent) =>
  buildSharedEmailHtml({
    subject: schoolWelcomeEmailSubject,
    bannerTitle: BRAND_NAME,
    bannerSubtitle: "Welcome to Your Account",
    greeting: `Dear ${schoolName ?? "School Admin"},`,
    intro: "Welcome to your account. Your school account is ready and the details below will help you sign in for the first time.",
    detailsTitle: "Your Account Details",
    details: [
      { label: "School", value: schoolName ?? "New school account" },
      { label: "Username", value: recipientEmail },
      { label: "Password", value: hasResetToken ? "Use the reset link to create a password" : "Request a reset link from the portal" },
      { label: "Reset Link", value: hasResetToken ? passwordUrl : forgotPasswordUrl, monospace: true }
    ],
    securityTitle: "Security Notice",
    securityNotes: [
      "Keep your login credentials confidential and secure.",
      "Do not share your username or password with anyone.",
      "Change your password after your first login.",
      "If you suspect unauthorized access, contact support immediately."
    ],
    stepsTitle: "Getting Started",
    stepsIntro: "To access your account:",
    steps: [
      "Visit the portal login page.",
      hasResetToken ? "Open the password setup link and create a secure password." : "Request a password reset link from the forgot password page.",
      "Sign in with your email address and new password.",
      "Review your dashboard and available school services."
    ],
    helpTitle: "Need Help?",
    helpBody: "If you encounter any issues, reply to this email or contact your school administrator.",
    actionLabel: hasResetToken ? "Set Your Password" : "Forgot Password",
    actionUrl: hasResetToken ? passwordUrl : forgotPasswordUrl,
    footerLine: "This is an automated message. Please do not reply to this email."
  });

export const buildPasswordResetEmailText = ({
  recipientEmail,
  recipientName,
  resetUrl
}: PasswordResetEmailContent) =>
  buildSharedEmailText({
    subject: passwordResetEmailSubject,
    bannerTitle: BRAND_NAME,
    bannerSubtitle: "Password Reset Request",
    greeting: `Hello ${recipientName},`,
    intro: "Your password reset request was received. Use the link below to create a new password.",
    detailsTitle: "Account Details",
    details: [
      { label: "Name", value: recipientName },
      { label: "Username", value: recipientEmail },
      { label: "Reset Link", value: resetUrl, monospace: true }
    ],
    securityTitle: "Security Notice",
    securityNotes: [
      "Keep the reset link private and use it only once.",
      "If you did not request this email, ignore it or contact support.",
      "After resetting, sign in with your new password immediately."
    ],
    stepsTitle: "Getting Started",
    stepsIntro: "Follow these steps to finish the reset:",
    steps: [
      "Open the password reset link.",
      "Create a new secure password.",
      "Return to the portal and sign in with the new password.",
      "If needed, contact your school administrator for help."
    ],
    helpTitle: "Need Help?",
    helpBody: "If you need assistance, reply to this email or contact your school administrator.",
    actionLabel: "Reset Your Password",
    actionUrl: resetUrl,
    footerLine: "This is an automated password reset email."
  });

export const buildPasswordResetEmailHtml = ({
  recipientEmail,
  recipientName,
  resetUrl
}: PasswordResetEmailContent) =>
  buildSharedEmailHtml({
    subject: passwordResetEmailSubject,
    bannerTitle: BRAND_NAME,
    bannerSubtitle: "Password Reset Request",
    greeting: `Hello ${recipientName},`,
    intro: "Your password reset request was received. Use the link below to create a new password.",
    detailsTitle: "Account Details",
    details: [
      { label: "Name", value: recipientName },
      { label: "Username", value: recipientEmail },
      { label: "Reset Link", value: resetUrl, monospace: true }
    ],
    securityTitle: "Security Notice",
    securityNotes: [
      "Keep the reset link private and use it only once.",
      "If you did not request this email, ignore it or contact support.",
      "After resetting, sign in with your new password immediately."
    ],
    stepsTitle: "Getting Started",
    stepsIntro: "Follow these steps to finish the reset:",
    steps: [
      "Open the password reset link.",
      "Create a new secure password.",
      "Return to the portal and sign in with the new password.",
      "If needed, contact your school administrator for help."
    ],
    helpTitle: "Need Help?",
    helpBody: "If you need assistance, reply to this email or contact your school administrator.",
    actionLabel: "Reset Your Password",
    actionUrl: resetUrl,
    footerLine: "This is an automated password reset email."
  });

export const buildTeacherOnboardingEmailText = ({ recipientEmail, recipientName, forgotPasswordUrl }: TeacherOnboardingEmailContent) =>
  buildSharedEmailText({
    subject: teacherOnboardingEmailSubject,
    bannerTitle: BRAND_NAME,
    bannerSubtitle: "Staff Account Ready",
    greeting: `Hello ${recipientName ?? recipientEmail},`,
    intro: "Your staff account has been created. Use the link below to set up your password before signing in.",
    detailsTitle: "Account Details",
    details: [
      { label: "Name", value: recipientName ?? recipientEmail },
      { label: "Username", value: recipientEmail },
      { label: "Password Setup Link", value: forgotPasswordUrl, monospace: true }
    ],
    securityTitle: "Security Notice",
    securityNotes: [
      "Keep your password setup link private and do not share it with others.",
      "Sign in only from trusted devices.",
      "Create a strong new password and keep it confidential.",
      "If you did not expect this message, contact your school administrator."
    ],
    stepsTitle: "Getting Started",
    stepsIntro: "To access your staff account:",
    steps: [
      "Open the password setup link in this email.",
      "Create a new secure password.",
      "Sign in with your email address and new password.",
      "Contact your school administrator if you need help."
    ],
    helpTitle: "Need Help?",
    helpBody: "If you encounter any issues, reply to this email or contact your school administrator.",
    actionLabel: "Set Up Your Password",
    actionUrl: forgotPasswordUrl,
    footerLine: "This is an automated message. Please do not reply to this email."
  });

export const buildTeacherOnboardingEmailHtml = ({ recipientEmail, recipientName, forgotPasswordUrl }: TeacherOnboardingEmailContent) =>
  buildSharedEmailHtml({
    subject: teacherOnboardingEmailSubject,
    bannerTitle: BRAND_NAME,
    bannerSubtitle: "Staff Account Ready",
    greeting: `Hello ${recipientName ?? recipientEmail},`,
    intro: "Your staff account has been created. Use the link below to set up your password before signing in.",
    detailsTitle: "Account Details",
    details: [
      { label: "Name", value: recipientName ?? recipientEmail },
      { label: "Username", value: recipientEmail },
      { label: "Password Setup Link", value: forgotPasswordUrl, monospace: true }
    ],
    securityTitle: "Security Notice",
    securityNotes: [
      "Keep your password setup link private and do not share it with others.",
      "Sign in only from trusted devices.",
      "Create a strong new password and keep it confidential.",
      "If you did not expect this message, contact your school administrator."
    ],
    stepsTitle: "Getting Started",
    stepsIntro: "To access your staff account:",
    steps: [
      "Open the password setup link in this email.",
      "Create a new secure password.",
      "Sign in with your email address and new password.",
      "Contact your school administrator if you need help."
    ],
    helpTitle: "Need Help?",
    helpBody: "If you encounter any issues, reply to this email or contact your school administrator.",
    actionLabel: "Set Up Your Password",
    actionUrl: forgotPasswordUrl,
    footerLine: "This is an automated message. Please do not reply to this email."
  });

export const buildSchoolSuspensionEmailText = ({ schoolName, recipientEmail }: SchoolSuspensionEmailContent) =>
  buildSharedEmailText({
    subject: schoolSuspensionEmailSubject,
    bannerTitle: "Access Suspended",
    bannerSubtitle: "School login disabled",
    greeting: `Dear ${schoolName ?? "School Administrator"},`,
    intro: "Your school account has been suspended. School users will not be able to sign in until the account is reactivated.",
    detailsTitle: "Account Details",
    details: [
      { label: "School", value: schoolName ?? "School account" },
      { label: "Recipient", value: recipientEmail },
      { label: "Activation email", value: SCHOOL_SUSPENSION_SUPPORT_EMAIL },
      { label: "Support phone 1", value: SCHOOL_SUSPENSION_SUPPORT_PHONES[0] },
      { label: "Support phone 2", value: SCHOOL_SUSPENSION_SUPPORT_PHONES[1] }
    ],
    securityTitle: "What this means",
    securityNotes: [
      "School login is currently disabled.",
      "Check this email for the activation contact details.",
      "If you believe this is an error, contact the system administrator immediately."
    ],
    stepsTitle: "Next Steps",
    stepsIntro: "To restore access:",
    steps: [
      "Review the suspension notice and any admin instructions.",
      `Email ${SCHOOL_SUSPENSION_SUPPORT_EMAIL} for activation support.`,
      `Call ${SCHOOL_SUSPENSION_SUPPORT_PHONES.join(" or ")} if you need urgent help.`,
      "Wait for confirmation before attempting to sign in again."
    ],
    helpTitle: "Need Help?",
    helpBody: `For activation support, contact ${SCHOOL_SUSPENSION_SUPPORT_EMAIL} or call ${SCHOOL_SUSPENSION_SUPPORT_PHONES.join(" / ")}.`,
    actionLabel: "Contact System Administrator",
    actionUrl: `mailto:${SCHOOL_SUSPENSION_SUPPORT_EMAIL}`,
    footerLine: "This is an automated message. Please do not reply to this email."
  });

export const buildSchoolSuspensionEmailHtml = ({ schoolName, recipientEmail }: SchoolSuspensionEmailContent) =>
  buildSharedEmailHtml({
    subject: schoolSuspensionEmailSubject,
    bannerTitle: "Access Suspended",
    bannerSubtitle: "School login disabled",
    greeting: `Dear ${schoolName ?? "School Administrator"},`,
    intro: "Your school account has been suspended. School users will not be able to sign in until the account is reactivated.",
    detailsTitle: "Account Details",
    details: [
      { label: "School", value: schoolName ?? "School account" },
      { label: "Recipient", value: recipientEmail },
      { label: "Activation email", value: SCHOOL_SUSPENSION_SUPPORT_EMAIL },
      { label: "Support phone 1", value: SCHOOL_SUSPENSION_SUPPORT_PHONES[0] },
      { label: "Support phone 2", value: SCHOOL_SUSPENSION_SUPPORT_PHONES[1] }
    ],
    securityTitle: "What this means",
    securityNotes: [
      "School login is currently disabled.",
      "Check this email for the activation contact details.",
      "If you believe this is an error, contact the system administrator immediately."
    ],
    stepsTitle: "Next Steps",
    stepsIntro: "To restore access:",
    steps: [
      "Review the suspension notice and any admin instructions.",
      `Email ${SCHOOL_SUSPENSION_SUPPORT_EMAIL} for activation support.`,
      `Call ${SCHOOL_SUSPENSION_SUPPORT_PHONES.join(" or ")} if you need urgent help.`,
      "Wait for confirmation before attempting to sign in again."
    ],
    helpTitle: "Need Help?",
    helpBody: `For activation support, contact ${SCHOOL_SUSPENSION_SUPPORT_EMAIL} or call ${SCHOOL_SUSPENSION_SUPPORT_PHONES.join(" / ")}.`,
    actionLabel: "Contact System Administrator",
    actionUrl: `mailto:${SCHOOL_SUSPENSION_SUPPORT_EMAIL}`,
    footerLine: "This is an automated message. Please do not reply to this email."
  });
