import { OfflineRecordType, type Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import { AppError } from "../middleware/errorHandler";
import * as offlineSyncService from "../services/offline-sync.service";

const resolveSchoolId = (req: Request) => {
  const schoolId = req.user?.school_id;
  if (!schoolId) {
    throw new AppError("forbidden", "Missing school context", 403);
  }
  return schoolId;
};

export const queueOfflineRecords = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const { device_id: deviceId, records } = req.body as {
    device_id: string;
    records: Array<{
      local_id: string;
      record_type: OfflineRecordType;
      payload: Prisma.JsonObject;
    }>;
  };

  const queued = await Promise.all(
    records.map((record) =>
      offlineSyncService.queueRecord(
        schoolId,
        record.record_type,
        record.payload,
        deviceId,
        record.local_id
      )
    )
  );

  const processed = await offlineSyncService.processPendingQueue(schoolId, deviceId);

  res.status(201).json(
    successResponse({
      queued,
      processed
    })
  );
};

export const getOfflineSyncStatus = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req);
  const status = await offlineSyncService.getQueueStatus(
    schoolId,
    req.query.device_id as string
  );
  res.json(successResponse(status));
};
