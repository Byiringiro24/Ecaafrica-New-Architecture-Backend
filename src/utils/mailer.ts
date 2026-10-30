import nodemailer from "nodemailer";
import { env } from "../configs/env";
import { logger } from "./logger";
import {
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
  buildTeacherOnboardingEmailHtml,
  buildTeacherOnboardingEmailText,
  buildSchoolWelcomeEmailHtml,
  buildSchoolWelcomeEmailText,
  buildSchoolSuspensionEmailHtml,
  buildSchoolSuspensionEmailText,
  passwordResetEmailSubject,
  schoolWelcomeEmailSubject
} from "./emailTemplates/schoolWelcomeEmail";

const hasSmtpConfig = Boolean(
  env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM
);

const createTransport = () => {
  if (!hasSmtpConfig) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
};

const transport = createTransport();

const baseAppUrl = (env.APP_BASE_URL ?? "https://ecareafrica.net").replace(/\/+$/, "");

const requireSmtp = () => {
  if (!transport || !env.SMTP_FROM) {
    logger.warn("SMTP is not configured; email functions will be no-ops");
    return null;
  }

  return transport;
};

export const buildResetUrl = (token?: string) => {
  if (!token) {
    return `${baseAppUrl}/reset-password`;
  }

  return `${baseAppUrl}/reset-password?token=${encodeURIComponent(token)}`;
};

export const sendPasswordResetEmail = async (
  to: string,
  token: string,
  recipientName?: string
) => {
  const currentTransport = requireSmtp();
  if (!currentTransport) {
    logger.warn({ to }, "Skipping sendPasswordResetEmail; SMTP not configured");
    return;
  }
  const resetUrl = buildResetUrl(token);
  const subject = passwordResetEmailSubject;
  const text = buildPasswordResetEmailText({
    recipientEmail: to,
    recipientName: recipientName ?? to,
    resetUrl
  });
  const html = buildPasswordResetEmailHtml({
    recipientEmail: to,
    recipientName: recipientName ?? to,
    resetUrl
  });

  try {
    await currentTransport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text,
      html
    });
  } catch (error) {
    logger.error({ err: error, to }, "Failed to send reset email");
    throw error;
  }
};

export const sendStaffOnboardingEmail = async (
  to: string,
  recipientName: string,
  token?: string
) => {
  const currentTransport = requireSmtp();
  if (!currentTransport) {
    logger.warn({ to }, "Skipping sendStaffOnboardingEmail; SMTP not configured");
    return;
  }
  const passwordSetupUrl = buildResetUrl(token);
  const emailContent = {
    recipientEmail: to,
    recipientName,
    forgotPasswordUrl: passwordSetupUrl
  };
  const text = buildTeacherOnboardingEmailText(emailContent);
  const html = buildTeacherOnboardingEmailHtml(emailContent);

  try {
    await currentTransport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: "Set up your staff account password",
      text,
      html
    });
  } catch (error) {
    logger.error({ err: error, to }, "Failed to send staff onboarding email");
    throw error;
  }
};

// Backwards-compatible alias: some tests and callers expect
// `sendTeacherOnboardingEmail` while the implementation was
// named `sendStaffOnboardingEmail`.
export const sendTeacherOnboardingEmail = sendStaffOnboardingEmail;

export const sendSchoolSuspensionEmail = async (to: string, schoolName?: string) => {
  const currentTransport = requireSmtp();
  if (!currentTransport) {
    logger.warn({ to, schoolName }, "Skipping sendSchoolSuspensionEmail; SMTP not configured");
    return;
  }
  const subject = "School account suspended";
  const text = buildSchoolSuspensionEmailText({ recipientEmail: to, schoolName });
  const html = buildSchoolSuspensionEmailHtml({ recipientEmail: to, schoolName });

  try {
    await currentTransport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text,
      html
    });
  } catch (error) {
    logger.error({ err: error, to }, "Failed to send school suspension email");
    throw error;
  }
};

export const sendSchoolWelcomeEmail = async (
  to: string,
  schoolName?: string,
  resetUrl?: string
) => {
  const currentTransport = requireSmtp();
  if (!currentTransport) {
    logger.warn({ to, schoolName }, "Skipping sendSchoolWelcomeEmail; SMTP not configured");
    return;
  }
  const subject = schoolWelcomeEmailSubject;
  const forgotUrl = `${baseAppUrl}/forgot-password`;
  const passwordUrl = resetUrl ?? buildResetUrl();
  const hasResetToken = Boolean(resetUrl);
  const emailContent = {
    recipientEmail: to,
    schoolName,
    passwordUrl,
    hasResetToken,
    forgotPasswordUrl: forgotUrl
  };
  const text = buildSchoolWelcomeEmailText(emailContent);
  const html = buildSchoolWelcomeEmailHtml(emailContent);

  try {
    await currentTransport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text,
      html
    });
  } catch (error) {
    logger.error({ err: error, to }, "Failed to send welcome email");
    throw error;
  }
};
