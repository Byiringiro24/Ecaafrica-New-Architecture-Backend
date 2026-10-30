import { logger } from "./logger";

/**
 * fireAndLog — safe fire-and-forget wrapper.
 *
 * Use this instead of bare `void promise` whenever the rejected promise
 * would otherwise become an unhandled rejection (which terminates the
 * process on Node 20 via `--unhandled-rejections=throw`).
 *
 * The global `unhandledRejection` handler in server.ts is the last-resort
 * safety net, but explicit .catch() here gives better context in logs.
 *
 * @example
 *   fireAndLog(sendAttendanceNotification({...}), "attendance.notify");
 */
export function fireAndLog(promise: Promise<unknown>, ctx: string): void {
  promise.catch((err: unknown) =>
    logger.error({ err, ctx }, "background task failed")
  );
}
