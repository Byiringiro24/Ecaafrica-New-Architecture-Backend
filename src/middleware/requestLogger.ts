import pinoHttp from "pino-http";
import type { Logger } from "pino";
import { logger } from "../utils/logger";

// Cast avoids duplicate-type mismatch between pino and pino-http logger types.
export const requestLogger = pinoHttp({ logger: logger as Logger });
