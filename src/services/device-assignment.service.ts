/**
 * Device → Dormitory / Location assignment service.
 * Super-admin assigns a device to a school.
 * School-admin or DOD then assigns it to a specific dormitory / location within the school.
 */
import type { DeviceLocationScope } from "@prisma/client";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

const toBigInt = (v: string | number | bigint) =>
  typeof v === "bigint" ? v : BigInt(v);

export type DeviceLocationInput = {
  location_scope?: DeviceLocationScope;
  dormitory_id?: string | number | bigint | null;
  location_label?: string | null;
};

/** Assign or re-assign a device to a dormitory/location within a school */
export const assignDeviceLocation = async (
  schoolId: string | number | bigint,
  deviceId: string,
  input: DeviceLocationInput,
  assignedBy: string | number | bigint
) => {
  if (!/^\d+$/.test(deviceId)) throw new AppError("bad_request", "Invalid device id", 400);

  const device = await prisma.devices.findFirst({
    where: { id: toBigInt(deviceId), school_id: toBigInt(schoolId) },
  });
  if (!device) throw new AppError("not_found", "Device not found", 404);

  // Validate dormitory if provided
  if (input.dormitory_id) {
    const dorm = await prisma.dormitories.findFirst({
      where: { id: toBigInt(input.dormitory_id), school_id: toBigInt(schoolId) },
    });
    if (!dorm) throw new AppError("not_found", "Dormitory not found", 404);
  }

  const updated = await prisma.devices.update({
    where: { id: device.id },
    data: {
      location_scope: input.location_scope ?? device.location_scope,
      dormitory_id: input.dormitory_id !== undefined
        ? (input.dormitory_id ? toBigInt(input.dormitory_id) : null)
        : device.dormitory_id,
      location_label: input.location_label !== undefined ? input.location_label : device.location_label,
      assigned_by: toBigInt(assignedBy),
      assigned_at: new Date(),
    },
  });

  return {
    id: updated.id.toString(),
    school_id: updated.school_id.toString(),
    device_uid: updated.device_uid,
    name: updated.name,
    mode: updated.mode,
    location_scope: updated.location_scope,
    dormitory_id: updated.dormitory_id?.toString() ?? null,
    location_label: updated.location_label,
    assigned_by: updated.assigned_by?.toString() ?? null,
    assigned_at: updated.assigned_at?.toISOString() ?? null,
  };
};

/** List devices with their location assignment info */
export const listDevicesWithLocation = async (
  schoolId: string | number | bigint,
  filters?: { dormitory_id?: string; location_scope?: DeviceLocationScope }
) => {
  const whereClause: Record<string, any> = {
    school_id: toBigInt(schoolId),
    is_active: true,
  };
  if (filters?.dormitory_id) whereClause.dormitory_id = toBigInt(filters.dormitory_id);
  if (filters?.location_scope) whereClause.location_scope = filters.location_scope;

  const devices = await prisma.devices.findMany({
    where: whereClause,
    include: {
      dormitory: { select: { id: true, name: true, block_name: true, hostel_name: true } },
    },
    orderBy: { name: "asc" },
  });

  return devices.map((d) => ({
    id: d.id.toString(),
    device_uid: d.device_uid,
    name: d.name,
    mode: d.mode,
    type: d.type,
    is_active: d.is_active,
    is_connected: d.is_connected,
    last_seen_at: d.last_seen_at?.toISOString() ?? null,
    location_scope: d.location_scope,
    location_label: d.location_label,
    dormitory_id: d.dormitory_id?.toString() ?? null,
    dormitory: d.dormitory ? { ...d.dormitory, id: d.dormitory.id.toString() } : null,
    assigned_at: d.assigned_at?.toISOString() ?? null,
  }));
};

/** Max students per device — FK623 supports up to 2000 */
const DEVICE_CAPACITY = 2000;

/**
 * Get all students assigned to a device based on its location_scope.
 * Groups into pages of DEVICE_CAPACITY for devices that have too many students.
 *
 * Logic:
 *  - dormitory  → boarding students in that dorm
 *  - gate       → ALL students (all day students + all boarding), split by type
 *  - dining_hall→ boarding students assigned to linked dormitory
 *  - classroom  → students enrolled in linked class/section
 *  - other      → all active students
 *
 * Returns { groups: Group[], total, deviceCapacity }
 * Groups are pages of up to 2000 — each group goes to a separate device.
 */
export const getStudentsForDevice = async (
  schoolId: string | number | bigint,
  deviceId: string
) => {
  if (!/^\d+$/.test(deviceId)) throw new AppError("bad_request", "Invalid device id", 400);

  const device = await prisma.devices.findFirst({
    where: { id: toBigInt(deviceId), school_id: toBigInt(schoolId) },
    include: {
      dormitory: { select: { id: true, name: true } },
      tablet: { select: { id: true, name: true, ip: true } },
    },
  });
  if (!device) throw new AppError("not_found", "Device not found", 404);

  const scope = device.location_scope ?? "gate";
  let students: any[] = [];

  if (scope === "dormitory" && device.dormitory_id) {
    // Boarding students in this dorm
    const assignments = await prisma.student_dorm_assignments.findMany({
      where: { school_id: toBigInt(schoolId), dormitory_id: device.dormitory_id, left_at: null },
      include: {
        student: {
          select: {
            id: true, first_name: true, last_name: true,
            student_id_number: true, device_user_id: true,
            device_sync_status: true,
            photo_url: true, student_type: true, gender: true,
            student_section_enrollments: {
              where: { school_id: toBigInt(schoolId), status: "active", left_at: null },
              orderBy: { enrolled_at: "desc" },
              take: 1,
              select: {
                status: true,
                section: {
                  select: { id: true, name: true, full_name: true },
                },
              },
            },
          },
        },
      },
    });
    students = assignments.map((a) => ({
      ...fmtStudent(a.student),
      dormitory_id: device.dormitory_id!.toString(),
      student_type: "boarding",
    }));

  } else if (scope === "dining_hall" && device.dormitory_id) {
    // Same as dormitory — dining attendance uses dorm students
    const assignments = await prisma.student_dorm_assignments.findMany({
      where: { school_id: toBigInt(schoolId), dormitory_id: device.dormitory_id, left_at: null },
      include: {
        student: {
          select: {
            id: true, first_name: true, last_name: true,
            student_id_number: true, device_user_id: true,
            device_sync_status: true,
            photo_url: true, student_type: true, gender: true,
            student_section_enrollments: {
              where: { school_id: toBigInt(schoolId), status: "active", left_at: null },
              orderBy: { enrolled_at: "desc" },
              take: 1,
              select: {
                status: true,
                section: {
                  select: { id: true, name: true, full_name: true },
                },
              },
            },
          },
        },
      },
    });
    students = assignments.map((a) => ({
      ...fmtStudent(a.student),
      student_type: "boarding",
    }));

  } else if (scope === "classroom") {
    const sectionIds = await resolveClassroomSectionIds(schoolId, device.location_label);
    students = sectionIds.length
      ? await getStudentsBySectionIds(schoolId, sectionIds)
      : await getAllStudents(schoolId);

  } else {
    // gate or other — ALL students (day + boarding), with type differentiation
    students = await getAllStudents(schoolId);
  }

  // Split into groups of DEVICE_CAPACITY
  const groups: { group: number; label: string; students: any[] }[] = [];
  for (let i = 0; i < students.length; i += DEVICE_CAPACITY) {
    const chunk = students.slice(i, i + DEVICE_CAPACITY);
    const groupNum = Math.floor(i / DEVICE_CAPACITY) + 1;
    groups.push({
      group: groupNum,
      label: students.length > DEVICE_CAPACITY
        ? `Group ${groupNum} (${chunk.length} students)`
        : `All students (${chunk.length})`,
      students: chunk,
    });
  }

  return {
    device: {
      id: device.id.toString(),
      name: device.name,
      device_uid: device.device_uid,
      location_scope: scope,
      location_label: device.location_label,
      dormitory: device.dormitory ? { ...device.dormitory, id: device.dormitory.id.toString() } : null,
      tablet: device.tablet ? { ...device.tablet, id: device.tablet.id.toString() } : null,
    },
    total: students.length,
    deviceCapacity: DEVICE_CAPACITY,
    groupCount: groups.length,
    groups,
  };
};

async function resolveClassroomSectionIds(schoolId: string | number | bigint, locationLabel?: string | null) {
  const label = (locationLabel ?? "").trim();
  if (!label) return [];

  const sections = await prisma.sections.findMany({
    where: {
      school_id: toBigInt(schoolId),
      deleted_at: null,
      OR: [
        { name: { equals: label, mode: "insensitive" } },
        { full_name: { equals: label, mode: "insensitive" } },
        { name: { contains: label, mode: "insensitive" } },
        { full_name: { contains: label, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  return sections.map((section) => section.id);
}

async function getStudentsBySectionIds(schoolId: string | number | bigint, sectionIds: bigint[]) {
  const all = await prisma.students.findMany({
    where: {
      school_id: toBigInt(schoolId),
      deleted_at: null,
      status: "active",
      student_section_enrollments: {
        some: {
          school_id: toBigInt(schoolId),
          status: "active",
          section_id: { in: sectionIds },
        },
      },
    },
    select: {
      id: true, first_name: true, last_name: true,
      student_id_number: true, device_user_id: true,
      device_sync_status: true,
      photo_url: true, student_type: true, gender: true,
      student_section_enrollments: {
        where: { school_id: toBigInt(schoolId), status: "active", left_at: null },
        orderBy: { enrolled_at: "desc" },
        take: 1,
        select: {
          status: true,
          section: {
            select: { id: true, name: true, full_name: true },
          },
        },
      },
    },
    orderBy: [{ student_type: "asc" }, { first_name: "asc" }],
  });
  return all.map(fmtStudent);
}

async function getAllStudents(schoolId: string | number | bigint) {
  const all = await prisma.students.findMany({
    where: { school_id: toBigInt(schoolId), deleted_at: null, status: "active" },
    select: {
      id: true, first_name: true, last_name: true,
      student_id_number: true, device_user_id: true,
      device_sync_status: true,
      photo_url: true, student_type: true, gender: true,
      student_section_enrollments: {
        where: { school_id: toBigInt(schoolId), status: "active", left_at: null },
        orderBy: { enrolled_at: "desc" },
        take: 1,
        select: {
          status: true,
          section: {
            select: { id: true, name: true, full_name: true },
          },
        },
      },
    },
    orderBy: [{ student_type: "asc" }, { first_name: "asc" }],
  });
  return all.map(fmtStudent);
}

export type DeviceStudentImageSyncSnapshot = {
  id: string | number | bigint;
  device_user_id?: string | null;
  full_name?: string | null;
  class_name?: string | null;
  student_type?: string | null;
  photo_url?: string | null;
};

const isSameDeviceStudentImageState = (
  previous: DeviceStudentImageSyncSnapshot | undefined,
  next: DeviceStudentImageSyncSnapshot | undefined
) => {
  if (!previous && !next) return true;
  if (!previous || !next) return false;

  return (
    String(previous.device_user_id ?? "") === String(next.device_user_id ?? "") &&
    String(previous.full_name ?? "") === String(next.full_name ?? "") &&
    String(previous.class_name ?? "") === String(next.class_name ?? "") &&
    String(previous.student_type ?? "") === String(next.student_type ?? "") &&
    String(previous.photo_url ?? "") === String(next.photo_url ?? "")
  );
};

/**
 * Builds the exact reconciliation plan for device-local student image sync.
 *
 * This is the backend-side logic that matches the intended tablet behavior:
 * - keep unchanged students
 * - remove students no longer assigned to the device
 * - add newly assigned students
 * - re-download a cached image when student metadata or photo changed
 */
export const buildDeviceStudentImageSyncPlan = (
  previousStudents: DeviceStudentImageSyncSnapshot[] = [],
  nextStudents: DeviceStudentImageSyncSnapshot[] = []
) => {
  const previousMap = new Map(previousStudents.map((student) => [String(student.id), student]));
  const nextMap = new Map(nextStudents.map((student) => [String(student.id), student]));

  const keep = Array.from(previousMap.keys()).filter((id) => nextMap.has(id));
  const remove = Array.from(previousMap.keys()).filter((id) => !nextMap.has(id));
  const add = Array.from(nextMap.keys()).filter((id) => !previousMap.has(id));
  const changed = Array.from(previousMap.keys()).filter((id) => {
    if (!nextMap.has(id)) return false;
    return !isSameDeviceStudentImageState(previousMap.get(id), nextMap.get(id));
  });

  return {
    keep,
    remove,
    add,
    changed,
    total: new Set([...keep, ...remove, ...add, ...changed]).size,
  };
};

export const normalizeDeviceStudentStatus = (student: { device_sync_status?: string | null; device_user_id?: string | null }) => {
  const rawStatus = (student?.device_sync_status ?? "").trim().toLowerCase();
  if (rawStatus === "failed" || rawStatus === "disabled") return "failed";
  if (["pending", "syncing", "in_progress", "processing", ""].includes(rawStatus)) return "pending";
  if (["synced", "configured", "success"].includes(rawStatus)) return student?.device_user_id ? "pushed" : "pending";
  return student?.device_user_id ? "pushed" : "pending";
};

function resolveStudentClassName(student: any) {
  const activeEnrollment = Array.isArray(student?.student_section_enrollments)
    ? student.student_section_enrollments.find((entry: any) => entry?.status === "active") ?? student.student_section_enrollments[0]
    : null;

  const sectionInfo = activeEnrollment?.section;
  const className = sectionInfo?.full_name || sectionInfo?.name || student?.class_name || student?.section_name || "Unassigned";
  return className || "Unassigned";
}

function fmtStudent(s: any) {
  const syncStatus = normalizeDeviceStudentStatus(s);
  return {
    id: s.id.toString(),
    first_name: s.first_name,
    last_name: s.last_name,
    full_name: `${s.first_name} ${s.last_name}`.trim(),
    student_id_number: s.student_id_number,
    device_user_id: s.device_user_id,
    device_sync_status: s.device_sync_status ?? null,
    sync_status: syncStatus,
    class_name: resolveStudentClassName(s),
    photo_url: s.photo_url ?? null,
    student_type: s.student_type ?? "day",
    gender: s.gender ?? null,
  };
}

/**
 * Assign device to location AND auto-push students to the linked tablet.
 * This is the main entry point used by DOD.
 * Returns assignment result + push summary.
 */
export const assignDeviceLocationAndPush = async (
  schoolId: string | number | bigint,
  deviceId: string,
  input: DeviceLocationInput & { group?: number; auto_push?: boolean },
  assignedBy: string | number | bigint
): Promise<{
  device: Awaited<ReturnType<typeof assignDeviceLocation>>;
  push?: { pushed: number; failed: number; groups: number; message: string };
}> => {
  // 1. Assign location
  const device = await assignDeviceLocation(schoolId, deviceId, input, assignedBy);

  if (!input.auto_push) return { device };

  // 2. Get students for this device
  const studentData = await getStudentsForDevice(schoolId, deviceId);

  // 3. Find tablet linked to this device
  const deviceRow = await prisma.devices.findFirst({
    where: { id: toBigInt(deviceId), school_id: toBigInt(schoolId) },
    select: { tablet_id: true },
  });

  if (!deviceRow?.tablet_id) {
    return {
      device,
      push: { pushed: 0, failed: 0, groups: studentData.groupCount, message: "Device not linked to a tablet — students not pushed" },
    };
  }

  // 4. Push the requested group (default group 1)
  const groupIndex = (input.group ?? 1) - 1;
  const targetGroup = studentData.groups[groupIndex];
  if (!targetGroup) {
    return {
      device,
      push: { pushed: 0, failed: 0, groups: studentData.groupCount, message: "Group not found" },
    };
  }

  // Use the same push service as /boarding/device-students. It allocates
  // missing device_user_id values before syncing instead of rejecting the
  // whole location assignment when a student has not been assigned one yet.
  const { pushStudentsToDevice } = await import("./device.service");
  const pushResult = await pushStudentsToDevice(
    schoolId,
    deviceId,
    {
      mode: "selected",
      student_ids: targetGroup.students.map((s: any) => s.id),
    }
  );

  const pushed = Number((pushResult as any).pushed_count ?? (pushResult as any).pushedCount ?? 0);
  const failed = Number((pushResult as any).failed_count ?? (pushResult as any).failedCount ?? 0);

  return {
    device,
    push: {
      pushed,
      failed,
      groups: studentData.groupCount,
      message: `Group ${groupIndex + 1}/${studentData.groupCount} pushed to ${pushed}/${targetGroup.students.length} students`,
    },
  };
};
