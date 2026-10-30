import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import { renderTemplate, findTemplateById } from "../../services/notification/template.service";
import * as senderService from "../../services/notification/sender.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }

  return schoolId;
};

export const sendNotification = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const body = req.body;
  let message = body.message as string | undefined;

  if (body.template_id) {
    const template = await findTemplateById(schoolId, body.template_id);
    message = renderTemplate(template.body_en, body.variables ?? {});
  }

  if (!message) {
    throw new AppError("bad_request", "Message content is required", 400);
  }

  let log;
  if (body.channel === "sms") {
    log = await senderService.sendSMS(
      body.recipient_phone,
      message,
      body.provider_id,
      schoolId,
      {
        recipientType: body.recipient_type,
        recipientId: body.recipient_id,
        templateId: body.template_id
      }
    );
  } else if (body.channel === "email") {
    log = await senderService.sendEmail(
      body.recipient_email,
      body.subject ?? "Notification",
      message,
      schoolId,
      {
        recipientType: body.recipient_type,
        recipientId: body.recipient_id,
        templateId: body.template_id
      }
    );
  } else {
    log = await senderService.sendInApp(
      body.recipient_id,
      message,
      body.type ?? body.recipient_type ?? "parent",
      schoolId
    );
  }

  res.status(202).json(successResponse(log));
};

export const sendBulkNotifications = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const logs = await senderService.sendBulk(
    req.body.recipients,
    req.body.template_id,
    req.body.variables ?? {},
    schoolId
  );

  res.status(202).json(successResponse(logs));
};
