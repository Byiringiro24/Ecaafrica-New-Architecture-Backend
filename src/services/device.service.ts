import { type DeviceMode, type DeviceType, type Prisma, type devices, type AttendanceStatus } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";
import { hashPassword } from "../utils/hash";
import axios from "axios";
import { TabletClientService } from "./tablet-client.service";
import tabletService, { withTabletOfflineRetry } from "./tablet.service";
import { resolveNextDeviceUserId } from "./student.service";
import { sendAttendanceNotification } from "./attendance/notification.service";
import { fireAndLog } from "../utils/async";
import {
  isAttendanceScheduled,
  resolveDeviceAttendance,
  type DeviceAttendanceSession as ResolvableDeviceAttendanceSession
} from "./attendance/device-attendance-rules.service";
import { recordBoardingAttendanceScan } from "./boarding/boarding-attendance.service";

type DeviceRegisterInput = {
  device_uid: string;
  name: string;
  type?: DeviceType;
  location?: string;
  mode?: DeviceMode;
  pin?: string;
  firmware_version?: string;
  api_url?: string;
  tablet_ip?: string;
  tablet_port?: number;
  tablet_id?: string | number | bigint | null;
  license_number?: number;
  device_serial?: string;
  product_code?: string;
  product_name?: string;
};

type DeviceUpdateInput = {
  name?: string;
  type?: DeviceType;
  location?: string | null;
  mode?: DeviceMode;
  pin?: string;
  is_active?: boolean;
  firmware_version?: string | null;
  api_url?: string | null;
  tablet_ip?: string | null;
  tablet_port?: number | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  last_status_message?: string | null;
  tablet_id?: string | number | bigint | null;
  license_number?: number | null;
  device_serial?: string | null;
  product_code?: string | null;
  product_name?: string | null;
};

type DeviceFilters = {
  mode?: DeviceMode;
  type?: DeviceType;
  is_active?: boolean;
};

export type DevicePushTargetInput = {
  mode?: "selected" | "class" | "all";
  student_ids?: Array<string | number>;
  section_id?: string | number | bigint | null;
  class_id?: string | number | bigint | null;
  student_type?: string;
  gender?: "male" | "female" | null;  // filter by gender when pushing (Boys / Girls)
};

type DeviceLogInput = {
  student_id?: string | number | bigint | null;
  event_type: string;
  scan_method?: string;
  scanned_at?: string | Date;
};

type AttendanceWindowInput = {
  label: string;
  start_time: string;
  end_time: string;
  grace_minutes?: number | string | null;
  graceMinutes?: number | string | null;
};

type DeviceSessionInput = {
  name: string;
  windows: AttendanceWindowInput[];
  send_sms?: boolean;
  auto_approve?: boolean;
  notification_template_id?: string | null;
};

type DeviceAttendanceRule = {
  label?: string | null;
  start: string;
  end: string;
  grace_minutes?: number | string | null;
  graceMinutes?: number | string | null;
};

type DeviceAttendanceSession = {
  session_id?: string;
  name: string;
  rules: DeviceAttendanceRule[];
};

type DeviceAttendanceConfigInput = {
  sessions: DeviceAttendanceSession[];
};

type DeviceAttendanceEventInput = {
  student_id?: string | number | bigint | null;
  session_name?: string;
  scanned_at?: string | Date;
  scan_method?: string;
  notes?: string;
};

type MarkAbsentInput = {
  date?: string;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const normalizeBaseUrl = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
};

export const resolveDeviceApiUrl = (device: devices & { tablet?: { url: string } | null }) => {
  const tabletUrl = normalizeBaseUrl(device.tablet?.url);
  if (tabletUrl) return tabletUrl;

  const savedApiUrl = normalizeBaseUrl(device.api_url);
  if (savedApiUrl) return savedApiUrl;

  if (device.tablet_ip && device.tablet_port) {
    return `http://${device.tablet_ip}:${device.tablet_port}`;
  }
  return null;
};

export const resolveTabletBridgeUrl = (device: devices & { tablet?: { url: string } | null }) => {
  const tabletUrl = normalizeBaseUrl(device.tablet?.url);
  if (tabletUrl) return tabletUrl;

  const savedApiUrl = normalizeBaseUrl(device.api_url);
  if (savedApiUrl) return savedApiUrl;

  // Accept any port as the bridge API port (not just 5000).
  // The bridge server.js defaults to PORT=5000 but this can be configured.
  if (device.tablet_ip && device.tablet_port) {
    return `http://${device.tablet_ip}:${device.tablet_port}`;
  }

  return null;
};

export const buildDevicePushTarget = (input: DevicePushTargetInput) => ({
  mode: input.mode ?? "selected",
  student_ids: (input.student_ids ?? []).map((id) => String(id)),
  section_id: input.section_id ? String(input.section_id) : undefined,
  class_id: input.class_id ? String(input.class_id) : undefined,
  student_type: input.student_type ? String(input.student_type) : undefined,
  gender: input.gender ?? undefined,
});


export const isDeviceSyncInProgress = (status?: string | null) => {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return false;
  return ["syncing", "partial", "pending", "in_progress", "processing"].includes(normalized);
};

const normalizeAttendanceSessions = (value: unknown): DeviceAttendanceSession[] => {
  const rawValue =
    typeof value === "object" && value !== null && Array.isArray((value as any).sessions)
      ? (value as any).sessions
      : value;

  if (!Array.isArray(rawValue)) return [];

  return rawValue
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => {
      const rawRules = Array.isArray(entry.rules) ? entry.rules : [];
      const rules = rawRules
        .filter((rule): rule is Record<string, unknown> => typeof rule === "object" && rule !== null)
        .map((rule) => ({
          label: typeof rule.label === "string" ? rule.label : undefined,
          start: typeof rule.start === "string" ? rule.start : "00:00",
          end: typeof rule.end === "string" ? rule.end : "23:59"
        }))
        .filter((rule) => Boolean(rule.start) && Boolean(rule.end));

      return {
        session_id: typeof (entry as any).session_id === "string" || typeof (entry as any).session_id === "number" || typeof (entry as any).session_id === "bigint"
          ? String((entry as any).session_id)
          : typeof (entry as any).id === "string" || typeof (entry as any).id === "number" || typeof (entry as any).id === "bigint"
            ? String((entry as any).id)
            : undefined,
        name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : "Session",
        rules
      };
    })
    .filter((session) => session.rules.length > 0);
};

const resolveAttendanceSession = (
  sessions: DeviceAttendanceSession[],
  requestedName?: string
) => {
  if (requestedName) {
    const named = sessions.find((session) => session.name === requestedName);
    if (named) return named;
  }

  return sessions[0];
};

export const resolveAttendanceStatusForTime = (
  scannedAt: string | Date,
  rules: Array<{ label?: string | null; start: string; end: string; grace_minutes?: number | string | null; graceMinutes?: number | string | null }>
) => {
  const date = scannedAt instanceof Date ? scannedAt : new Date(scannedAt);
  if (!Number.isFinite(date.getTime())) return "absent";

  const minutes = date.getHours() * 60 + date.getMinutes();
  const normalizedRules = rules.map((rule) => ({
    ...rule,
    startMinutes: parseTimeToMinutes(rule.start),
    endMinutes: parseTimeToMinutes(rule.end),
    graceMinutes: Number(rule.grace_minutes ?? rule.graceMinutes ?? 0)
  }));

  for (const rule of normalizedRules) {
    const inWindow = isWithinRange(minutes, rule.startMinutes, rule.endMinutes);
    const graceConfigured = rule.graceMinutes > 0;
    const inGrace = graceConfigured && minutes > rule.endMinutes && minutes <= rule.endMinutes + rule.graceMinutes;
    const afterGrace = minutes > rule.endMinutes + rule.graceMinutes;

    if (inWindow) {
      if (/late/i.test(rule.label ?? "")) return "late";
      return "present";
    }

    if (inGrace) return "grace";

    if (minutes > rule.endMinutes && !graceConfigured) return "late";
    if (afterGrace) return "late";
  }

  return "absent";
};

const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const isWithinRange = (minutes: number, start: number, end: number) => {
  if (start <= end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
};

const formatDevice = (record: devices) => {
  const { pin_hash: _pinHash, ...rest } = record;
  const lastSeenAt = record.last_seen_at ? new Date(record.last_seen_at) : null;
  const isOnline = lastSeenAt ? Date.now() - lastSeenAt.getTime() < 90_000 : false;
  return {
    ...rest,
    id: record.id.toString(),
    school_id: record.school_id.toString(),
    status: isOnline ? "online" : "offline",
    is_online: isOnline,
    last_seen_at: lastSeenAt?.toISOString() ?? null,
    last_sync_at: record.last_sync_at?.toISOString() ?? null,
    tablet_port: record.tablet_port?.toString() ?? null
  };
};

/**
 * Check if a tablet bridge is actually reachable via HTTP
 * @param bridgeUrl - Base URL of the Windows tablet bridge API
 * @param timeoutMs - Timeout in milliseconds (default: 3000)
 * @returns true if tablet responds, false otherwise
 */
const checkTabletReachability = async (
  bridgeUrl: string | null,
  timeoutMs = 10000   // 10s — WireGuard VPN tunnels can have initial latency
): Promise<boolean> => {
  if (!bridgeUrl) return false;

  try {
    const url = `${normalizeBaseUrl(bridgeUrl)}/api/health`;
    
    const response = await axios.get(url, {
      timeout: timeoutMs,
      validateStatus: () => true, // Accept any status code — even 404 means bridge is up
    });

    return response.status > 0;
  } catch {
    return false;
  }
};

/**
 * Format device with real-time tablet status check
 * @param record - Device record from database
 * @param checkRealTimeStatus - Whether to check actual tablet connectivity (default: false)
 * @returns Formatted device object
 */
const formatDeviceWithStatus = async (
  record: devices & { tablet?: { url: string; id?: bigint; ip?: string | null; port?: number | null; status?: string; name?: string } | null },
  checkRealTimeStatus = false
) => {
  const { pin_hash: _pinHash, ...rest } = record;
  const lastSeenAt = record.last_seen_at ? new Date(record.last_seen_at) : null;
  // 2-minute grace window — pull-logs job runs every 5 s and marks offline after
  // 3 consecutive failures (~15 s). 2 minutes gives plenty of buffer for one
  // missed sweep without keeping stale "online" counts for hours.
  const recentHeartbeat = lastSeenAt ? Date.now() - lastSeenAt.getTime() < 120_000 : false;

  // Trust the DB is_connected field written by the pull-logs job.
  // The job now explicitly sets is_connected=false when a tablet is unreachable,
  // so this field is authoritative — do NOT recalculate it from last_seen_at.
  const dbIsConnected = record.is_connected === true;

  // Also trust tablet.status='online' set by pull-logs on success.
  // But only if it was recently confirmed — tablet.status can be stale on its
  // own, so we pair it with the new is_connected field or a recent heartbeat.
  const tabletOnline = (record.tablet as any)?.status === 'online';

  let isOnline = false;
  let isConnected = false;
  let status = "offline";

  if (checkRealTimeStatus) {
    // Live check — ping the bridge directly
    const bridgeReachable = await checkTabletReachability(resolveTabletBridgeUrl(record));

    isConnected = bridgeReachable || dbIsConnected || recentHeartbeat;
    isOnline = isConnected;
    status = isOnline ? "online" : "offline";
  } else {
    // Cached path — trust DB fields written by pull-logs job:
    //   is_connected=true  → job confirmed reachable on last pull
    //   is_connected=false → job explicitly marked unreachable after threshold
    //   recentHeartbeat    → last_seen_at within 2 minutes (fallback for new devices)
    // We do NOT use tablet.status alone because it may be stale (never auto-expires).
    isOnline = dbIsConnected || recentHeartbeat;
    isConnected = isOnline;
    status = isOnline ? "online" : "offline";
  }

  return {
    ...rest,
    id: record.id.toString(),
    school_id: record.school_id.toString(),
    status,
    is_online: isOnline,
    is_connected: isConnected,
    last_seen_at: lastSeenAt?.toISOString() ?? null,
    last_sync_at: record.last_sync_at?.toISOString() ?? null,
    tablet_port: record.tablet_port?.toString() ?? null,
    tablet: record.tablet ? {
      id: record.tablet.id?.toString() ?? null,
      ip: record.tablet.ip ?? null,
      port: record.tablet.port ?? null,
      url: record.tablet.url ?? null,
      status: (record.tablet as any).status ?? null,
    } : null,
  };
};

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "updated_at", "name", "last_seen_at"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "desc" } as Prisma.devicesOrderByWithRelationInput;
  }
  return { created_at: "desc" } as Prisma.devicesOrderByWithRelationInput;
};

export const registerDevice = async (
  schoolId: string | number | bigint,
  input: DeviceRegisterInput
) => {
  const existing = await prisma.devices.findUnique({
    where: { device_uid: input.device_uid }
  });

  if (existing) {
    throw new AppError("conflict", "Device UID already registered", 409);
  }

  const pin_hash = input.pin ? await hashPassword(input.pin) : undefined;

  const created = await prisma.devices.create({
    data: {
      school_id: toBigInt(schoolId),
      device_uid: input.device_uid,
      name: input.name,
      type: input.type,
      location: input.location,
      mode: input.mode,
      pin_hash,
      firmware_version: input.firmware_version,
      api_url: input.api_url,
      tablet_ip: input.tablet_ip,
      tablet_port: input.tablet_port ? Number(input.tablet_port) : null,
      tablet_id: input.tablet_id ? toBigInt(input.tablet_id) : null,
      license_number: input.license_number,
      device_serial: input.device_serial,
      product_code: input.product_code,
      product_name: input.product_name
    }
  });

  return formatDeviceWithStatus(created, true);
};

export const findAllDevices = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: DeviceFilters = {}
) => {
  const { page, limit, sort, order, q } = pagination;
  const where: Prisma.devicesWhereInput = {
    school_id: toBigInt(schoolId)
  };

  if (filters.mode) where.mode = filters.mode;
  if (filters.type) where.type = filters.type;
  if (filters.is_active !== undefined) where.is_active = filters.is_active;

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { device_uid: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.devices.findMany({
      where,
      include: { tablet: { select: { url: true, status: true, ip: true, port: true } } },
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.devices.count({ where })
  ]);

  // Use cached last_seen_at for the list — live pings are too slow when N devices are offline.
  // Live ping is reserved for GET /devices/:id/status (getDeviceStatus).
  const formattedDevices = await Promise.all(
    items.map(device => formatDeviceWithStatus(device, false))
  );

  return {
    data: formattedDevices,
    meta: { page, limit, total }
  };
};

export const findDeviceById = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const record = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: { tablet: { select: { url: true } } }
  });

  if (!record) {
    throw new AppError("not_found", "Device not found", 404);
  }

  return formatDeviceWithStatus(record, true);
};

export const updateDevice = async (
  schoolId: string | number | bigint,
  id: string,
  input: DeviceUpdateInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const existing = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Device not found", 404);
  }

  const pin_hash = input.pin ? await hashPassword(input.pin) : undefined;

  const updated = await prisma.devices.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      type: input.type,
      location: input.location,
      mode: input.mode,
      is_active: input.is_active,
      firmware_version: input.firmware_version,
      api_url: input.api_url,
      tablet_ip: input.tablet_ip,
      tablet_port: input.tablet_port !== undefined ? (input.tablet_port ? Number(input.tablet_port) : null) : undefined,
      tablet_id: input.tablet_id !== undefined ? (input.tablet_id ? toBigInt(input.tablet_id) : null) : undefined,
      license_number: input.license_number,
      device_serial: input.device_serial,
      product_code: input.product_code,
      product_name: input.product_name,
      last_sync_status: input.last_sync_status,
      last_sync_error: input.last_sync_error,
      last_status_message: input.last_status_message,
      ...(pin_hash ? { pin_hash } : {})
    }
  });

  return formatDeviceWithStatus(updated, true);
};

export const deactivateDevice = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const existing = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Device not found", 404);
  }

  const updated = await prisma.devices.update({
    where: { id: existing.id },
    data: { is_active: false }
  });

  return formatDeviceWithStatus(updated, false); // No need to check real-time status when deactivating
};

export const deleteDevice = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const existing = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!existing) {
    throw new AppError("not_found", "Device not found", 404);
  }

  await prisma.devices.delete({ where: { id: existing.id } });

  return formatDeviceWithStatus(existing, false); // No need to check real-time status when deleting
};

export const pushStudentsToDevice = async (
  schoolId: string | number | bigint,
  id: string,
  input: DevicePushTargetInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: { tablet: { select: { url: true } } }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  const apiUrl = resolveDeviceApiUrl(device);
  if (!apiUrl) {
    throw new AppError(
      "bad_request",
      "Device has no API URL or tablet connection configured. Set the tablet IP and port in device settings.",
      400
    );
  }

  // Do NOT pre-check reachability here — it blocks push if the tablet has a
  // brief network hiccup or WireGuard reconnect in progress.
  // withTabletOfflineRetry below waits up to 5 minutes for the bridge to come
  // back, so transient unavailability is handled gracefully.
  // (The old upfront check caused "Tablet bridge is offline or unreachable"
  //  errors whenever the VPN had > 3s latency, even when the tablet was fine.)

  const target = buildDevicePushTarget(input);
  const where: Prisma.studentsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null,
    status: "active"
  };

  if (target.mode === "selected") {
    if (!target.student_ids.length) {
      throw new AppError("bad_request", "Select at least one student", 400);
    }
    where.id = { in: target.student_ids.map((studentId) => toBigInt(studentId)) };
  } else if (target.mode === "class") {
    if (target.class_id) {
      where.student_section_enrollments = {
        some: {
          school_id: toBigInt(schoolId),
          status: "active",
          section: { class_id: toBigInt(target.class_id) }
        }
      };
    } else if (target.section_id) {
      where.student_section_enrollments = {
        some: {
          school_id: toBigInt(schoolId),
          status: "active",
          section_id: toBigInt(target.section_id)
        }
      };
    } else {
      throw new AppError("bad_request", "Select a class or section to push", 400);
    }
  }

  if (target.student_type) {
    where.student_type = target.student_type as any;
  }

  // Gender filter — allows pushing only Boys or only Girls to a device
  if (target.gender) {
    where.gender = target.gender as any;
  }

  const students = await prisma.students.findMany({
    where,
    select: {
      id: true,
      uuid: true,
      first_name: true,
      last_name: true,
      student_id_number: true,
      device_user_id: true,
      status: true
    },
    orderBy: { first_name: "asc" }
  });

  if (!students.length) {
    throw new AppError("not_found", "No active students matched the selected target", 404);
  }

  // Ensure every student has a device_user_id before pushing.
  // Students created before auto-assignment was introduced may have null device_user_id.
  // We assign missing IDs now inside a transaction so they are persisted immediately.
  const studentsNeedingId = students.filter((s) => !s.device_user_id);
  if (studentsNeedingId.length > 0) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.students.findMany({
        where: { school_id: toBigInt(schoolId), device_user_id: { not: null }, deleted_at: null },
        select: { device_user_id: true },
      });
      const usedIds = new Set(existing.map((s) => s.device_user_id).filter(Boolean) as string[]);

      for (const s of studentsNeedingId) {
        let next = resolveNextDeviceUserId([...usedIds]);
        while (usedIds.has(next)) { next = String(Number(next) + 1); }
        await tx.students.update({ where: { id: s.id }, data: { device_user_id: next } });
        (s as any).device_user_id = next;
        usedIds.add(next);
      }
    });
  }

  // Now all students have a device_user_id — this is the authoritative list used for the push loop
  const studentsWithDeviceUserIds = students;

  await prisma.devices.update({
    where: { id: device.id },
    data: {
      last_sync_at: new Date(),
      last_sync_status: "syncing",
      last_sync_error: null,
      last_status_message: `Pushing ${students.length} student(s) to device...`
    }
  });

  const tabletClient = new TabletClientService(apiUrl);
  const pushed: Array<{ id: string; user_id: string; name: string }> = [];
  const failed: Array<{ id: string; user_id: string; name: string; error: string }> = [];

  for (const student of studentsWithDeviceUserIds) {
    const userId = student.device_user_id;
    if (!userId) {
      failed.push({
        id: student.id.toString(),
        user_id: "",
        name: `${student.first_name} ${student.last_name}`.trim(),
        error: "Student has no device_user_id assigned"
      });
      continue;
    }
    const name = `${student.first_name} ${student.last_name}`.trim();

    try {
      const result = await withTabletOfflineRetry(
        () => tabletClient.addUser(userId, name),
        { timeoutMs: 5 * 60 * 1000, retryIntervalMs: 2000 }
      );
      if (result && (result as any).success === false) {
        throw new Error((result as any).error || "Tablet rejected user");
      }

      pushed.push({ id: student.id.toString(), user_id: userId, name });
      await prisma.students.update({
        where: { id: student.id },
        data: {
          device_user_id: userId,
          device_sync_status: "synced",
          last_device_sync: new Date()
        }
      });
    } catch (error) {
      failed.push({
        id: student.id.toString(),
        user_id: userId,
        name,
        error: error instanceof Error ? error.message : "Unknown tablet error"
      });

      await prisma.students.update({
        where: { id: student.id },
        data: { device_user_id: userId, device_sync_status: "failed" }
      });
    }
  }

  await prisma.devices.update({
    where: { id: device.id },
    data: {
      last_sync_at: new Date(),
      last_sync_status: failed.length ? "partial" : "synced",
      last_sync_error: failed.length ? `${failed.length} student(s) failed to push` : null,
      last_status_message: `Pushed ${pushed.length}/${students.length} student(s) to device`
    }
  });

  return {
    device_id: device.id.toString(),
    target,
    api_url: apiUrl,
    selected_count: studentsWithDeviceUserIds.length,
    pushed_count: pushed.length,
    failed_count: failed.length,
    students: pushed,
    errors: failed
  };
};

/**
 * Remove students from a biometric device (deletes fingerprints from FK623).
 * Supports same filter modes as push: selected / class / all.
 * After removal, clears device_sync_status and device_user_id on the student record.
 */
export const removeStudentsFromDevice = async (
  schoolId: string | number | bigint,
  id: string,
  input: DevicePushTargetInput
) => {
  if (!/^\d+$/.test(id)) throw new AppError("bad_request", "Invalid device id", 400);

  const device = await prisma.devices.findFirst({
    where: { id: toBigInt(id), school_id: toBigInt(schoolId) },
    include: { tablet: { select: { url: true } } }
  });
  if (!device) throw new AppError("not_found", "Device not found", 404);

  const apiUrl = resolveDeviceApiUrl(device);
  if (!apiUrl) throw new AppError("bad_request", "Device has no API URL or tablet connection configured", 400);

  const target = buildDevicePushTarget(input);
  const where: Prisma.studentsWhereInput = {
    school_id: toBigInt(schoolId),
    deleted_at: null,
    status: "active",
    // Only remove students that are actually synced to this device
    device_sync_status: "synced",
  };

  if (target.mode === "selected") {
    if (!target.student_ids.length) throw new AppError("bad_request", "Select at least one student", 400);
    where.id = { in: target.student_ids.map(sid => toBigInt(sid)) };
  } else if (target.mode === "class") {
    if (target.class_id) {
      where.student_section_enrollments = { some: { school_id: toBigInt(schoolId), status: "active", section: { class_id: toBigInt(target.class_id) } } };
    } else if (target.section_id) {
      where.student_section_enrollments = { some: { school_id: toBigInt(schoolId), status: "active", section_id: toBigInt(target.section_id) } };
    } else {
      throw new AppError("bad_request", "Select a class or section to remove", 400);
    }
  }
  // mode=all → no additional filter, removes all synced students

  const students = await prisma.students.findMany({
    where,
    select: { id: true, first_name: true, last_name: true, student_id_number: true, device_user_id: true },
    orderBy: { first_name: "asc" }
  });

  if (!students.length) throw new AppError("not_found", "No synced students matched the selected target", 404);

  await prisma.devices.update({
    where: { id: device.id },
    data: {
      last_sync_at: new Date(),
      last_sync_status: "syncing",
      last_sync_error: null,
      last_status_message: `Removing ${students.length} student(s) from device...`
    }
  });

  const tabletClient = new TabletClientService(apiUrl);
  const removed: Array<{ id: string; user_id: string; name: string }> = [];
  const failed: Array<{ id: string; user_id: string; name: string; error: string }> = [];

  for (const student of students) {
    const userId = student.device_user_id;
    if (!userId) {
      failed.push({
        id: student.id.toString(),
        user_id: "",
        name: `${student.first_name} ${student.last_name}`.trim(),
        error: "Student has no device_user_id assigned"
      });
      continue;
    }
    const name = `${student.first_name} ${student.last_name}`.trim();

    try {
      await tabletClient.deleteUser(userId);
      removed.push({ id: student.id.toString(), user_id: userId, name });
      // Clear sync status so student no longer shows as synced to any device
      await prisma.students.update({
        where: { id: student.id },
        data: { device_sync_status: null, device_user_id: null, last_device_sync: new Date() }
      });
    } catch (error) {
      failed.push({ id: student.id.toString(), user_id: userId, name, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  await prisma.devices.update({
    where: { id: device.id },
    data: {
      last_sync_at: new Date(),
      last_sync_status: failed.length ? "partial" : "synced",
      last_status_message: `Removed ${removed.length}/${students.length} student(s) from device`
    }
  });

  return {
    device_id: device.id.toString(),
    target,
    api_url: apiUrl,
    selected_count: students.length,
    removed_count: removed.length,
    failed_count: failed.length,
    students: removed,
    errors: failed
  };
};

export const getDeviceStatus = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  // ── Include tablet relation so resolveTabletBridgeUrl can use tablet.url ──
  // Without this include, device.tablet is undefined and the bridge URL falls
  // back to device.api_url or device.tablet_ip:tablet_port — if those are also
  // missing the device always shows offline even when WireGuard is active.
  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: {
      tablet: {
        select: { id: true, url: true, ip: true, port: true, status: true, name: true }
      }
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  if (device.tablet_id) {
    const tabletStatus = await tabletService.getDeviceStatus(device.tablet_id, schoolId);
    const statusData = (tabletStatus as any)?.data ?? tabletStatus;
    const updatedDevice = await prisma.devices.findFirst({
      where: {
        id: device.id,
        school_id: toBigInt(schoolId)
      },
      include: {
        tablet: { select: { id: true, url: true, ip: true, port: true, status: true, name: true } }
      }
    });

    return {
      ...(updatedDevice ? await formatDeviceWithStatus(updatedDevice, false) : await formatDeviceWithStatus(device, false)),
      status: statusData?.connected ? "online" : "offline",
      is_online: Boolean(statusData?.connected),
      is_connected: Boolean(statusData?.connected),
      device_status: statusData
    };
  }

  // Check real-time tablet connectivity — fetch full /api/health for three-tier status
  const bridgeUrl = resolveTabletBridgeUrl(device);

  // Three-tier status:
  //   tier 3 = full: bridge reachable + FK623 connected (fk623.connected = true)
  //   tier 2 = bridge: bridge reachable + FK623 NOT connected (bridgeReady = false / fk623.connected = false)
  //   tier 1 = offline: bridge not reachable
  let isOnline = false;
  let fk623Connected = false;
  let bridgeReady = false;
  let bridgeRunning = false;
  let wireguardActive = false;
  let healthData: any = null;

  if (bridgeUrl) {
    try {
      const healthUrl = `${bridgeUrl.replace(/\/+$/, "")}/api/health`;
      const response = await axios.get(healthUrl, { timeout: 10000, validateStatus: () => true });
      if (response.status > 0) {
        isOnline = true;
        healthData = response.data ?? {};
        fk623Connected = Boolean(healthData?.fk623?.connected ?? healthData?.connected ?? false);
        bridgeReady = Boolean(healthData?.bridgeReady ?? healthData?.fk623?.connected ?? false);
        bridgeRunning = Boolean(healthData?.bridgeRunning ?? healthData?.fk623?.connected ?? fk623Connected);
        wireguardActive = Boolean(healthData?.vpn?.active ?? healthData?.wireguardActive ?? false);
      }
    } catch {
      isOnline = false;
    }
  }

  // Determine connection tier
  // "full"   = FK623 device physically connected to the tablet bridge AND WireGuard reachable
  // "bridge" = Tablet bridge reachable via WireGuard but FK623 not physically connected
  // "offline"= Not reachable at all
  const connectionTier: "full" | "bridge" | "offline" = !isOnline
    ? "offline"
    : fk623Connected
      ? "full"
      : "bridge";

  const status = isOnline ? "online" : "offline";

  const updated = await prisma.devices.update({
    where: { id: device.id },
    data: {
      ...(isOnline ? { last_seen_at: new Date() } : {}),
      ...(fk623Connected ? { is_connected: true, last_connection_at: new Date() } : {}),
      last_status_message: !bridgeUrl
        ? "Device has no linked tablet bridge configured"
        : connectionTier === "full"
          ? "FK623 connected — WireGuard active — ready to scan"
          : connectionTier === "bridge"
            ? "Tablet bridge reachable — FK623 device not physically connected"
            : "Tablet bridge offline — check WireGuard VPN and tablet power"
    }
  });

  // ── Also update the linked tablet's status so the sidebar shows correct state ──
  // getDeviceStatus is called by "Check Status" button — it just pinged the tablet
  // and got a live result. Persist that result to tablets.status so the sidebar
  // list (which uses tablet.status) reflects reality immediately without waiting
  // for the next pull-logs sweep.
  if (device.tablet_id) {
    await prisma.tablets.update({
      where: { id: device.tablet_id },
      data: {
        status: isOnline ? 'online' : 'offline',
        last_health_check: new Date(),
        updated_at: new Date(),
      },
    }).catch(() => null); // non-fatal
  }

  return {
    ...await formatDeviceWithStatus(updated, false),
    status,
    is_online: isOnline,
    is_connected: fk623Connected,
    connection_tier: connectionTier,
    bridge_reachable: isOnline,
    fk623_connected: fk623Connected,
    bridge_ready: bridgeReady,
    bridge_running: bridgeRunning,
    wireguard_active: wireguardActive,
    last_seen_at: updated.last_seen_at?.toISOString() ?? null,
    device_status: healthData
      ? {
          connected: fk623Connected,
          users: healthData?.fk623?.users ?? healthData?.device?.users ?? 0,
          logs: healthData?.fk623?.logs ?? healthData?.device?.logs ?? 0,
          fingerprints: healthData?.fk623?.fingerprints ?? 0,
          faces: healthData?.fk623?.faces ?? 0,
          cards: healthData?.fk623?.cards ?? 0,
          serialNumber: healthData?.fk623?.serialNumber ?? healthData?.device?.serialNumber ?? null,
          productName: healthData?.fk623?.productName ?? healthData?.device?.productName ?? null,
          ipAddress: healthData?.fk623?.ipAddress ?? device.tablet_ip ?? null,
          message: updated.last_status_message
        }
      : null
  };
};

/**
 * Get device connection statuses for all devices
 * Used by dynamic device logs feature for device health monitoring
 * @param schoolId - School ID
 * @param tabletId - Optional tablet ID to filter devices
 * @returns Array of device status objects
 */
export const getAllDeviceStatuses = async (
  schoolId: string | number | bigint,
  tabletId?: string | number | bigint
) => {
  const where: any = {
    school_id: toBigInt(schoolId)
  };
  
  if (tabletId) {
    where.tablet_id = toBigInt(tabletId);
  }
  
  const devices = await prisma.devices.findMany({
    where,
    select: {
      id: true,
      name: true,
      device_serial: true,
      tablet_ip: true,
      is_connected: true,
      last_connection_at: true,
      connection_error: true
    }
  });
  
  return devices.map(device => ({
    deviceId: device.id.toString(),
    name: device.name,
    serialNumber: device.device_serial ?? undefined,
    ipAddress: device.tablet_ip ?? undefined,
    isConnected: device.is_connected,
    lastConnectionAt: device.last_connection_at?.toISOString() ?? undefined,
    connectionError: device.connection_error ?? undefined
  }));
};

export const getDeviceAttendanceConfig = async (schoolId: string | number | bigint, id: string) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  return {
    device_id: device.id.toString(),
    sessions: normalizeAttendanceSessions(device.attendance_config)
  };
};

export const saveDeviceAttendanceConfig = async (
  schoolId: string | number | bigint,
  id: string,
  input: DeviceAttendanceConfigInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  const sessions = normalizeAttendanceSessions(input.sessions);
  const updated = await prisma.devices.update({
    where: { id: device.id },
    data: {
      attendance_config: { sessions },
      last_sync_status: "configured",
      last_status_message: `Saved ${sessions.length} session(s)`
    }
  });

  return {
    device_id: updated.id.toString(),
    sessions,
    attendance_config: { sessions }
  };
};

export const recordDeviceAttendanceEvent = async (
  schoolId: string | number | bigint,
  id: string,
  input: DeviceAttendanceEventInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    },
    include: {
      device_sessions: {
        where: { deleted_at: null },
        include: { attendance_windows: { orderBy: { sort_order: "asc" } } },
        orderBy: { created_at: "asc" }
      }
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  const student = input.student_id
    ? await prisma.students.findFirst({
        where: {
          id: toBigInt(input.student_id),
          school_id: toBigInt(schoolId),
          status: "active"
        },
        select: {
          id: true,
          student_id_number: true,
          device_user_id: true,
          first_name: true,
          last_name: true,
          student_section_enrollments: {
            where: {
              status: "active"
            },
            take: 1,
            orderBy: {
              enrolled_at: "desc"
            },
            select: {
              section: {
                select: {
                  name: true,
                  class: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      })
    : null;

  if (input.student_id && !student) {
    throw new AppError("not_found", "Student not found or not active", 404);
  }

  const scannedAt = input.scanned_at ? new Date(input.scanned_at) : new Date();
  if (!Number.isFinite(scannedAt.getTime())) {
    throw new AppError("bad_request", "Invalid scan timestamp", 400);
  }

  // Attendance Sessions is the source of truth. Keep the legacy JSON config as
  // a fallback for devices configured before the session table was introduced.
  const configuredSessions: ResolvableDeviceAttendanceSession[] = device.device_sessions.length
    ? device.device_sessions.map((session) => ({
        id: session.id.toString(),
        name: session.name,
        send_sms: session.send_sms,
        auto_approve: session.auto_approve,
        notification_template_id: session.notification_template_id?.toString(),
        is_active: session.is_active,
        windows: session.attendance_windows
      }))
    : normalizeAttendanceSessions(device.attendance_config).map((session) => ({
        name: session.name,
        windows: session.rules.map((rule) => ({ label: rule.label, start: rule.start, end: rule.end }))
      }));
  const attendance = resolveDeviceAttendance(configuredSessions, scannedAt, input.session_name);
  const studentEnrollment = student?.student_section_enrollments?.[0];
  const studentName = student ? `${student.first_name} ${student.last_name}`.trim() : "Unknown";
  const studentIdValue = student?.student_id_number ?? student?.id.toString() ?? null;
  const studentDeviceId = student?.device_user_id ?? student?.id.toString() ?? null;
  const deviceLogId = String(
    input.student_id
      ? `${device.id.toString()}-${student?.id.toString() ?? "unknown"}-${scannedAt.getTime()}`
      : `${device.id.toString()}-${scannedAt.getTime()}`
  );

  const existingLog = await prisma.attendance_logs.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      device_id: id,
      log_id: deviceLogId
    }
  });

  if (existingLog) {
    throw new AppError("conflict", "Student already scanned for this device event", 409);
  }

  const statusLabel = attendance.statusLabel;
  const attendanceStatus = attendance.status;
  const selectedSessionName = attendance.sessionName;

  const created = await prisma.attendance_logs.create({
    data: {
      school_id: toBigInt(schoolId),
      log_id: deviceLogId,
      user_id: student?.id.toString() ?? null,
      student_id: studentIdValue,
      student_device_id: studentDeviceId,
      student_name: studentName,
      class_name: studentEnrollment?.section.class.name ?? null,
      section: studentEnrollment?.section.name ?? null,
      device_id: id,
      authentication_method: String((input.scan_method ?? "fingerprint").toLowerCase()),
      direction: "entry",
      timestamp: scannedAt,
      status: attendanceStatus,
      attendance_period: selectedSessionName || statusLabel,
      raw_data: {
        student_id: studentIdValue,
        student_device_id: studentDeviceId,
        student_name: studentName,
        class_name: studentEnrollment?.section.class.name ?? null,
        section: studentEnrollment?.section.name ?? null,
        device_id: id,
        scan_method: input.scan_method ?? "fingerprint",
        session_name: selectedSessionName,
        status_label: statusLabel,
        attendance_status: attendanceStatus,
        scanned_at: scannedAt.toISOString(),
        notes: input.notes ?? null
      } as Prisma.InputJsonValue,
      sync_state: "synced",
      is_flagged: false,
      flag_reason: null,
      synced_at: new Date()
    }
  });

  await prisma.devices.update({
    where: { id: device.id },
    data: {
      last_seen_at: new Date(),
      last_sync_status: "synced",
      last_status_message: `${attendanceStatus} recorded for ${selectedSessionName ?? "default"}`
    }
  });

  // ── Dining hall: auto-record in dining_attendance ─────────────────────────
  // When a device has location_scope=dining_hall and is linked to a dormitory,
  // record the scan as a dining attendance entry in the appropriate session.
  if (isAttendanceScheduled(attendanceStatus) && device.location_scope === "dining_hall" && device.dormitory_id && student?.id) {
    try {
      const { DiningMealType, DiningAttendanceStatus } = await import("@prisma/client");
      // Determine meal type from session name or time of day
      const sessionLabel = (input.session_name ?? selectedSessionName ?? "").toLowerCase();
      let mealType: typeof DiningMealType[keyof typeof DiningMealType] = DiningMealType.lunch;
      if (/breakfast|morning/i.test(sessionLabel)) mealType = DiningMealType.breakfast;
      else if (/dinner|supper|evening/i.test(sessionLabel)) mealType = DiningMealType.dinner;
      else if (/lunch|midday|noon/i.test(sessionLabel)) mealType = DiningMealType.lunch;
      else {
        // Infer from time of day
        const hour = scannedAt.getHours();
        if (hour < 10) mealType = DiningMealType.breakfast;
        else if (hour < 15) mealType = DiningMealType.lunch;
        else mealType = DiningMealType.dinner;
      }

      const sessionDate = new Date(scannedAt.getFullYear(), scannedAt.getMonth(), scannedAt.getDate());

      // Find or create dining session for this dorm + meal + date
      let diningSession = await prisma.dining_sessions.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          dormitory_id: device.dormitory_id,
          meal_type: mealType,
          session_date: sessionDate,
        },
      });
      if (!diningSession) {
        diningSession = await prisma.dining_sessions.create({
          data: {
            school_id: toBigInt(schoolId),
            dormitory_id: device.dormitory_id,
            meal_type: mealType,
            session_date: sessionDate,
            opened_at: scannedAt,
          },
        });
      }

      // Upsert attendance — biometric scan = present
      // dining_attendance uses marked_at (not scanned_at)
      await prisma.dining_attendance.upsert({
        where: { session_id_student_id: { session_id: diningSession.id, student_id: student.id } },
        create: {
          school_id: toBigInt(schoolId),
          session_id: diningSession.id,
          student_id: student.id,
          status: DiningAttendanceStatus.present,
          marked_at: scannedAt,
        },
        update: {
          status: DiningAttendanceStatus.present,
          marked_at: scannedAt,
        },
      });
    } catch { /* non-fatal — don't break the main attendance log */ }
  }

  // ── Dormitory boarding attendance: auto-record scan ───────────────────────
  if (
    isAttendanceScheduled(attendanceStatus) &&
    (device.location_scope === "dormitory" || device.mode === "boarding") &&
    device.dormitory_id &&
    student?.id
  ) {
    try {
      await recordBoardingAttendanceScan(schoolId, student.id, device.dormitory_id, scannedAt);
    } catch { /* non-fatal */ }
  }

  if (student?.id && isAttendanceScheduled(attendanceStatus)) {
    const sourceType =
      device.mode === "boarding"
        ? "dormitory_device"
        : device.mode === "classroom"
          ? "classroom_device"
          : "gate_device";
    const evening = /evening|night/i.test(selectedSessionName ?? "");
    const notificationKind =
      sourceType === "classroom_device"
        ? attendanceStatus === "absent"
          ? "class_absent"
          : attendanceStatus === "late"
            ? "class_late"
            : "class_entry"
        : sourceType === "dormitory_device"
          ? evening
            ? attendanceStatus === "absent"
              ? "dormitory_evening_absent"
              : attendanceStatus === "late"
                ? "device_late"
                : "dormitory_evening_present"
            : attendanceStatus === "absent"
              ? "dormitory_morning_absent"
              : attendanceStatus === "late"
                ? "device_late"
                : "dormitory_morning_present"
          : attendanceStatus === "absent"
            ? "device_absent"
            : attendanceStatus === "late"
              ? "device_late"
              : "school_entry";

    fireAndLog(
      sendAttendanceNotification({
        schoolId,
        studentId: student.id,
        kind: notificationKind,
        occurredAt: created.timestamp,
        sourceType,
        scopeKey: id,
        context: {
          attendance_status: attendanceStatus,
          status: attendanceStatus,
          session_name: selectedSessionName ?? ""
        }
      }),
      "device.markAttendanceEvent.notify"
    );
  }

  return {
    id: created.id.toString(),
    device_id: id,
    student_id: created.student_id ?? null,
    attendance_status: created.status,
    status_label: statusLabel,
    session_name: selectedSessionName,
    scanned_at: created.timestamp.toISOString(),
    scan_method: created.authentication_method
  };
};

export const listDeviceLogs = async (
  schoolId: string | number | bigint,
  id: string,
  pagination: PaginationParams,
  filters?: { session_name?: string; attendance_status?: string }
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  // Validate attendance_status filter
  if (filters?.attendance_status) {
    const validStatuses = ["present", "late", "absent", "not_scheduled"];
    if (!validStatuses.includes(filters.attendance_status)) {
      throw new AppError(
        "bad_request",
        `Invalid attendance_status. Valid values: ${validStatuses.join(", ")}`,
        400
      );
    }
  }

  const { page, limit } = pagination;
  const where: Prisma.gate_logsWhereInput = {
    school_id: toBigInt(schoolId),
    device_id: id
  };

  // Apply filters
  if (filters?.session_name) {
    where.session_name = filters.session_name;
  }

  if (filters?.attendance_status) {
    if (filters.attendance_status === "not_scheduled") {
      where.status_label = "Not scheduled";
    } else {
      where.attendance_status = filters.attendance_status as AttendanceStatus;
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.gate_logs.findMany({
      where,
      include: {
        student: {
          select: {
            first_name: true,
            last_name: true,
            student_id_number: true
          }
        }
      },
      orderBy: { scanned_at: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.gate_logs.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      id: item.id.toString(),
      device_id: item.device_id,
      student_id: item.student_id?.toString() ?? null,
      event_type: item.event_type,
      scan_method: item.scan_method,
      scanned_at: item.scanned_at?.toISOString() ?? null,
      session_name: item.session_name,
      status_label: item.status_label,
      attendance_status: item.attendance_status,
      is_flagged: item.is_flagged,
      synced_at: item.synced_at?.toISOString() ?? null,
      first_name: item.student?.first_name ?? null,
      last_name: item.student?.last_name ?? null,
      student_id_number: item.student?.student_id_number ?? null
    })),
    meta: { page, limit, total }
  };
};

const resolveDeviceSessionSms = async (
  schoolId: string | number | bigint,
  deviceId: string | number | bigint,
  scannedAt: Date
) => {
  const sessions = await prisma.device_sessions.findMany({
    where: {
      school_id: toBigInt(schoolId),
      device_id: toBigInt(deviceId),
      deleted_at: null
    },
    select: {
      id: true,
      send_sms: true,
      notification_template_id: true,
      attendance_windows: { orderBy: { sort_order: "asc" } }
    },
    orderBy: { created_at: "asc" }
  });
  const approvalRows = await prisma.$queryRaw<Array<{ id: bigint; auto_approve: boolean }>>`
    SELECT id, auto_approve FROM device_sessions
    WHERE school_id = ${toBigInt(schoolId)}
      AND device_id = ${toBigInt(deviceId)}
      AND deleted_at IS NULL
  `;
  const approvalMap = new Map(approvalRows.map((row) => [row.id.toString(), row.auto_approve]));

  const minutes = scannedAt.getHours() * 60 + scannedAt.getMinutes();
  const matchedSession = sessions.find((session) =>
    session.attendance_windows.some((window) =>
      isWithinRange(
        minutes,
        parseTimeToMinutes(window.start_time),
        parseTimeToMinutes(window.end_time)
      )
    )
  );
  const session = matchedSession ?? sessions[0];

  return {
    sendSms: session?.send_sms ?? true,
    autoApprove: session ? approvalMap.get(session.id.toString()) ?? true : true,
    templateId: session?.notification_template_id?.toString()
  };
};

export const createDeviceLog = async (
  schoolId: string | number | bigint,
  id: string,
  input: DeviceLogInput
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId)
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  const scannedAt = input.scanned_at ? new Date(input.scanned_at) : new Date();
  const sessionSms = await resolveDeviceSessionSms(schoolId, device.id, scannedAt);

  const created = await prisma.gate_logs.create({
    data: {
      school_id: toBigInt(schoolId),
      device_id: id,
      student_id: input.student_id ? toBigInt(input.student_id) : null,
      event_type: input.event_type as any,
      scan_method: (input.scan_method as any) ?? "fingerprint",
      scanned_at: scannedAt,
      is_flagged: !sessionSms.autoApprove,
      flag_reason: sessionSms.autoApprove ? null : "Pending attendance approval",
      synced_at: new Date()
    }
  });

  if (
    created.student_id &&
    sessionSms.sendSms &&
    (created.event_type === "entry" || created.event_type === "exit")
  ) {
    fireAndLog(
      sendAttendanceNotification({
        schoolId,
        studentId: created.student_id,
        kind: created.event_type === "exit" ? "school_exit" : "school_entry",
        occurredAt: created.scanned_at,
        templateId: sessionSms.templateId,
        sourceType: "gate_device",
        scopeKey: id
      }),
      "device.logGateEvent.notify"
    );
  }

  await prisma.devices.update({
    where: { id: device.id },
    data: {
      last_seen_at: new Date(),
      last_sync_status: "synced",
      last_status_message: `Logged ${input.event_type} event`
    }
  });

  return {
    id: created.id.toString(),
    event_type: created.event_type,
    scan_method: created.scan_method,
    scanned_at: created.scanned_at?.toISOString() ?? null,
    device_id: created.device_id,
    student_id: created.student_id?.toString() ?? null,
    is_flagged: created.is_flagged,
    synced_at: created.synced_at?.toISOString() ?? null
  };
};

// ===== Device Session CRUD Operations =====

const validateTimeFormat = (time: string): boolean => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

const normalizeTime = (time: string): string => {
  const [hours, minutes] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const resolveSessionNotificationTemplateId = async (
  schoolId: string | number | bigint,
  notificationTemplateId: string | null | undefined
): Promise<bigint | null> => {
  if (notificationTemplateId === undefined || notificationTemplateId === null) {
    return null;
  }

  if (!/^\d+$/.test(notificationTemplateId)) {
    throw new AppError("bad_request", "Invalid notification template id", 400);
  }

  const template = await prisma.notification_templates.findFirst({
    where: {
      id: toBigInt(notificationTemplateId),
      school_id: toBigInt(schoolId),
      is_active: true
    }
  });

  if (!template) {
    throw new AppError("not_found", "Notification template not found", 404);
  }

  return template.id;
};

export const createDeviceSession = async (
  schoolId: string | number | bigint,
  deviceId: string,
  input: DeviceSessionInput
) => {
  if (!/^\d+$/.test(deviceId)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(deviceId),
      school_id: toBigInt(schoolId)
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  // Validate input
  if (!input.name || input.name.trim() === "") {
    throw new AppError("bad_request", "Session name is required", 400);
  }

  if (!input.windows || input.windows.length === 0) {
    throw new AppError("bad_request", "At least one attendance window is required", 400);
  }

  // Validate windows
  for (const window of input.windows) {
    if (!window.label || !window.start_time || !window.end_time) {
      throw new AppError("bad_request", "Each window must have label, start_time, and end_time", 400);
    }

    if (!validateTimeFormat(window.start_time) || !validateTimeFormat(window.end_time)) {
      throw new AppError("bad_request", `Invalid time format. Use HH:mm (24-hour format)`, 400);
    }

    const startMinutes = parseTimeToMinutes(window.start_time);
    const endMinutes = parseTimeToMinutes(window.end_time);

    if (startMinutes > endMinutes) {
      throw new AppError("bad_request", `Window "${window.label}": start_time must be earlier than or equal to end_time`, 400);
    }
  }

  // Check for duplicate session name (case-insensitive)
  const existingSession = await prisma.device_sessions.findFirst({
    where: {
      device_id: toBigInt(deviceId),
      school_id: toBigInt(schoolId),
      name: {
        equals: input.name.trim(),
        mode: "insensitive"
      },
      deleted_at: null
    }
  });

  if (existingSession) {
    throw new AppError("conflict", "Session name already exists for this device", 409);
  }

  const notificationTemplateId = await resolveSessionNotificationTemplateId(schoolId, input.notification_template_id);

  // Create session with windows in a transaction
  const session = await prisma.device_sessions.create({
    data: {
      device_id: toBigInt(deviceId),
      school_id: toBigInt(schoolId),
      name: input.name.trim(),
      send_sms: input.send_sms ?? true,
      notification_template_id: notificationTemplateId,
      attendance_windows: {
        create: input.windows.map((window, index) => ({
          label: window.label,
          start_time: normalizeTime(window.start_time),
          end_time: normalizeTime(window.end_time),
          grace_minutes: Number(window.grace_minutes ?? window.graceMinutes ?? 0),
          sort_order: index
        } as any))
      }
    },
    include: {
      attendance_windows: {
        orderBy: { sort_order: "asc" }
      },
      notification_template: {
        select: { name: true, trigger_type: true }
      }
    }
  });

  await prisma.$executeRaw`
    UPDATE device_sessions SET auto_approve = ${input.auto_approve ?? true}
    WHERE id = ${session.id}
  `;

  return {
    id: session.id.toString(),
    device_id: deviceId,
    name: session.name,
    send_sms: session.send_sms,
    auto_approve: input.auto_approve ?? true,
    notification_template_id: session.notification_template_id?.toString() ?? null,
    notification_template: session.notification_template,
    windows: session.attendance_windows.map((w) => ({
      id: w.id.toString(),
      label: w.label,
      start_time: w.start_time,
      end_time: w.end_time,
      grace_minutes: Number((w as any).grace_minutes ?? (w as any).graceMinutes ?? 0)
    })),
    created_at: session.created_at.toISOString(),
    updated_at: session.updated_at.toISOString()
  };
};

export const getDeviceSessions = async (
  schoolId: string | number | bigint,
  deviceId: string
) => {
  if (!/^\d+$/.test(deviceId)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(deviceId),
      school_id: toBigInt(schoolId)
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  const sessions = await prisma.device_sessions.findMany({
    where: {
      device_id: toBigInt(deviceId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    },
    select: {
      id: true,
      name: true,
      send_sms: true,
      notification_template_id: true,
      created_at: true,
      updated_at: true,
      attendance_windows: {
        orderBy: { sort_order: "asc" }
      },
      notification_template: {
        select: { name: true, trigger_type: true }
      }
    },
    orderBy: { created_at: "asc" }
  });
  const approvalRows = await prisma.$queryRaw<Array<{ id: bigint; auto_approve: boolean }>>`
    SELECT id, auto_approve FROM device_sessions
    WHERE school_id = ${toBigInt(schoolId)}
      AND device_id = ${toBigInt(deviceId)}
      AND deleted_at IS NULL
  `;
  const approvalMap = new Map(approvalRows.map((row) => [row.id.toString(), row.auto_approve]));

  let activationMap = new Map<string, { is_active: boolean; activated_at: Date | null }>();
  try {
    const activationRows = await prisma.$queryRaw<Array<{ id: bigint; is_active: boolean; activated_at: Date | null }>>`
      SELECT id, is_active, activated_at FROM device_sessions
      WHERE school_id = ${toBigInt(schoolId)}
        AND device_id = ${toBigInt(deviceId)}
        AND deleted_at IS NULL
    `;
    activationMap = new Map(
      activationRows.map((row) => [
        row.id.toString(),
        { is_active: row.is_active, activated_at: row.activated_at }
      ])
    );
  } catch (err) {
    // is_active/activated_at columns may not exist yet on some environments —
    // treat all sessions as inactive rather than failing the whole endpoint.
  }

  return {
    device_id: deviceId,
    sessions: sessions.map((session) => {
      const activation = activationMap.get(session.id.toString());
      return {
        id: session.id.toString(),
        name: session.name,
        send_sms: session.send_sms,
        auto_approve: approvalMap.get(session.id.toString()) ?? true,
        is_active: activation?.is_active ?? false,
        activated_at: activation?.activated_at?.toISOString() ?? null,
        notification_template_id: session.notification_template_id?.toString() ?? null,
        notification_template: session.notification_template,
        windows: session.attendance_windows.map((w) => ({
          id: w.id.toString(),
          label: w.label,
          start_time: w.start_time,
          end_time: w.end_time,
          grace_minutes: Number((w as any).grace_minutes ?? (w as any).graceMinutes ?? 0)
        })),
        created_at: session.created_at.toISOString(),
        updated_at: session.updated_at.toISOString()
      };
    })
  };
};

export const updateDeviceSession = async (
  schoolId: string | number | bigint,
  deviceId: string,
  sessionId: string,
  input: DeviceSessionInput
) => {
  if (!/^\d+$/.test(deviceId)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  if (!/^\d+$/.test(sessionId)) {
    throw new AppError("bad_request", "Invalid session id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(deviceId),
      school_id: toBigInt(schoolId)
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  // Validate input
  if (!input.name || input.name.trim() === "") {
    throw new AppError("bad_request", "Session name is required", 400);
  }

  if (!input.windows || input.windows.length === 0) {
    throw new AppError("bad_request", "At least one attendance window is required", 400);
  }

  // Validate windows
  for (const window of input.windows) {
    if (!window.label || !window.start_time || !window.end_time) {
      throw new AppError("bad_request", "Each window must have label, start_time, and end_time", 400);
    }

    if (!validateTimeFormat(window.start_time) || !validateTimeFormat(window.end_time)) {
      throw new AppError("bad_request", `Invalid time format. Use HH:mm (24-hour format)`, 400);
    }

    const startMinutes = parseTimeToMinutes(window.start_time);
    const endMinutes = parseTimeToMinutes(window.end_time);

    if (startMinutes > endMinutes) {
      throw new AppError("bad_request", `Window "${window.label}": start_time must be earlier than or equal to end_time`, 400);
    }
  }

  // Check if session exists
  const existingSession = await prisma.device_sessions.findFirst({
    where: {
      id: toBigInt(sessionId),
      device_id: toBigInt(deviceId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!existingSession) {
    throw new AppError("not_found", "Session not found", 404);
  }
  const [existingApproval] = await prisma.$queryRaw<Array<{ auto_approve: boolean }>>`
    SELECT auto_approve FROM device_sessions WHERE id = ${toBigInt(sessionId)}
  `;
  const autoApprove = input.auto_approve ?? existingApproval?.auto_approve ?? true;

  // Check for duplicate session name (excluding current session)
  const duplicateName = await prisma.device_sessions.findFirst({
    where: {
      device_id: toBigInt(deviceId),
      school_id: toBigInt(schoolId),
      name: {
        equals: input.name.trim(),
        mode: "insensitive"
      },
      id: {
        not: toBigInt(sessionId)
      },
      deleted_at: null
    }
  });

  if (duplicateName) {
    throw new AppError("conflict", "Session name already exists for this device", 409);
  }

  const notificationTemplateId = await resolveSessionNotificationTemplateId(schoolId, input.notification_template_id);

  // Update session and windows in a transaction
  const updatedSession = await prisma.$transaction(async (tx) => {
    // Delete existing windows
    await tx.attendance_windows.deleteMany({
      where: {
        session_id: toBigInt(sessionId)
      }
    });

    // Update session and create new windows
    const session = await tx.device_sessions.update({
      where: { id: toBigInt(sessionId) },
      data: {
        name: input.name.trim(),
        send_sms: input.send_sms ?? existingSession.send_sms,
        notification_template_id:
          input.notification_template_id === undefined ? existingSession.notification_template_id : notificationTemplateId,
        attendance_windows: {
          create: input.windows.map((window, index) => ({
            label: window.label,
            start_time: normalizeTime(window.start_time),
            end_time: normalizeTime(window.end_time),
            grace_minutes: Number(window.grace_minutes ?? window.graceMinutes ?? 0),
            sort_order: index
          } as any))
        }
      },
      include: {
        attendance_windows: {
          orderBy: { sort_order: "asc" }
        },
        notification_template: {
          select: { name: true, trigger_type: true }
        }
      }
    });

    await tx.$executeRaw`
      UPDATE device_sessions SET auto_approve = ${autoApprove}
      WHERE id = ${toBigInt(sessionId)}
    `;

    return session;
  });

  return {
    id: updatedSession.id.toString(),
    device_id: deviceId,
    name: updatedSession.name,
    send_sms: updatedSession.send_sms,
    auto_approve: autoApprove,
    notification_template_id: updatedSession.notification_template_id?.toString() ?? null,
    notification_template: updatedSession.notification_template,
    windows: updatedSession.attendance_windows.map((w) => ({
      id: w.id.toString(),
      label: w.label,
      start_time: w.start_time,
      end_time: w.end_time,
      grace_minutes: Number((w as any).grace_minutes ?? (w as any).graceMinutes ?? 0)
    })),
    created_at: updatedSession.created_at.toISOString(),
    updated_at: updatedSession.updated_at.toISOString()
  };
};

export const deleteDeviceSession = async (
  schoolId: string | number | bigint,
  deviceId: string,
  sessionId: string
) => {
  if (!/^\d+$/.test(deviceId)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  if (!/^\d+$/.test(sessionId)) {
    throw new AppError("bad_request", "Invalid session id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(deviceId),
      school_id: toBigInt(schoolId)
    }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  const session = await prisma.device_sessions.findFirst({
    where: {
      id: toBigInt(sessionId),
      device_id: toBigInt(deviceId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!session) {
    throw new AppError("not_found", "Session not found", 404);
  }

  // Soft delete the session (sets deleted_at timestamp)
  await prisma.device_sessions.update({
    where: { id: toBigInt(sessionId) },
    data: {
      deleted_at: new Date()
    }
  });

  return {
    device_id: deviceId,
    session_id: sessionId,
    message: "Session deleted successfully"
  };
};

/**
 * Activate a session for a device.
 *
 * Session selection is primarily time-driven: the device resolves the matching
 * attendance window automatically for the current time. Manual activation remains
 * available as a lightweight override, but it should not silently deactivate the
 * other saved sessions because multiple attendance windows may legitimately be
 * valid at the same time.
 */
export const activateDeviceSession = async (
  schoolId: string | number | bigint,
  deviceId: string,
  sessionId: string
) => {
  if (!/^\d+$/.test(deviceId)) throw new AppError("bad_request", "Invalid device id", 400);
  if (!/^\d+$/.test(sessionId)) throw new AppError("bad_request", "Invalid session id", 400);

  const device = await prisma.devices.findFirst({
    where: { id: toBigInt(deviceId), school_id: toBigInt(schoolId) }
  });
  if (!device) throw new AppError("not_found", "Device not found", 404);

  const session = await prisma.device_sessions.findFirst({
    where: {
      id: toBigInt(sessionId),
      device_id: toBigInt(deviceId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    },
    include: { attendance_windows: { orderBy: { sort_order: "asc" } } }
  });
  if (!session) throw new AppError("not_found", "Session not found", 404);

  const updated = await prisma.device_sessions.update({
    where: { id: toBigInt(sessionId) },
    data: { is_active: true, activated_at: new Date(), updated_at: new Date() },
    include: { attendance_windows: { orderBy: { sort_order: "asc" } } }
  });

  return {
    id: updated.id.toString(),
    device_id: deviceId,
    name: updated.name,
    is_active: true,
    activated_at: updated.activated_at?.toISOString() ?? null,
    windows: updated.attendance_windows.map(w => ({
      id: w.id.toString(),
      label: w.label,
      start_time: w.start_time,
      end_time: w.end_time
    })),
    message: `Session "${updated.name}" is marked as active. The device still resolves attendance using the matching time window automatically, so this acts as a manual override rather than forcing all other sessions to stop.`
  };
};

/**
 * Deactivate a session (stop tagging scans to it).
 */
export const deactivateDeviceSession = async (
  schoolId: string | number | bigint,
  deviceId: string,
  sessionId: string
) => {
  if (!/^\d+$/.test(deviceId)) throw new AppError("bad_request", "Invalid device id", 400);
  if (!/^\d+$/.test(sessionId)) throw new AppError("bad_request", "Invalid session id", 400);

  const session = await prisma.device_sessions.findFirst({
    where: {
      id: toBigInt(sessionId),
      device_id: toBigInt(deviceId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });
  if (!session) throw new AppError("not_found", "Session not found", 404);

  await prisma.device_sessions.update({
    where: { id: toBigInt(sessionId) },
    data: { is_active: false, updated_at: new Date() }
  });

  return {
    id: sessionId,
    device_id: deviceId,
    is_active: false,
    message: `Session "${session.name}" deactivated — scans will no longer be tagged to it`
  };
};

export const markStudentsAbsent = async (
  schoolId: string | number | bigint,
  deviceId: string,
  sessionId: string,
  input: MarkAbsentInput
) => {
  if (!/^\d+$/.test(deviceId)) {
    throw new AppError("bad_request", "Invalid device id", 400);
  }

  const device = await prisma.devices.findFirst({
    where: {
      id: toBigInt(deviceId),
      school_id: toBigInt(schoolId)
    },
    include: { tablet: { select: { url: true, status: true } } }
  });

  if (!device) {
    throw new AppError("not_found", "Device not found", 404);
  }

  const lastSeenAt = device.last_seen_at ? new Date(device.last_seen_at) : null;
  const recentHeartbeat = lastSeenAt ? Date.now() - lastSeenAt.getTime() < 600_000 : false;
  const tabletOnline = (device.tablet as any)?.status === 'online';
  const deviceIsOnline = Boolean(device.is_connected) || recentHeartbeat || tabletOnline;

  const sessions = normalizeAttendanceSessions(device.attendance_config);
  const session = sessions.find((s: any) => {
    const candidateId = s.session_id ?? s.id;
    return candidateId === sessionId || s.name === sessionId;
  });

  if (!session) {
    throw new AppError("not_found", "Session not found", 404);
  }

  // Parse date
  const dateStr = input.date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new AppError("bad_request", "Invalid date format. Use YYYY-MM-DD", 400);
  }

  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) {
    throw new AppError("bad_request", "Invalid date value", 400);
  }

  // Get all actively enrolled students at the school
  const allStudents = await prisma.students.findMany({
    where: {
      school_id: toBigInt(schoolId),
      status: "active",
      deleted_at: null
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      student_id_number: true
    }
  });

  // Get existing logs for this device, session, and date
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingLogs = await prisma.gate_logs.findMany({
    where: {
      school_id: toBigInt(schoolId),
      device_id: deviceId,
      session_name: session.name,
      scanned_at: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    select: {
      student_id: true
    }
  });

  if (!deviceIsOnline && existingLogs.length === 0) {
    return {
      device_id: deviceId,
      session_id: sessionId,
      session_name: session.name,
      date: dateStr,
      absent_count: 0,
      student_ids: [],
      status: 'no_data_fetched',
      message: 'No attendance data was fetched because the device is offline or unreachable.'
    };
  }

  const scannedStudentIds = new Set(
    existingLogs.map((log) => log.student_id?.toString()).filter(Boolean)
  );

  // Find students who haven't scanned
  const absentStudents = allStudents.filter(
    (student) => !scannedStudentIds.has(student.id.toString())
  );

  // Create absent records
  const absentRecords = await Promise.all(
    absentStudents.map((student) =>
      prisma.gate_logs.create({
        data: {
          school_id: toBigInt(schoolId),
          device_id: deviceId,
          student_id: student.id,
          event_type: "entry",
          scan_method: "manual",
          scanned_at: targetDate,
          session_name: session.name,
          status_label: null,
          attendance_status: "absent",
          synced_at: new Date()
        }
      })
    )
  );

  return {
    device_id: deviceId,
    session_id: sessionId,
    session_name: session.name,
    date: dateStr,
    absent_count: absentRecords.length,
    student_ids: absentStudents.map((s) => s.id.toString()),
    status: 'success'
  };
};
