import { OfflineRecordType } from "@prisma/client";
import { z } from "zod";

export const queueOfflineSyncBodySchema = z.object({
  device_id: z.string().min(1),
  records: z.array(
    z.object({
      local_id: z.string().min(1),
      record_type: z.nativeEnum(OfflineRecordType),
      payload: z.record(z.any())
    })
  )
});

export const offlineSyncStatusQuerySchema = z.object({
  device_id: z.string().min(1)
});

export const queueOfflineSyncSchema = z.object({
  body: queueOfflineSyncBodySchema
});

export const getOfflineSyncStatusSchema = z.object({
  query: offlineSyncStatusQuerySchema
});
