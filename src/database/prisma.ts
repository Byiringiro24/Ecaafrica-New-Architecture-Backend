import { PrismaClient } from "@prisma/client";
import { env } from "../configs/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
    // Set a 30-second query timeout to avoid long-running queries blocking
    // the Node.js event loop and making the server appear slow.
    transactionOptions: {
      maxWait: 10000,  // wait up to 10s to acquire a connection
      timeout: 30000,  // abort any transaction running > 30s
    }
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
