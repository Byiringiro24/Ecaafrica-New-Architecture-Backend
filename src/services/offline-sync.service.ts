import type { OfflineRecordType, Prisma, offline_sync_queue } from "@prisma/client";
import { OfflineSyncStatus } from "@prisma/client";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const formatQueueItem = (record: offline_sync_queue) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString()
});

export const queueRecord = async (
  schoolId: string | number | bigint,
  recordType: OfflineRecordType,
  payload: Prisma.JsonObject,
  deviceId: string,
  localId: string
) => {
  const queued = await prisma.offline_sync_queue.upsert({
    where: {
      device_id_local_id: {
        device_id: deviceId,
        local_id: localId
      }
    },
    update: {
      record_type: recordType,
      payload,
      status: OfflineSyncStatus.pending,
      error_message: null
    },
    create: {
      school_id: toBigInt(schoolId),
      device_id: deviceId,
      local_id: localId,
      record_type: recordType,
      payload
    }
  });

  return formatQueueItem(queued);
};

export const processPendingQueue = async (
  schoolId: string | number | bigint,
  deviceId: string
) => {
  const pendingItems = await prisma.offline_sync_queue.findMany({
    where: {
      school_id: toBigInt(schoolId),
      device_id: deviceId,
      status: {
        in: [OfflineSyncStatus.pending, OfflineSyncStatus.failed]
      }
    },
    orderBy: {
      created_at: "asc"
    }
  });

  const processed = [];

  for (const item of pendingItems) {
    try {
      const updated = await prisma.offline_sync_queue.update({
        where: { id: item.id },
        data: {
          status: OfflineSyncStatus.synced,
          synced_at: new Date(),
          error_message: null
        }
      });
      processed.push(formatQueueItem(updated));
    } catch (error) {
      const failed = await prisma.offline_sync_queue.update({
        where: { id: item.id },
        data: {
          status: OfflineSyncStatus.failed,
          retry_count: {
            increment: 1
          },
          error_message: error instanceof Error ? error.message : "Sync failed"
        }
      });
      processed.push(formatQueueItem(failed));
    }
  }

  return processed;
};

export const getQueueStatus = async (schoolId: string | number | bigint, deviceId: string) => {
  const grouped = await prisma.offline_sync_queue.groupBy({
    by: ["status"],
    where: {
      school_id: toBigInt(schoolId),
      device_id: deviceId
    },
    _count: {
      _all: true
    }
  });

  const statusMap = grouped.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {});

  return {
    device_id: deviceId,
    pending: statusMap[OfflineSyncStatus.pending] ?? 0,
    processing: statusMap[OfflineSyncStatus.processing] ?? 0,
    synced: statusMap[OfflineSyncStatus.synced] ?? 0,
    failed: statusMap[OfflineSyncStatus.failed] ?? 0
  };
};

export const validateSchoolForDevice = async (
  schoolId: string | number | bigint,
  deviceId: string
) => {
  if (!deviceId.trim()) {
    throw new AppError("bad_request", "Device id is required", 400);
  }

  return schoolId;
};
