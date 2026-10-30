import { z } from "zod";

const idInput = z.union([z.string(), z.number()]);

const recipientSchema = z.object({
  recipient_type: z.enum(["parent", "student", "staff", "admin", "school"]),
  recipient_id: idInput.optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

export const sendNotificationSchema = z.object({
  body: z
    .object({
      channel: z.enum(["sms", "email", "in_app"]),
      recipient_phone: z.string().optional(),
      recipient_email: z.string().email().optional(),
      recipient_id: idInput.optional(),
      recipient_type: z
        .enum(["parent", "student", "staff", "admin", "school"])
        .optional(),
      message: z.string().min(1).optional(),
      subject: z.string().optional(),
      provider_id: z.string().optional(),
      template_id: z.string().optional(),
      variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
      type: z.string().optional()
    })
    .superRefine((data, ctx) => {
      if (data.channel === "sms" && !data.recipient_phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "recipient_phone is required for SMS",
          path: ["recipient_phone"]
        });
      }

      if (data.channel === "email" && !data.recipient_email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "recipient_email is required for email",
          path: ["recipient_email"]
        });
      }

      if (data.channel === "in_app" && !data.recipient_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "recipient_id is required for in-app",
          path: ["recipient_id"]
        });
      }

      if (!data.template_id && !data.message) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "message or template_id is required",
          path: ["message"]
        });
      }
    })
});

export const sendBulkNotificationSchema = z.object({
  body: z.object({
    template_id: z.string().min(1),
    variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    recipients: z.array(recipientSchema).min(1)
  })
});
