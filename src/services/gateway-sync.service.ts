import { OfflineRecordType, OfflineSyncStatus } from "@prisma/client";
import { prisma } from "../database/prisma";

type GatewayHeartbeatInput = {
  gateway_id: string;
  school_id?: string;
  device_count?: number;
  online?: boolean;
  last_seen_at?: string;
  firmware_version?: string;
  battery_level?: number;
  status?: string;
  queue_depth?: number;
};

type GatewayRecordsInput = {
  gateway_id: string;
  school_id?: string;
  records: Array<{
    local_id: string;
    record_type: string;
    payload?: Record<string, unknown>;
    event_id?: string;
  }>;
};

const toSchoolId = (schoolId?: string | number | bigint) => {
  if (schoolId === undefined || schoolId === null || schoolId === "") return null;
  return BigInt(schoolId);
};

const toRecordType = (value: string): OfflineRecordType => {
  const normalized = value?.trim();
  if (!normalized) return OfflineRecordType.gate_log;

  const mapped = Object.values(OfflineRecordType).find(
    (entry) => entry === normalized || entry.toLowerCase() === normalized.toLowerCase()
  );

  if (mapped) return mapped;
  return OfflineRecordType.gate_log;
};

const normalizeGatewaySchool = async (schoolId?: string | number | bigint, gatewayId?: string) => {
  const resolved = toSchoolId(schoolId);
  if (resolved) return resolved;

  if (!gatewayId) return null;

  const gateway = await prisma.tablets.findFirst({
    where: {
      OR: [{ uuid: gatewayId }, { name: gatewayId }],
      deleted_at: null
    },
    select: { school_id: true }
  });

  return gateway?.school_id ?? null;
};

export const recordHeartbeat = async (payload: GatewayHeartbeatInput) => {
  const schoolId = await normalizeGatewaySchool(payload.school_id, payload.gateway_id);
  const heartbeatAt = payload.last_seen_at ? new Date(payload.last_seen_at) : new Date();

  if (schoolId) {
    await prisma.tablets.updateMany({
      where: {
        school_id: schoolId,
        OR: [{ uuid: payload.gateway_id }, { name: payload.gateway_id }],
        deleted_at: null
      },
      data: {
        status: payload.online === false ? "offline" : "online",
        last_health_check: heartbeatAt,
        firmware_version: payload.firmware_version ?? undefined,
        updated_at: heartbeatAt
      }
    });
  }

  return {
    gateway_id: payload.gateway_id,
    school_id: schoolId?.toString() ?? payload.school_id ?? null,
    online: payload.online ?? true,
    last_seen_at: heartbeatAt.toISOString(),
    firmware_version: payload.firmware_version ?? null,
    battery_level: payload.battery_level ?? null,
    status: payload.status ?? (payload.online === false ? "offline" : "online"),
    queue_depth: payload.queue_depth ?? 0,
    device_count: payload.device_count ?? 0,
    pending_commands: []
  };
};

export const processIncomingRecords = async (payload: GatewayRecordsInput) => {
  const schoolId = await normalizeGatewaySchool(payload.school_id, payload.gateway_id);
  const accepted = [] as Array<Record<string, unknown>>;
  const rejected = [] as Array<Record<string, unknown>>;

  for (const record of payload.records) {
    try {
      const queued = await prisma.offline_sync_queue.upsert({
        where: {
          device_id_local_id: {
            device_id: payload.gateway_id,
            local_id: record.local_id
          }
        },
        update: {
          record_type: toRecordType(record.record_type),
          payload: (record.payload as any) ?? {},
          status: OfflineSyncStatus.pending,
          error_message: null
        },
        create: {
          school_id: schoolId ?? 1n,
          device_id: payload.gateway_id,
          local_id: record.local_id,
          record_type: toRecordType(record.record_type),
          payload: (record.payload as any) ?? {}
        }
      });

      accepted.push({
        id: queued.id.toString(),
        local_id: record.local_id,
        record_type: record.record_type,
        event_id: record.event_id ?? record.local_id,
        accepted: true,
        processed_at: new Date().toISOString()
      });
    } catch (error) {
      rejected.push({
        local_id: record.local_id,
        record_type: record.record_type,
        reason: error instanceof Error ? error.message : "queue_error",
        accepted: false
      });
    }
  }

  return {
    gateway_id: payload.gateway_id,
    school_id: schoolId?.toString() ?? payload.school_id ?? null,
    accepted_count: accepted.length,
    rejected_count: rejected.length,
    accepted,
    rejected
  };
};

export const buildPullResponse = async (payload: {
  gateway_id: string;
  school_id?: string;
  since?: string;
  last_pull_at?: string;
  sync_cursor?: string;
}) => {
  const schoolId = await normalizeGatewaySchool(payload.school_id, payload.gateway_id);
  const since = payload.since ?? payload.last_pull_at ?? null;

  const pendingRecords = schoolId
    ? await prisma.offline_sync_queue.findMany({
        where: {
          school_id: schoolId,
          device_id: payload.gateway_id,
          status: {
            in: [OfflineSyncStatus.pending, OfflineSyncStatus.failed]
          },
          ...(since
            ? {
                created_at: {
                  gt: new Date(since)
                }
              }
            : {})
        },
        orderBy: { created_at: "asc" },
        take: 100
      })
    : [];

  return {
    gateway_id: payload.gateway_id,
    school_id: schoolId?.toString() ?? payload.school_id ?? null,
    sync_cursor: payload.sync_cursor ?? "seeded",
    since: since ?? new Date(0).toISOString(),
    data: {
      students: [],
      parents: [],
      classes: [],
      rooms: [],
      devices: [],
      session_rules: [],
      notifications: []
    },
    commands: [],
    pending_records: pendingRecords.map((record) => ({
      id: record.id.toString(),
      local_id: record.local_id,
      record_type: record.record_type,
      payload: record.payload,
      status: record.status,
      created_at: record.created_at.toISOString()
    })),
    has_more: false,
    updated_at: new Date().toISOString()
  };
};

export const recordCommandResult = async (payload: {
  gateway_id: string;
  school_id?: string;
  command_id: string;
  status: "completed" | "failed" | "rejected";
  result?: Record<string, unknown>;
  error_message?: string;
}) => ({
  gateway_id: payload.gateway_id,
  school_id: payload.school_id ?? null,
  command_id: payload.command_id,
  status: payload.status,
  result: payload.result ?? {},
  error_message: payload.error_message ?? null,
  updated_at: new Date().toISOString()
});
