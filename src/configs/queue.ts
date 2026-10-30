import { ConnectionOptions, Queue, Worker } from "bullmq";
import { env } from "./env";
import { logger } from "../utils/logger";

export const QUEUE_NAMES = {
  NOTIFICATION: "notification",
  SMS: "sms"
} as const;

export const getRedisConnection = (): ConnectionOptions => ({
  url: env.REDIS_URL
});

export const isQueueEnabled = () => Boolean(env.REDIS_URL);

export const createQueue = (name: string) => {
  try {
    return new Queue(name, { connection: getRedisConnection() });
  } catch (error) {
    logger.warn({ err: error, queue: name }, "Redis unavailable; queue creation skipped");
    return null;
  }
};

export const createWorker = <T>(
  name: string,
  processor: (job: { data: T; id?: string }) => Promise<void>,
  options?: { concurrency?: number }
): Worker<T> | null => {
  try {
    return new Worker<T>(
      name,
      async (job) => {
        await processor(job);
      },
      {
        connection: getRedisConnection(),
        concurrency: options?.concurrency ?? 5
      }
    );
  } catch (error) {
    logger.warn({ err: error, queue: name }, "Redis unavailable; worker not started");
    return null;
  }
};

export const registerWorkerEvents = (worker: Worker | null, label: string) => {
  if (!worker) return;

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: label }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: label, err }, "Job failed");
  });
};
