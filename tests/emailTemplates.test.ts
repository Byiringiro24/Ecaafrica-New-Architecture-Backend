import {
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
  buildSchoolWelcomeEmailHtml,
  buildSchoolWelcomeEmailText,
  passwordResetEmailSubject,
  schoolWelcomeEmailSubject
} from "../src/utils/emailTemplates/schoolWelcomeEmail";

describe("email templates", () => {
  it("renders the school welcome email with the shared layout", () => {
    const html = buildSchoolWelcomeEmailHtml({
      recipientEmail: "school@example.com",
      schoolName: "Bright Future Academy",
      passwordUrl: "https://example.com/reset-password?token=abc",
      hasResetToken: true,
      forgotPasswordUrl: "https://example.com/forgot-password"
    });

    const text = buildSchoolWelcomeEmailText({
      recipientEmail: "school@example.com",
      schoolName: "Bright Future Academy",
      passwordUrl: "https://example.com/reset-password?token=abc",
      hasResetToken: true,
      forgotPasswordUrl: "https://example.com/forgot-password"
    });

    expect(schoolWelcomeEmailSubject).toContain("Education Care Africa");
    expect(html).toContain("Welcome to Your Account");
    expect(html).toContain("Your Account Details");
    expect(html).toContain("Security Notice");
    expect(html).toContain("Getting Started");
    expect(text).toContain("Bright Future Academy");
  });

  it("renders the password reset email with the same layout", () => {
    const html = buildPasswordResetEmailHtml({
      recipientEmail: "teacher@example.com",
      recipientName: "Teacher Example",
      resetUrl: "https://example.com/reset-password?token=xyz"
    });

    const text = buildPasswordResetEmailText({
      recipientEmail: "teacher@example.com",
      recipientName: "Teacher Example",
      resetUrl: "https://example.com/reset-password?token=xyz"
    });

    expect(passwordResetEmailSubject).toBe("Reset your password");
    expect(html).toContain("Password Reset Request");
    expect(html).toContain("Reset Your Password");
    expect(text).toContain("teacher@example.com");
    expect(text).toContain("Reset Your Password");
  });
});