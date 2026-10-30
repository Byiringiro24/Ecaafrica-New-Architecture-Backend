import { DeviceMode, DeviceType } from "@prisma/client";
import { z } from "zod";

export const deviceIdParamSchema = z.object({
  id: z.string().min(1)
});

export const deviceSessionParamSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1)
});

const createDeviceBodySchema = z.object({
  device_uid: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  type: z.nativeEnum(DeviceType).optional(),
  location: z.string().max(100).optional(),
  mode: z.nativeEnum(DeviceMode).optional(),
  pin: z.string().min(4).max(50).optional(),
  firmware_version: z.string().max(20).optional(),
  api_url: z.string().max(255).optional(),
  tablet_ip: z.string().max(50).optional(),
  tablet_port: z.number().int().min(1).max(65535).optional(),
  tablet_id: z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).nullable().optional(),
  license_number: z.number().int().optional(),
  device_serial: z.string().max(100).optional(),
  product_code: z.string().max(50).optional(),
  product_name: z.string().max(100).optional()
});

const updateDeviceBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    type: z.nativeEnum(DeviceType).optional(),
    location: z.string().max(100).nullable().optional(),
    mode: z.nativeEnum(DeviceMode).optional(),
    pin: z.string().min(4).max(50).optional(),
    is_active: z.boolean().optional(),
    firmware_version: z.string().max(20).nullable().optional(),
    api_url: z.string().max(255).nullable().optional(),
    tablet_ip: z.string().max(50).nullable().optional(),
    tablet_port: z.number().int().min(1).max(65535).nullable().optional(),
    tablet_id: z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).nullable().optional(),
    license_number: z.number().int().nullable().optional(),
    device_serial: z.string().max(100).nullable().optional(),
    product_code: z.string().max(50).nullable().optional(),
    product_name: z.string().max(100).nullable().optional(),
    last_sync_status: z.string().max(30).nullable().optional(),
    last_sync_error: z.string().nullable().optional(),
    last_status_message: z.string().nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const listDevicesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
  mode: z.nativeEnum(DeviceMode).optional(),
  type: z.nativeEnum(DeviceType).optional(),
  is_active: z.enum(["true", "false"]).optional()
});

const deviceAttendanceRuleSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  start: z.string().regex(/^\d{1,2}:\d{2}$/),
  end: z.string().regex(/^\d{1,2}:\d{2}$/)
});

const deviceAttendanceSessionSchema = z.object({
  name: z.string().min(1).max(80),
  rules: z.array(deviceAttendanceRuleSchema).min(1)
});

const deviceAttendanceConfigBodySchema = z.object({
  sessions: z.array(deviceAttendanceSessionSchema).min(1)
});

const deviceAttendanceEventBodySchema = z.object({
  student_id: z.union([z.string(), z.number()]).optional(),
  session_name: z.string().optional(),
  scanned_at: z.string().optional(),
  scan_method: z.string().optional(),
  notes: z.string().optional()
});

const deviceSessionWindowSchema = z.object({
  label: z.string().min(1).max(100),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
});

const deviceSessionBodySchema = z.object({
  name: z.string().min(1).max(100),
  windows: z.array(deviceSessionWindowSchema).min(1),
  send_sms: z.boolean().optional(),
  auto_approve: z.boolean().optional(),
  notification_template_id: z.string().min(1).nullable().optional()
});

export const createDeviceSchema = z.object({
  body: createDeviceBodySchema
});

export const updateDeviceSchema = z.object({
  params: deviceIdParamSchema,
  body: updateDeviceBodySchema
});

export const listDevicesSchema = z.object({
  query: listDevicesQuerySchema
});

export const saveDeviceAttendanceConfigSchema = z.object({
  params: deviceIdParamSchema,
  body: deviceAttendanceConfigBodySchema
});

export const recordDeviceAttendanceEventSchema = z.object({
  params: deviceIdParamSchema,
  body: deviceAttendanceEventBodySchema
});

export const createDeviceSessionSchema = z.object({
  params: deviceIdParamSchema,
  body: deviceSessionBodySchema
});

export const updateDeviceSessionSchema = z.object({
  params: deviceSessionParamSchema,
  body: deviceSessionBodySchema
});

export const deleteDeviceSessionSchema = z.object({
  params: deviceSessionParamSchema
});
