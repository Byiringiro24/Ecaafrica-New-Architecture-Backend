import type { Worker } from "bullmq";
import {
  createWorker,
  isQueueEnabled,
  QUEUE_NAMES,
  registerWorkerEvents
} from "../configs/queue";
import { NotificationStatus } from "../constants/enums";
import { prisma } from "../database/prisma";
import {
  deliverEmail,
  type NotificationJobPayload,
  updateLogStatus
} from "../services/notification/sender.service";
import { logger } from "../utils/logger";

const toBigInt = (value: string) => BigInt(value);

export const processNotificationJob = async (payload: NotificationJobPayload) => {
  try {
    if (payload.channel === "email") {
      if (!payload.to || !payload.subject) {
        throw new Error("Email notifications require to and subject");
      }

      await deliverEmail(payload.to, payload.subject, payload.body);
    } else if (payload.channel === "in_app") {
      if (!payload.recipientId) {
        throw new Error("In-app notifications require recipientId");
      }

      await prisma.messages.create({
        data: {
          thread_id: toBigInt(payload.recipientId),
          school_id: toBigInt(payload.schoolId),
          sender_id: null,
          body: payload.body,
          is_sms: false
        }
      });
    }

    await updateLogStatus(payload.logId, NotificationStatus.SENT);
    await updateLogStatus(payload.logId, NotificationStatus.DELIVERED);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Notification delivery failed";
    logger.error({ err: error, logId: payload.logId }, "Notification job failed");

    await updateLogStatus(payload.logId, NotificationStatus.FAILED, {
      errorMessage: message,
      incrementRetry: true
    });

    throw error;
  }
};

let notificationWorker: Worker<NotificationJobPayload> | null = null;

export const startNotificationWorker = () => {
  if (!isQueueEnabled() || notificationWorker) {
    return notificationWorker;
  }

  notificationWorker = createWorker<NotificationJobPayload>(
    QUEUE_NAMES.NOTIFICATION,
    async (job) => {
      await processNotificationJob(job.data);
    }
  );

  if (!notificationWorker) {
    logger.warn("Notification worker unavailable because Redis is not reachable");
    return null;
  }

  registerWorkerEvents(notificationWorker, QUEUE_NAMES.NOTIFICATION);
  logger.info("Notification worker started");

  return notificationWorker;
};
