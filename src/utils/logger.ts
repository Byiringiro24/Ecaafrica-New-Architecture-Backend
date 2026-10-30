import pino from "pino";
import { env } from "../configs/env";

const defaultLevel = env.NODE_ENV === "production" ? "info" : "debug";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? defaultLevel
});
