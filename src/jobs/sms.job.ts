import type { Worker } from "bullmq";
import {
  createWorker,
  isQueueEnabled,
  QUEUE_NAMES,
  registerWorkerEvents
} from "../configs/queue";
import { NotificationStatus } from "../constants/enums";
import {
  deliverSms,
  type SmsJobPayload,
  updateLogStatus
} from "../services/notification/sender.service";
import { logger } from "../utils/logger";

export const processSmsJob = async (payload: SmsJobPayload) => {
  try {
    const providerRef = await deliverSms(
      payload.recipientPhone,
      payload.message,
      payload.providerId ?? "",
      { clientCorrelatorId: payload.logId }
    );

    await updateLogStatus(payload.logId, NotificationStatus.SENT, { providerRef });
    await updateLogStatus(payload.logId, NotificationStatus.DELIVERED, { providerRef });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMS delivery failed";
    logger.error({ err: error, logId: payload.logId }, "SMS job failed");

    await updateLogStatus(payload.logId, NotificationStatus.FAILED, {
      errorMessage: message,
      incrementRetry: true
    });

    throw error;
  }
};

let smsWorker: Worker<SmsJobPayload> | null = null;

export const startSmsWorker = () => {
  if (!isQueueEnabled() || smsWorker) {
    return smsWorker;
  }

  smsWorker = createWorker<SmsJobPayload>(QUEUE_NAMES.SMS, async (job) => {
    await processSmsJob(job.data);
  });

  if (!smsWorker) {
    logger.warn("SMS worker unavailable because Redis is not reachable");
    return null;
  }

  registerWorkerEvents(smsWorker, QUEUE_NAMES.SMS);
  logger.info("SMS worker started");

  return smsWorker;
};
