// Adapted from migration/Attendance_device_config_backend/src/controllers/tablets.js

import { v4 as uuidv4 } from 'uuid';
import { AttendanceStatus, DeviceMode, GateEventType, ScanMethod, type Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import { TabletClientService } from './tablet-client.service';
import { sendAttendanceNotification } from './attendance/notification.service';
import { fireAndLog } from '../utils/async';
import {
  isAttendanceScheduled,
  normalizeLegacyAttendanceConfig,
  resolveDeviceAttendance,
  type DeviceAttendanceSession as ResolvableDeviceAttendanceSession,
  type DeviceAttendanceStatus
} from './attendance/device-attendance-rules.service';
import { recordBoardingAttendanceScan } from './boarding/boarding-attendance.service';
import { emitGateEvent } from '../sockets/notification.socket';
import {
  Tablet,
  CreateTabletInput,
  UpdateTabletInput,
  TabletFilters,
  TabletHealthResponse,
  PaginatedTablets,
  TabletStatus
} from '../types/tablet.types';
import type { FK623AttendanceLog, FK623User } from '../types/fk623.types';

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  return BigInt(value);
};

const splitName = (name?: string) => {
  const parts = (name || 'Device User').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || 'Device',
    last_name: parts.slice(1).join(' ') || 'User',
  };
};

const normalizeMethod = (value: unknown): ScanMethod => {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('face') || raw === '20') return ScanMethod.face;
  if (raw.includes('card') || raw.includes('rfid') || raw === '3') return ScanMethod.nfc;
  if (raw.includes('pin') || raw.includes('password') || raw === '2') return ScanMethod.manual;
  return ScanMethod.fingerprint;
};

const normalizeDirection = (value: unknown): GateEventType => {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('out') || ['2', '4', '6', '8'].includes(raw)) return GateEventType.exit;
  return GateEventType.entry;
};

const getTabletLogs = (result: any): FK623AttendanceLog[] => {
  if (Array.isArray(result?.logs)) return result.logs;
  if (Array.isArray(result?.data?.logs)) return result.data.logs;
  return [];
};

const getTabletUsers = (result: any): FK623User[] => {
  if (Array.isArray(result?.users)) return result.users;
  if (Array.isArray(result?.data?.users)) return result.data.users;
  return [];
};

const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const isWithinRange = (minutes: number, start: number, end: number) => {
  if (start <= end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
};

const resolveStatusFromWindow = (label?: string | null) =>
  label && /late/i.test(label) ? 'late' : 'present';

export const buildDeviceUserId = (student: {
  id: bigint;
  student_id_number: string | null;
  device_user_id: string | null;
}) => {
  // `device_user_id` is a separate generated numeric identifier, not a derived
  // student number or student-id string.
  if (student.device_user_id && String(student.device_user_id).trim()) {
    return String(student.device_user_id).trim();
  }

  // When no device ID has been assigned yet, fall back to the plain record ID.
  return student.id.toString();
};

const getNestedData = (result: any) => result?.data ?? result;

const buildOfflineDeviceStatus = (tablet: Tablet, message: string) => ({
  success: false,
  connected: false,
  ipAddress: tablet.ip,
  port: tablet.port,
  message,
});

const DEFAULT_FK623_DEVICE_IP = process.env.FK623_DEVICE_IP || '10.91.33.16';
const DEFAULT_FK623_DEVICE_PORT = Number(process.env.FK623_DEVICE_PORT || 5005);
const DEFAULT_FK623_LICENSE = Number(process.env.FK623_LICENSE || 1261);

export const withTabletOfflineRetry = async <T>(
  task: () => Promise<T>,
  options: {
    timeoutMs?: number;
    retryIntervalMs?: number;
    isOfflineError?: (error: unknown) => boolean;
  } = {}
): Promise<T> => {
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const retryIntervalMs = options.retryIntervalMs ?? 2000;
  const isOfflineError =
    options.isOfflineError ??
    ((error: unknown) => {
      const value = error as { message?: string; code?: string; cause?: { code?: string; message?: string } } | undefined;
      const message = [
        value?.message,
        value?.code,
        value?.cause?.message,
        value?.cause?.code,
        error instanceof Error ? error.message : String(error ?? '')
      ]
        .filter(Boolean)
        .join(' ');

      return /device not connected|not connected|offline|ECONNREFUSED|ECONNRESET|ECONNABORTED|ETIMEDOUT|ENOTFOUND|No response|socket hang up|Client network socket disconnected|before secure TLS connection was established|connection reset|timed out|timeout/i.test(message);
    });

  const startedAt = Date.now();
  let latestError: unknown;

  while (true) {
    try {
      return await task();
    } catch (error) {
      latestError = error;

      if (!isOfflineError(error) || Date.now() - startedAt >= timeoutMs) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }
};

export class TabletService {
  /**
   * Get all tablets for a school with pagination and filters
   */
  async listTablets(
    schoolId: bigint,
    filters: TabletFilters = {},
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedTablets> {
    const where: any = {
      school_id: schoolId,
      deleted_at: null,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.is_active !== undefined) {
      where.is_active = filters.is_active;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { ip: { contains: filters.search } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [tablets, total] = await Promise.all([
      prisma.tablets.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.tablets.count({ where }),
    ]);

    return {
      data: tablets as any,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single tablet by ID
   */
  async getTablet(id: bigint, schoolId: bigint): Promise<Tablet | null> {
    const tablet = await prisma.tablets.findFirst({
      where: {
        id,
        school_id: schoolId,
        deleted_at: null,
      },
    });

    return tablet as any;
  }

  /**
   * Register a new tablet (adapted from migration registerTablet function)
   */
  async createTablet(data: CreateTabletInput, schoolId: bigint): Promise<Tablet> {
    const { name, ip, port = 5000, location, notes, firmware_version, os_info } = data;

    if (!name || !ip) {
      throw new Error('Name and IP are required');
    }

    const url = `http://${ip}:${port}`;

    let status: TabletStatus = TabletStatus.ONLINE;
    try {
      const client = new TabletClientService(url);
      await client.health();
    } catch (error) {
      status = TabletStatus.OFFLINE;
    }

    // Check for duplicate IP/port combination
    const existing = await prisma.tablets.findFirst({
      where: {
        school_id: schoolId,
        ip,
        port,
        deleted_at: null,
      },
    });

    if (existing) {
      throw new Error(`A tablet with IP ${ip}:${port} already exists`);
    }

    // Create tablet
    const tablet = await prisma.tablets.create({
      data: {
        school_id: schoolId,
        name,
        ip,
        port,
        url,
        location,
        notes,
        firmware_version,
        os_info,
        status,
        last_health_check: new Date(),
      },
    });

    return tablet as any;
  }

  /**
   * Update tablet — also re-links devices to the new school when school_id changes
   */
  async updateTablet(id: bigint, data: UpdateTabletInput, schoolId: bigint): Promise<Tablet> {
    // Verify tablet exists and belongs to school
    const tablet = await this.getTablet(id, schoolId);
    if (!tablet) {
      throw new Error('Tablet not found');
    }

    // If IP or port changed, rebuild URL and check for conflicts
    let url = tablet.url;
    if (data.ip || data.port) {
      const newIp = data.ip || tablet.ip;
      const newPort = data.port || tablet.port;
      url = `http://${newIp}:${newPort}`;

      // Check for duplicate IP/port (excluding current tablet)
      const existing = await prisma.tablets.findFirst({
        where: {
          school_id: schoolId,
          ip: newIp,
          port: newPort,
          id: { not: id },
          deleted_at: null,
        },
      });

      if (existing) {
        throw new Error(`A tablet with IP ${newIp}:${newPort} already exists`);
      }
    }

    // Strip school_id from the prisma update data — Prisma uses relations not raw fields
    const { school_id: newSchoolId, ...prismaData } = data as any;

    // Update tablet fields
    const updated = await prisma.tablets.update({
      where: { id },
      data: {
        ...prismaData,
        url,
        updated_at: new Date(),
      },
    });

    // If IP or port changed, immediately trigger FK623 reconnect on the bridge.
    // The bridge has its own saved device config (device-config.json) with the FK623 IP.
    // Updating the tablet URL changes HOW the server reaches the bridge, not the FK623 IP.
    // We just need to reset is_connected so the next pull triggers a fresh connect.
    if (data.ip || data.port) {
      await prisma.devices.updateMany({
        where: { tablet_id: id },
        data: {
          is_connected: false,
          last_connection_at: null,
          connection_error: 'Tablet IP updated — will reconnect automatically',
          api_url: url,
          tablet_ip: data.ip || undefined,
          tablet_port: data.port || undefined,
          updated_at: new Date(),
        },
      });
    }

    // If school_id changed, move tablet and all linked devices to the new school
    // Also reset connection state so the next pull triggers a fresh connect
    if (newSchoolId && String(toBigInt(newSchoolId)) !== String(schoolId)) {
      const newSchoolBigInt = toBigInt(newSchoolId);
      await prisma.tablets.update({
        where: { id },
        data: { school_id: newSchoolBigInt, updated_at: new Date() },
      });
      // Move devices AND reset connection so auto-pull reconnects cleanly under new school
      await prisma.devices.updateMany({
        where: { tablet_id: id },
        data: {
          school_id: newSchoolBigInt,
          is_connected: false,
          last_connection_at: null,
          connection_error: 'Reassigned to new school — will reconnect automatically',
          updated_at: new Date(),
        },
      });
    }

    return updated as any;
  }

  /**
   * Soft delete tablet (adapted from migration removeTablet function)
   */
  async deleteTablet(id: bigint, schoolId: bigint): Promise<void> {
    const tablet = await this.getTablet(id, schoolId);
    if (!tablet) {
      throw new Error('Tablet not found');
    }

    // Soft delete tablet
    await prisma.tablets.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        is_active: false,
      },
    });

    // Disconnect all devices associated with this tablet
    await prisma.devices.updateMany({
      where: {
        tablet_id: id,
        school_id: schoolId,
      },
      data: {
        is_connected: false,
        last_connection_at: new Date(),
        connection_error: 'Tablet deleted',
      },
    });
  }

  /**
   * Check tablet health (adapted from migration checkTabletHealth function)
   */
  async checkHealth(id: bigint, schoolId: bigint): Promise<TabletHealthResponse> {
    const tablet = await this.getTablet(id, schoolId);
    if (!tablet) {
      throw new Error('Tablet not found');
    }

    const startTime = Date.now();
    let healthy = false;
    let error: string | undefined;
    let version: string | undefined;

    try {
      const client = new TabletClientService(tablet.url);
      const result = await client.health();
      healthy = true;
      version = result.version;

      // Update status to online
      await prisma.tablets.update({
        where: { id },
        data: {
          status: 'online',
          last_health_check: new Date(),
          updated_at: new Date(),
        },
      });

      // Also update last_seen_at on all devices linked to this tablet
      // so device.service's 90-second freshness check shows "online"
      await prisma.devices.updateMany({
        where: { tablet_id: id },
        data: { last_seen_at: new Date() },
      });
    } catch (err) {
      healthy = false;
      error = (err as Error).message;

      // Update status to offline
      await prisma.tablets.update({
        where: { id },
        data: {
          status: 'offline',
          last_health_check: new Date(),
          updated_at: new Date(),
        },
      });
    }

    const responseTime = Date.now() - startTime;

    return {
      healthy,
      responseTime,
      version,
      error,
      timestamp: new Date(),
    };
  }

  /**
   * Update tablet status
   */
  async updateStatus(id: bigint, status: TabletStatus, schoolId: bigint): Promise<Tablet> {
    const tablet = await this.getTablet(id, schoolId);
    if (!tablet) {
      throw new Error('Tablet not found');
    }

    const updated = await prisma.tablets.update({
      where: { id },
      data: {
        status,
        updated_at: new Date(),
      },
    });

    return updated as any;
  }

  /**
   * Get all online tablets for a school
   */
  async getOnlineTablets(schoolId: bigint): Promise<Tablet[]> {
    const tablets = await prisma.tablets.findMany({
      where: {
        school_id: schoolId,
        status: 'online',
        is_active: true,
        deleted_at: null,
      },
    });

    return tablets as any;
  }

  private async getTabletClient(id: string | number | bigint, schoolId: string | number | bigint) {
    const tablet = await this.getTablet(toBigInt(id), toBigInt(schoolId));
    if (!tablet) {
      throw new Error('Tablet not found');
    }

    // Rebuild URL if it's missing or malformed
    let url = tablet.url;
    if (!url || !/^https?:\/\/.+/.test(url)) {
      if (tablet.ip && tablet.port) {
        url = `http://${tablet.ip}:${tablet.port}`;
        // Persist the fixed URL
        await prisma.tablets.update({
          where: { id: toBigInt(id) },
          data: { url, updated_at: new Date() },
        }).catch(() => null);
      } else {
        throw new Error(`Tablet "${tablet.name}" has no valid IP/URL configured. Please edit it in the Super Admin → Tablets tab.`);
      }
    }

    return {
      tablet,
      client: new TabletClientService(url),
    };
  }

  async getDeviceStatus(id: string | number | bigint, schoolId: string | number | bigint) {
    const { tablet, client } = await this.getTabletClient(id, schoolId);
    let result: any;
    let deviceData: any;

    try {
      result = await client.getDeviceStatus();
      deviceData = getNestedData(result);
    } catch {
      // Device returned an error (e.g. 500) — attempt reconnect before giving up
      try {
        result = await this.tryReconnectDevice(tablet, client, schoolId);
        deviceData = getNestedData(result);
      } catch (reconnectError) {
        const message = (reconnectError as Error).message;
        await this.markTabletDeviceOffline(tablet.id, schoolId, message);
        return buildOfflineDeviceStatus(tablet as any, message);
      }
    }

    if (!deviceData?.connected) {
      try {
        result = await this.tryReconnectDevice(tablet, client, schoolId);
        deviceData = getNestedData(result);
      } catch (reconnectError) {
        const message = (reconnectError as Error).message;
        await this.markTabletDeviceOffline(tablet.id, schoolId, message);
        return buildOfflineDeviceStatus(tablet as any, message);
      }
    }

    await prisma.tablets.update({
      where: { id: toBigInt(id) },
      data: {
        status: result?.success === false || !deviceData?.connected ? 'offline' : 'online',
        last_health_check: new Date(),
      },
    });

    await prisma.devices.updateMany({
      where: { school_id: toBigInt(schoolId), tablet_id: tablet.id },
      data: {
        is_connected: Boolean(deviceData?.connected),
        last_connection_at: new Date(),
        connection_error: deviceData?.connected ? null : result?.message || 'Device disconnected',
        device_users_count: Number(deviceData?.users ?? 0),
        device_logs_count: Number(deviceData?.logs ?? 0),
        product_name: deviceData?.productName,
        product_code: deviceData?.productCode,
      },
    });

    return result;
  }

  async connectDevice(id: string | number | bigint, schoolId: string | number | bigint, input: any) {
    const { tablet, client } = await this.getTabletClient(id, schoolId);
    const existingDevice = await prisma.devices.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        tablet_id: tablet.id,
      },
      orderBy: { updated_at: 'desc' },
    });
    const deviceIp = input.ipAddress || input.ip || existingDevice?.tablet_ip || DEFAULT_FK623_DEVICE_IP;
    const devicePort = Number(input.devicePort || input.port || existingDevice?.tablet_port || DEFAULT_FK623_DEVICE_PORT);
    const license = Number(input.license || input.license_number || existingDevice?.license_number || DEFAULT_FK623_LICENSE);

    // Use explicit connect with saveConfig=true so the bridge persists FK623 credentials.
    // Subsequent auto-pull calls use connect-saved (no IP needed).
    const result: any = await client.connectDeviceExplicit({
      ipAddress: deviceIp,
      port: devicePort,
      license,
    });
    const deviceData = getNestedData(result);

    const deviceUid = input.deviceId || input.device_uid || deviceData?.deviceId || deviceData?.serialNumber || `FK623-${tablet.id.toString()}`;
    await prisma.devices.upsert({
      where: { device_uid: deviceUid },
      update: {
        tablet_id: tablet.id,
        tablet_ip: deviceIp,
        tablet_port: devicePort,
        api_url: tablet.url,
        is_connected: result.success !== false && Boolean(deviceData?.connected ?? true),
        last_connection_at: new Date(),
        connection_error: result.success === false ? result.message || 'Connection failed' : null,
        license_number: license,
        device_serial: deviceData?.serialNumber,
        product_name: deviceData?.productName,
        product_code: deviceData?.productCode,
        device_users_count: Number(deviceData?.users ?? 0),
        device_logs_count: Number(deviceData?.logs ?? 0),
      },
      create: {
        school_id: toBigInt(schoolId),
        tablet_id: tablet.id,
        device_uid: deviceUid,
        name: input.name || deviceUid,
        type: 'tablet',
        mode: 'gate',
        tablet_ip: deviceIp,
        tablet_port: devicePort,
        api_url: tablet.url,
        is_connected: result.success !== false && Boolean(deviceData?.connected ?? true),
        last_connection_at: new Date(),
        license_number: license,
        device_serial: deviceData?.serialNumber,
        product_name: deviceData?.productName,
        product_code: deviceData?.productCode,
        device_users_count: Number(deviceData?.users ?? 0),
        device_logs_count: Number(deviceData?.logs ?? 0),
      },
    });

    return result;
  }

  private async tryReconnectDevice(tablet: Tablet, client: TabletClientService, schoolId: string | number | bigint) {
    // Use connect-saved — bridge manages FK623 IP internally
    const connectResult: any = await client.connectDevice();

    if (connectResult?.success === false) {
      return connectResult;
    }

    try {
      return await client.getDeviceStatus();
    } catch {
      return connectResult;
    }
  }

  private async markTabletDeviceOffline(
    tabletId: bigint,
    schoolId: string | number | bigint,
    message: string
  ) {
    await prisma.tablets.update({
      where: { id: tabletId },
      data: {
        status: 'offline',
        last_health_check: new Date(),
        updated_at: new Date(),
      },
    });

    await prisma.devices.updateMany({
      where: { school_id: toBigInt(schoolId), tablet_id: tabletId },
      data: {
        is_connected: false,
        last_connection_at: new Date(),
        connection_error: message,
      },
    });
  }

  async disconnectDevice(id: string | number | bigint, schoolId: string | number | bigint) {
    const { client } = await this.getTabletClient(id, schoolId);
    const result = await client.disconnectDevice();
    await prisma.devices.updateMany({
      where: { school_id: toBigInt(schoolId), tablet_id: toBigInt(id) },
      data: { is_connected: false, last_connection_at: new Date() },
    });
    return result;
  }

  async syncTime(id: string | number | bigint, schoolId: string | number | bigint) {
    const { client } = await this.getTabletClient(id, schoolId);
    return client.syncTime();
  }

  async setTime(id: string | number | bigint, schoolId: string | number | bigint, datetime: string) {
    const { client } = await this.getTabletClient(id, schoolId);
    return client.setTime(datetime);
  }

  async getDeviceUsers(id: string | number | bigint, schoolId: string | number | bigint) {
    const { client } = await this.getTabletClient(id, schoolId);
    const result: any = await client.getUsers();
    const users = getTabletUsers(result);
    let savedCount = 0;

    for (const user of users) {
      const deviceUserId = String((user as any).userId || (user as any).id || '').trim();
      if (!deviceUserId) continue;

      const name = splitName(user.name || deviceUserId);
      const existing = await prisma.students.findFirst({
        where: { school_id: toBigInt(schoolId), device_user_id: deviceUserId, deleted_at: null },
      });

      if (existing) {
        await prisma.students.update({
          where: { id: existing.id },
          data: {
            first_name: name.first_name,
            last_name: name.last_name,
            device_sync_status: user.enabled === false ? 'disabled' : 'synced',
            last_device_sync: new Date(),
          },
        });
      } else {
        await prisma.students.create({
          data: {
            uuid: uuidv4(),
            school_id: toBigInt(schoolId),
            student_id_number: null,
            device_user_id: deviceUserId,
            first_name: name.first_name,
            last_name: name.last_name,
            device_sync_status: user.enabled === false ? 'disabled' : 'synced',
            last_device_sync: new Date(),
          },
        });
      }
      savedCount += 1;
    }

    return { ...result, users, count: users.length, savedCount };
  }

  async addDeviceUser(
    id: string | number | bigint,
    schoolId: string | number | bigint,
    input: { userId: string; name: string }
  ) {
    const { client } = await this.getTabletClient(id, schoolId);
    return client.addUser(input.userId, input.name);
  }

  async deleteDeviceUser(id: string | number | bigint, schoolId: string | number | bigint, userId: string) {
    const { client } = await this.getTabletClient(id, schoolId);
    return client.deleteUser(userId);
  }

  async pullDeviceLogs(id: string | number | bigint, schoolId: string | number | bigint, readMark = 0) {
    const { tablet, client } = await this.getTabletClient(id, schoolId);

    // Fetch device record — include mode and dormitory_id for boarding logic
    const deviceForConnect = await prisma.devices.findFirst({
      where: { school_id: toBigInt(schoolId), tablet_id: tablet.id },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        attendance_config: true,
        mode: true,
        dormitory_id: true,
        is_connected: true,
        last_connection_at: true,
        connection_error: true,
        device_sessions: {
          where: { deleted_at: null },
          select: {
            id: true,
            name: true,
            send_sms: true,
            notification_template_id: true,
            attendance_windows: { select: { id: true, label: true, start_time: true, end_time: true, sort_order: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    let sessionActivationMap = new Map<string, { is_active: boolean; activated_at: Date | null }>();
    if (deviceForConnect) {
      try {
        const activationRows = await prisma.$queryRaw<Array<{ id: bigint; is_active: boolean; activated_at: Date | null }>>`
          SELECT id, is_active, activated_at FROM device_sessions
          WHERE device_id = ${deviceForConnect.id} AND deleted_at IS NULL
        `;
        sessionActivationMap = new Map(
          activationRows.map((row) => [
            row.id.toString(),
            { is_active: row.is_active, activated_at: row.activated_at }
          ])
        );
      } catch (err) {
        // is_active/activated_at columns may not exist yet on some environments —
        // fall back to time-based session matching.
      }
    }
    const sessionApprovalRows = deviceForConnect
      ? await prisma.$queryRaw<Array<{ id: bigint; auto_approve: boolean }>>`
          SELECT id, auto_approve FROM device_sessions
          WHERE device_id = ${deviceForConnect.id} AND deleted_at IS NULL
        `
      : [];
    const sessionApprovalMap = new Map(
      sessionApprovalRows.map((row) => [row.id.toString(), row.auto_approve])
    );

    // ── Smart connect: only call connect-saved if not already connected ──────
    // The bridge's connect-saved does a real TCP handshake to the FK623 which
    // takes 2-5s. Skipping it when already connected removes that latency entirely.
    // We consider the device connected if is_connected=true AND connected within last 60s.
    const lastConnected = deviceForConnect?.last_connection_at;
    const isRecentlyConnected = lastConnected &&
      (Date.now() - new Date(lastConnected).getTime()) < 60_000 &&
      deviceForConnect?.is_connected === true;

    if (!isRecentlyConnected) {
      try {
        const connectResult: any = await client.connectDevice();
        if (deviceForConnect) {
          await prisma.devices.update({
            where: { id: deviceForConnect.id },
            data: {
              is_connected: connectResult?.success !== false,
              last_connection_at: new Date(),
              connection_error: connectResult?.success === false ? (connectResult?.message || 'Connect failed') : null,
            },
          });
        }
      } catch (connectErr) {
        const msg = (connectErr as Error).message ?? '';
        if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|No response/i.test(msg)) {
          throw new Error(`Auto-connect failed: ${msg}`);
        }
        // Otherwise continue — pull may succeed if bridge is already connected
      }
    }

    // ── Pull logs ────────────────────────────────────────────────────────────
    let result: any;
    try {
      result = await client.pullLogs(readMark);
    } catch (pullErr) {
      const msg = (pullErr as Error).message ?? '';

      // FK_LoadGeneralLogData failed: -3 = no logs / empty result — not an error
      if (/FK_LoadGeneralLogData|failed: -3|failed: -/i.test(msg)) {
        return {
          logs: [], count: 0, savedCount: 0, attendanceRecordCount: 0,
          duplicateCount: 0, skippedUnknownStudentCount: 0, errors: [],
        };
      }

      // Bridge says device not connected — connection was lost. Re-connect and retry once.
      if (/not connected|device not connected/i.test(msg)) {
        try {
          await client.connectDevice();
          if (deviceForConnect) {
            await prisma.devices.update({
              where: { id: deviceForConnect.id },
              data: { is_connected: true, last_connection_at: new Date(), connection_error: null },
            });
          }
          result = await client.pullLogs(readMark);
        } catch (retryErr) {
          const retryMsg = (retryErr as Error).message ?? '';
          if (/FK_LoadGeneralLogData|failed: -3|failed: -/i.test(retryMsg)) {
            return {
              logs: [], count: 0, savedCount: 0, attendanceRecordCount: 0,
              duplicateCount: 0, skippedUnknownStudentCount: 0, errors: [],
            };
          }
          throw new Error(`Pull failed after reconnect: ${retryMsg}`);
        }
      } else {
        throw new Error(`Pull failed: ${msg}`);
      }
    }

    const logs = getTabletLogs(result);
    let savedCount = 0;
    let duplicateCount = 0;
    let attendanceRecordCount = 0;
    let skippedUnknownStudentCount = 0;
    const errors: string[] = [];
    const device = deviceForConnect;

    const resolvedDeviceId = device?.id.toString() ?? `TABLET-${tablet.id.toString()}`;
    const isBoardingDevice = device?.mode === DeviceMode.boarding && !!device?.dormitory_id;

    if (logs.length === 0) {
      return {
        ...result,
        logs,
        count: 0,
        savedCount: 0,
        attendanceRecordCount: 0,
        duplicateCount: 0,
        skippedUnknownStudentCount: 0,
        errors,
      };
    }

    // ── Batch pre-load: eliminate N+1 queries ─────────────────────────────────
    // Collect all device user IDs from logs in one pass
    const allDeviceUserIds = [
      ...new Set(
        logs
          .map((log) => String((log as any).userId || log.studentDeviceId || log.studentId || '').trim())
          .filter(Boolean)
      ),
    ];

    // Single query — load all students that match any device user ID in this batch
    const existingStudents = await prisma.students.findMany({
      where: {
        school_id: toBigInt(schoolId),
        deleted_at: null,
        OR: [
          { device_user_id: { in: allDeviceUserIds } },
          { student_id_number: { in: allDeviceUserIds } },
        ],
      },
    });

    // Build lookup maps for O(1) access per log
    const studentByDeviceUserId = new Map(existingStudents.map((s) => [s.device_user_id ?? '', s]));
    const studentByStudentId = new Map(existingStudents.map((s) => [s.student_id_number ?? '', s]));

    // Single query — load all active enrollments for these students
    const studentIds = existingStudents.map((s) => s.id);
    const enrollments = studentIds.length
      ? await prisma.student_section_enrollments.findMany({
          where: {
            school_id: toBigInt(schoolId),
            student_id: { in: studentIds },
            status: 'active',
          },
          include: {
            section: { select: { name: true, class: { select: { name: true } } } },
          },
          orderBy: { enrolled_at: 'desc' },
        })
      : [];

    // Keep only the most recent active enrollment per student
    const enrollmentByStudentId = new Map<string, typeof enrollments[0]>();
    for (const enr of enrollments) {
      const key = enr.student_id.toString();
      if (!enrollmentByStudentId.has(key)) enrollmentByStudentId.set(key, enr);
    }

    // Single query — load all stable log IDs already saved for this device
    // so we can skip duplicates without a per-log DB hit
    const rawLogIds = logs
      .map((log) => {
        const rawLogId = String(log.id ?? '').trim();
        const deviceUserId = String((log as any).userId || log.studentDeviceId || log.studentId || '').trim();
        const ts = log.timestamp ? new Date(log.timestamp) : new Date();
        return rawLogId || `${resolvedDeviceId}-${deviceUserId}-${ts.getTime()}`;
      })
      .filter(Boolean);

    const alreadySavedLogs = rawLogIds.length
      ? await prisma.attendance_logs.findMany({
          where: {
            log_id: { in: rawLogIds },
            device_id: resolvedDeviceId,
          },
          select: { log_id: true },
        })
      : [];
    const savedLogIdSet = new Set(alreadySavedLogs.map((l) => l.log_id));

    // Single query — load recent gate_log timestamps for dedup
    // We group by student_id and keep the latest scanned_at
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentGateLogs = studentIds.length
      ? await prisma.gate_logs.findMany({
          where: {
            school_id: toBigInt(schoolId),
            student_id: { in: studentIds },
            device_id: resolvedDeviceId,
            scanned_at: { gte: oneHourAgo },
          },
          select: { student_id: true, scanned_at: true },
          orderBy: { scanned_at: 'desc' },
        })
      : [];

    // Map student_id → latest scanned_at for ±30s dedup check
    const lastGateLogAt = new Map<string, Date>();
    for (const gl of recentGateLogs) {
      if (!gl.student_id) continue;
      const key = gl.student_id.toString();
      if (!lastGateLogAt.has(key)) lastGateLogAt.set(key, gl.scanned_at);
    }
    // ── End of batch pre-load ─────────────────────────────────────────────────

    for (const log of logs) {
      try {
        const deviceUserId = String((log as any).userId || log.studentDeviceId || log.studentId || '').trim();
        const timestamp = log.timestamp ? new Date(log.timestamp) : new Date();

        if (!Number.isFinite(timestamp.getTime())) {
          errors.push(`Invalid timestamp for device user ${deviceUserId || 'unknown'}`);
          continue;
        }

        if (!deviceUserId) {
          errors.push(`Skipped log: missing device user id`);
          continue;
        }

        const rawLogId = String(log.id ?? '').trim();
        const stableLogId = rawLogId
          ? rawLogId
          : `${resolvedDeviceId}-${deviceUserId}-${timestamp.getTime()}`;

        // ── Dedup: attendance_logs (O(1) set lookup — no DB hit) ─────────────
        if (savedLogIdSet.has(stableLogId)) {
          duplicateCount += 1;
          continue;
        }

        // ── Find student (O(1) map lookup — no DB hit) ────────────────────────
        let student =
          studentByDeviceUserId.get(deviceUserId) ??
          studentByStudentId.get(deviceUserId);

        if (!student) {
          // Auto-create placeholder — only hits DB for truly unknown users
          student = await prisma.students.create({
            data: {
              uuid: uuidv4(),
              school_id: toBigInt(schoolId),
              student_id_number: null,
              device_user_id: deviceUserId,
              first_name: 'Device',
              last_name: `User ${deviceUserId}`,
              device_sync_status: 'pending',
              last_device_sync: new Date(),
            },
          });
          // Register in map for subsequent logs from same user
          studentByDeviceUserId.set(deviceUserId, student);
          errors.push(`Auto-created placeholder student for device user ${deviceUserId} — update their name in Students`);
          skippedUnknownStudentCount += 1;
        }

        // ── Enrollment (O(1) map lookup — no DB hit) ──────────────────────────
        const enrollment = enrollmentByStudentId.get(student.id.toString()) ?? null;

        // ── Session / attendance window matching ──────────────────────────────
        let sessionName: string | null = null;
        let statusLabel: string | null = null;
        let attendanceStatus: DeviceAttendanceStatus = AttendanceStatus.present;
        let sessionSendSms = true;
        let sessionAutoApprove = true;
        let sessionNotificationTemplateId: string | undefined;

        const configuredSessions: ResolvableDeviceAttendanceSession[] = device?.device_sessions?.length
          ? device.device_sessions.map((session) => ({
              id: session.id.toString(),
              name: session.name,
              send_sms: session.send_sms,
              auto_approve: sessionApprovalMap.get(session.id.toString()) ?? true,
              notification_template_id: session.notification_template_id?.toString(),
              is_active: sessionActivationMap.get(session.id.toString())?.is_active === true,
              windows: session.attendance_windows
            }))
          : normalizeLegacyAttendanceConfig(device?.attendance_config);
        const attendance = resolveDeviceAttendance(configuredSessions, timestamp);
        sessionName = attendance.sessionName;
        statusLabel = attendance.statusLabel;
        attendanceStatus = attendance.status;
        if (attendance.session) {
          sessionSendSms = attendance.session.send_sms ?? true;
          sessionAutoApprove = attendance.session.auto_approve ?? true;
          sessionNotificationTemplateId = attendance.session.notification_template_id;
        }

        const gateAttendanceStatus = isAttendanceScheduled(attendanceStatus)
          ? attendanceStatus as AttendanceStatus
          : null;

        // ── Dedup: gate_logs (±30s using pre-loaded map — no DB hit) ─────────
        const lastScan = lastGateLogAt.get(student.id.toString());
        const isGateDuplicate =
          lastScan && Math.abs(timestamp.getTime() - lastScan.getTime()) <= 30_000;

        if (!isGateDuplicate) {
          // ── Write gate_log ──────────────────────────────────────────────────
          await prisma.gate_logs.create({
            data: {
              school_id: toBigInt(schoolId),
              student_id: student.id,
              event_type: normalizeDirection(log.direction ?? log.directionLabel),
              scan_method: normalizeMethod(log.authenticationMethod ?? (log as any).method),
              scanned_at: timestamp,
              device_id: resolvedDeviceId,
              attendance_status: gateAttendanceStatus,
              session_name: sessionName,
              status_label: statusLabel,
              synced_at: new Date(),
              flag_reason: sessionAutoApprove ? null : 'Pending attendance approval',
              is_flagged: !sessionAutoApprove,
            } satisfies Prisma.gate_logsUncheckedCreateInput,
          });

          // Update in-memory map so subsequent logs from same student within the batch are deduped
          lastGateLogAt.set(student.id.toString(), timestamp);

          // ── Auto-create boarding_attendance_record if device is boarding mode ─
          if (isBoardingDevice && isAttendanceScheduled(attendanceStatus)) {
            void recordBoardingAttendanceScan(
              schoolId,
              student.id,
              device!.dormitory_id!,
              timestamp,
            ).catch(() => null);
          }

          if (student.id && sessionSendSms && isAttendanceScheduled(attendanceStatus)) {
            fireAndLog(
              sendAttendanceNotification({
                schoolId,
                studentId: student.id,
                kind:
                  normalizeDirection(log.direction ?? log.directionLabel) === GateEventType.exit
                    ? 'school_exit'
                    : 'school_entry',
                occurredAt: timestamp,
                templateId: sessionNotificationTemplateId,
                sourceType: 'gate_device',
                scopeKey: resolvedDeviceId,
              }),
              "tablet.pullDeviceLogs.notify"
            );
          }

          savedCount += 1;

          emitGateEvent(schoolId.toString(), {
            studentId: student.student_id_number ?? student.id.toString(),
            studentName: `${student.first_name} ${student.last_name}`.trim(),
            className: enrollment?.section.class.name ?? null,
            section: enrollment?.section.name ?? null,
            direction: String(normalizeDirection(log.direction ?? log.directionLabel)),
            method: String(normalizeMethod(log.authenticationMethod ?? (log as any).method)),
            status: String(attendanceStatus),
            sessionName: sessionName ?? null,
            deviceId: resolvedDeviceId,
            timestamp: timestamp.toISOString(),
            logId: stableLogId,
          });
        } else {
          duplicateCount += 1;
        }

        // ── Write attendance_logs (upsert — safe on retry) ────────────────────
        await prisma.attendance_logs.upsert({
          where: {
            log_id_device_id: { log_id: stableLogId, device_id: resolvedDeviceId },
          },
          update: {},
          create: {
            school_id: toBigInt(schoolId),
            log_id: stableLogId,
            user_id: deviceUserId,
            student_id: student.student_id_number ?? student.id.toString(),
            student_device_id: deviceUserId,
            student_name: `${student.first_name} ${student.last_name}`.trim(),
            class_name: enrollment?.section.class.name ?? null,
            section: enrollment?.section.name ?? null,
            device_id: resolvedDeviceId,
            authentication_method: String(normalizeMethod(log.authenticationMethod ?? (log as any).method)),
            direction: String(normalizeDirection(log.direction ?? log.directionLabel)),
            timestamp,
            status: String(attendanceStatus),
            attendance_period: sessionName ?? statusLabel,
            raw_data: {
              ...log,
              device_id: resolvedDeviceId,
              student_id: student.student_id_number ?? student.id.toString(),
              student_name: `${student.first_name} ${student.last_name}`.trim(),
              class_name: enrollment?.section.class.name ?? null,
              section: enrollment?.section.name ?? null,
              attendance_status: String(attendanceStatus),
              attendance_period: sessionName ?? statusLabel,
            } as Prisma.InputJsonValue,
            sync_state: 'synced',
            is_flagged: !sessionAutoApprove,
            flag_reason: sessionAutoApprove ? null : 'Pending attendance approval',
            synced_at: new Date(),
          },
        });

        // Mark as saved in in-memory set so next loop iteration skips it
        savedLogIdSet.add(stableLogId);
        attendanceRecordCount += 1;
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    return {
      ...result,
      logs,
      count: logs.length,
      savedCount,
      attendanceRecordCount,
      duplicateCount,
      skippedUnknownStudentCount,
      errors,
    };
  }

  async pushStudentsToDevice(
    id: string | number | bigint,
    schoolId: string | number | bigint,
    input: {
      mode?: 'all' | 'selected' | 'class';
      student_ids?: Array<string | number>;
      class_id?: string | number | bigint | null;
      section_id?: string | number | bigint | null;
      student_type?: string;
      gender?: 'male' | 'female' | null;
    } = {}
  ) {
    const { client } = await this.getTabletClient(id, schoolId);
    const where: Prisma.studentsWhereInput = {
      school_id: toBigInt(schoolId),
      deleted_at: null,
      status: 'active',
    };

    if ((input.mode ?? 'selected') === 'selected') {
      const ids = input.student_ids ?? [];
      if (!ids.length) {
        throw new Error('student_ids is required when mode is selected');
      }
      where.id = { in: ids.map((studentId) => toBigInt(studentId)) };
    } else if (input.mode === 'class') {
      if (input.class_id) {
        where.student_section_enrollments = {
          some: {
            school_id: toBigInt(schoolId),
            status: 'active',
            section: { class_id: toBigInt(input.class_id) },
          },
        };
      } else if (input.section_id) {
        where.student_section_enrollments = {
          some: {
            school_id: toBigInt(schoolId),
            status: 'active',
            section_id: toBigInt(input.section_id),
          },
        };
      } else {
        throw new Error('class_id or section_id is required when mode is class');
      }
    }

    if (input.student_type) {
      where.student_type = input.student_type as any;
    }

    // Gender filter — push only Boys or only Girls to a device
    if (input.gender) {
      where.gender = input.gender as any;
    }

    const students = await prisma.students.findMany({
      where,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        student_id_number: true,
        device_user_id: true,
        photo_url: true,        // include photo so tablet can show it on scan
      },
      orderBy: { first_name: 'asc' },
    });

    let pushedCount = 0;
    const errors: string[] = [];

    for (const student of students) {
      const userId = buildDeviceUserId(student);
      const name = `${student.first_name} ${student.last_name}`.trim();
      const photoUrl = (student as any).photo_url ?? undefined;

      try {
        const addResult: any = await withTabletOfflineRetry(
          () => client.addUser(userId, name, photoUrl),
          { timeoutMs: 5 * 60 * 1000, retryIntervalMs: 2000 }
        );
        // Verify the bridge actually accepted the user — don't trust a silent false
        if (addResult && addResult.success === false) {
          throw new Error(addResult.error || addResult.message || 'Tablet bridge rejected user');
        }
        await prisma.students.update({
          where: { id: student.id },
          data: {
            device_user_id: userId,
            device_sync_status: 'synced',
            last_device_sync: new Date(),
          },
        });
        pushedCount += 1;
      } catch (error) {
        errors.push(`${name} (${userId}): ${(error as Error).message}`);
      }
    }

    return {
      requestedCount: students.length,
      selected_count: students.length,
      pushedCount,
      pushed_count: pushedCount,
      failedCount: errors.length,
      failed_count: errors.length,
      errors,
    };
  }

  async clearDeviceLogs(id: string | number | bigint, schoolId: string | number | bigint) {
    const { client } = await this.getTabletClient(id, schoolId);
    return client.clearLogs();
  }

  async clearDeviceData(id: string | number | bigint, schoolId: string | number | bigint) {
    const { client } = await this.getTabletClient(id, schoolId);
    return client.clearAll();
  }

  async powerOffDevice(id: string | number | bigint, schoolId: string | number | bigint) {
    const { client } = await this.getTabletClient(id, schoolId);
    return client.powerOff();
  }

  /**
   * Find all tablets with filtering and pagination support
   * Returns tablets with id, name, location, status, last_health_check fields
   * Used by dynamic device logs feature
   * 
   * @param schoolId - School ID to filter tablets
   * @param filters - Optional filters (status, is_active)
   * @param pagination - Optional pagination (page, limit)
   * @returns Paginated list of tablets or all tablets if pagination not provided
   */
  async findAllTablets(
    schoolId: bigint,
    filters?: {
      status?: TabletStatus;
      is_active?: boolean;
    },
    pagination?: {
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedTablets | { data: Tablet[] }> {
    const where: any = {
      school_id: schoolId,
      deleted_at: null,
    };

    // Apply status filter if provided
    if (filters?.status) {
      where.status = filters.status;
    }

    // Apply is_active filter if provided
    if (filters?.is_active !== undefined) {
      where.is_active = filters.is_active;
    }

    // If pagination is provided, return paginated results
    if (pagination?.page && pagination?.limit) {
      const page = pagination.page;
      const limit = pagination.limit;

      const [tablets, total] = await Promise.all([
        prisma.tablets.findMany({
          where,
          select: {
            id: true,
            name: true,
            location: true,
            status: true,
            last_health_check: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        prisma.tablets.count({ where }),
      ]);

      return {
        data: tablets as any,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Otherwise, return all matching tablets without pagination
    const tablets = await prisma.tablets.findMany({
      where,
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        last_health_check: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      data: tablets as any,
    };
  }
}

export default new TabletService();
