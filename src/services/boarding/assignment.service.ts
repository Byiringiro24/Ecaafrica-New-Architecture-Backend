import type { Prisma, student_dorm_assignments } from "@prisma/client";
import { DormGender, Gender, StudentType } from "@prisma/client";
import type { PaginationParams } from "../../helpers/pagination";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";

type DormAssignmentCreateInput = {
  student_id: string | number | bigint;
  dormitory_id: string | number | bigint;
  room_id?: string | number | bigint;
  bed_number?: string;
  academic_year_id: string | number | bigint;
  assigned_at: string | Date;
  left_at?: string | Date | null;
};

type DormAssignmentUpdateInput = {
  student_id?: string | number | bigint;
  dormitory_id?: string | number | bigint;
  room_id?: string | number | bigint | null;
  bed_number?: string | null;
  academic_year_id?: string | number | bigint;
  assigned_at?: string | Date;
  left_at?: string | Date | null;
};

type DormAssignmentFilters = {
  student_id?: string | number | bigint;
  dormitory_id?: string | number | bigint;
  room_id?: string | number | bigint;
  academic_year_id?: string | number | bigint;
  is_active?: boolean;
  dormitory_ids?: bigint[];
  class_id?: string | number | bigint;
};

/** Students available to a patron/matron when placing boarding students. */
export const listBoardingStudentsForAssignment = async (
  schoolId: string | number | bigint,
  role?: string,
) => {
  const gender =
    role === "patron"
      ? Gender.male
      : role === "matron"
        ? Gender.female
        : undefined;
  const students = await prisma.students.findMany({
    where: {
      school_id: toBigInt(schoolId),
      student_type: StudentType.boarding,
      deleted_at: null,
      status: "active",
      ...(gender ? { gender } : {}),
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      other_names: true,
      student_id_number: true,
      gender: true,
      photo_url: true,
      boarding_status: true,
      student_section_enrollments: {
        where: { status: "active" },
        orderBy: { enrolled_at: "desc" },
        take: 1,
        select: {
          section: { select: { id: true, name: true, full_name: true, class_id: true } },
        },
      },
    },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  return students.map((student) => {
    const section = student.student_section_enrollments[0]?.section;
    const { student_section_enrollments: _enrollments, ...studentData } = student;
    return {
      ...studentData,
      id: student.id.toString(),
      class_id: section?.class_id?.toString() ?? null,
      class_name: section?.full_name ?? section?.name ?? null,
    };
  });
};

export const createDormAssignments = async (
  schoolId: string | number | bigint,
  inputs: Array<{
    student_id: string | number | bigint;
    dormitory_id: string | number | bigint;
    academic_year_id: string | number | bigint;
    assigned_at: string | Date;
  }>,
) => {
  const created = [];
  for (const input of inputs) {
    created.push(await createDormAssignment(schoolId, input));
  }
  return created;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const toDateValue = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const formatAssignment = (record: student_dorm_assignments) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  student_id: record.student_id.toString(),
  dormitory_id: record.dormitory_id.toString(),
  room_id: record.room_id ? record.room_id.toString() : null,
  academic_year_id: record.academic_year_id.toString(),
});

type AssignmentWithRelations = student_dorm_assignments & {
  dormitory?: {
    id: bigint;
    name: string;
    gender: DormGender;
    capacity: number;
  } | null;
  room?: { id: bigint; room_number: string; capacity: number } | null;
  student?: {
    id: bigint;
    first_name: string;
    last_name: string;
    student_id_number: string | null;
    photo_url: string | null;
  } | null;
};

const formatAssignmentWithRelations = (record: AssignmentWithRelations) => {
  const { dormitory, room, student, ...base } = record;
  return {
    ...formatAssignment(base as student_dorm_assignments),
    dormitory: dormitory
      ? {
          id: dormitory.id.toString(),
          name: dormitory.name,
          gender: dormitory.gender,
          capacity: dormitory.capacity,
        }
      : null,
    room: room
      ? {
          id: room.id.toString(),
          room_number: room.room_number,
          capacity: room.capacity,
        }
      : null,
    student: student
      ? {
          id: student.id.toString(),
          first_name: student.first_name,
          last_name: student.last_name,
          full_name: `${student.first_name} ${student.last_name}`.trim(),
          student_id_number: student.student_id_number,
          photo_url: student.photo_url,
        }
      : null,
  };
};

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["created_at", "assigned_at", "left_at"]);
  if (sort && allowed.has(sort)) {
    return {
      [sort]: order ?? "desc",
    } as Prisma.student_dorm_assignmentsOrderByWithRelationInput;
  }
  return {
    assigned_at: "desc",
  } as Prisma.student_dorm_assignmentsOrderByWithRelationInput;
};

const assertStudentBoarding = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
) => {
  const student = await tx.students.findFirst({
    where: {
      id: toBigInt(studentId),
      school_id: toBigInt(schoolId),
      deleted_at: null,
    },
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  if (student.student_type !== StudentType.boarding) {
    throw new AppError("bad_request", "Student is not a boarding student", 400);
  }

  return student;
};

const assertAcademicYear = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  academicYearId: string | number | bigint,
) => {
  const year = await tx.academic_years.findFirst({
    where: {
      id: toBigInt(academicYearId),
      school_id: toBigInt(schoolId),
      deleted_at: null,
    },
  });

  if (!year) {
    throw new AppError("not_found", "Academic year not found", 404);
  }

  return year;
};

const assertDormitory = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  dormitoryId: string | number | bigint,
) => {
  const dormitory = await tx.dormitories.findFirst({
    where: {
      id: toBigInt(dormitoryId),
      school_id: toBigInt(schoolId),
    },
  });

  if (!dormitory) {
    throw new AppError("not_found", "Dormitory not found", 404);
  }

  return dormitory;
};

const assertRoom = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  roomId: string | number | bigint,
) => {
  const room = await tx.dorm_rooms.findFirst({
    where: {
      id: toBigInt(roomId),
      school_id: toBigInt(schoolId),
    },
  });

  if (!room) {
    throw new AppError("not_found", "Dorm room not found", 404);
  }

  return room;
};

const assertGenderMatch = (
  studentGender: Gender | null,
  dormitoryGender: DormGender,
  dormitoryName: string,
) => {
  // Gender has male|female|other while DormGender only has male|female.
  // Treat "other" and null as unconstrained so existing records stay assignable.
  if (studentGender !== Gender.male && studentGender !== Gender.female) return;

  if (String(studentGender) !== String(dormitoryGender)) {
    throw new AppError(
      "bad_request",
      `Cannot assign a ${studentGender} student to ${dormitoryName}, a ${dormitoryGender} dormitory`,
      400,
    );
  }
};

const assertDormitoryCapacity = async (
  tx: Prisma.TransactionClient,
  dormitoryId: string | number | bigint,
  capacity: number,
  excludeAssignmentId?: bigint,
) => {
  const count = await tx.student_dorm_assignments.count({
    where: {
      dormitory_id: toBigInt(dormitoryId),
      left_at: null,
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
  });

  if (count >= capacity) {
    throw new AppError("conflict", "Dormitory capacity exceeded", 409);
  }
};

const assertRoomCapacity = async (
  tx: Prisma.TransactionClient,
  roomId: string | number | bigint,
  capacity: number,
  excludeAssignmentId?: bigint,
) => {
  const count = await tx.student_dorm_assignments.count({
    where: {
      room_id: toBigInt(roomId),
      left_at: null,
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
  });

  if (count >= capacity) {
    throw new AppError("conflict", "Dorm room capacity exceeded", 409);
  }
};

const assertAssignmentUnique = async (
  tx: Prisma.TransactionClient,
  studentId: string | number | bigint,
  academicYearId: string | number | bigint,
  excludeAssignmentId?: bigint,
) => {
  const duplicate = await tx.student_dorm_assignments.findFirst({
    where: {
      student_id: toBigInt(studentId),
      academic_year_id: toBigInt(academicYearId),
      left_at: null,
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
  });

  if (duplicate) {
    throw new AppError(
      "conflict",
      "Student already has an active dormitory assignment for this academic year",
      409,
    );
  }
};

export const createDormAssignment = async (
  schoolId: string | number | bigint,
  input: DormAssignmentCreateInput,
) =>
  prisma.$transaction(async (tx) => {
    const student = await assertStudentBoarding(tx, schoolId, input.student_id);
    await assertAcademicYear(tx, schoolId, input.academic_year_id);
    const dormitory = await assertDormitory(tx, schoolId, input.dormitory_id);

    assertGenderMatch(student.gender, dormitory.gender, dormitory.name);

    if (input.room_id) {
      const room = await assertRoom(tx, schoolId, input.room_id);
      if (room.dormitory_id !== dormitory.id) {
        throw new AppError(
          "bad_request",
          "Dorm room does not belong to dormitory",
          400,
        );
      }
      await assertRoomCapacity(tx, input.room_id, room.capacity);
    }

    await assertAssignmentUnique(tx, input.student_id, input.academic_year_id);
    await assertDormitoryCapacity(tx, input.dormitory_id, dormitory.capacity);

    const data = {
      school_id: toBigInt(schoolId),
      student_id: toBigInt(input.student_id),
      dormitory_id: toBigInt(input.dormitory_id),
      room_id: input.room_id ? toBigInt(input.room_id) : null,
      bed_number: input.bed_number ?? null,
      academic_year_id: toBigInt(input.academic_year_id),
      assigned_at: toDateValue(input.assigned_at),
      left_at: input.left_at ? toDateValue(input.left_at) : null,
    };

    // (student_id, academic_year_id) is unique in the database regardless of
    // left_at, so a student who was released still owns that row. Reuse it
    // rather than failing the insert.
    const released = await tx.student_dorm_assignments.findFirst({
      where: {
        student_id: data.student_id,
        academic_year_id: data.academic_year_id,
      },
    });

    const created = released
      ? await tx.student_dorm_assignments.update({
          where: { id: released.id },
          data,
        })
      : await tx.student_dorm_assignments.create({ data });

    return formatAssignment(created);
  });

// Fire-and-forget: after a new dorm assignment, push the student to any
// device whose location_scope = "dormitory" and dormitory_id matches.
const autoPushStudentToDevices = async (
  schoolId: bigint,
  studentId: bigint,
  dormitoryId: bigint,
) => {
  try {
    // Find devices linked to this dormitory
    const devices = await prisma.devices.findMany({
      where: {
        school_id: schoolId,
        dormitory_id: dormitoryId,
        location_scope: "dormitory",
        is_active: true,
      },
      include: { tablet: { select: { id: true, url: true } } },
    });

    if (!devices.length) return;

    const student = await prisma.students.findFirst({
      where: { id: studentId, school_id: schoolId, deleted_at: null },
      select: { id: true, first_name: true, last_name: true, student_id_number: true, device_user_id: true },
    });
    if (!student) return;

    const userId = student.device_user_id;
    if (!userId) {
      logger.warn(`[autoPush] Student ${student.id} has no device_user_id assigned; skipping auto-push`);
      return;
    }
    const name = `${student.first_name} ${student.last_name}`.trim();

    // Lazy import to avoid circular dependency
    const { default: tabletService } = await import("../tablet.service");

    for (const device of devices) {
      if (!device.tablet_id) continue;
      try {
        await tabletService.pushStudentsToDevice(device.tablet_id, schoolId, {
          mode: "selected",
          student_ids: [studentId.toString()],
        });
        logger.info(`[autoPush] Student ${userId} pushed to device ${device.name} after dorm assignment`);
      } catch (err) {
        logger.warn(`[autoPush] Failed to push student ${userId} to device ${device.name}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    logger.warn(`[autoPush] Error in autoPushStudentToDevices: ${(err as Error).message}`);
  }
};

export const createDormAssignmentAndAutoPush = async (
  schoolId: string | number | bigint,
  input: DormAssignmentCreateInput,
) => {
  const result = await createDormAssignment(schoolId, input);
  // Non-blocking auto-push — don't let device push failure block the assignment response
  void autoPushStudentToDevices(
    toBigInt(schoolId),
    toBigInt(input.student_id),
    toBigInt(input.dormitory_id),
  );
  return result;
};

export const listDormAssignments = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: DormAssignmentFilters = {},
) => {
  const { page, limit, sort, order } = pagination;
  const where: Prisma.student_dorm_assignmentsWhereInput = {
    school_id: toBigInt(schoolId),
  };

  if (filters.student_id) where.student_id = toBigInt(filters.student_id);
  if (filters.dormitory_id) where.dormitory_id = toBigInt(filters.dormitory_id);
  if (filters.dormitory_ids) where.dormitory_id = { in: filters.dormitory_ids };
  if (filters.room_id) where.room_id = toBigInt(filters.room_id);
  if (filters.academic_year_id) {
    where.academic_year_id = toBigInt(filters.academic_year_id);
  }
  if (filters.is_active !== undefined) {
    where.left_at = filters.is_active ? null : { not: null };
  }
  if (filters.class_id) {
    where.student = { student_section_enrollments: { some: { status: "active", section: { class_id: toBigInt(filters.class_id) } } } };
  }

  const [items, total] = await prisma.$transaction([
    prisma.student_dorm_assignments.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit,
      include: {
        student: {
          select: { id: true, first_name: true, last_name: true, student_id_number: true, photo_url: true },
        },
        dormitory: {
          select: { id: true, name: true, gender: true, capacity: true },
        },
        room: { select: { id: true, room_number: true, capacity: true } },
      },
    }),
    prisma.student_dorm_assignments.count({ where }),
  ]);

  return {
    data: items.map((item) => formatAssignmentWithRelations(item)),
    meta: { page, limit, total },
  };
};

export const findDormAssignmentById = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid dorm assignment id", 400);
  }

  const record = await prisma.student_dorm_assignments.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!record) {
    throw new AppError("not_found", "Dorm assignment not found", 404);
  }

  return formatAssignment(record);
};

export const updateDormAssignment = async (
  schoolId: string | number | bigint,
  id: string,
  input: DormAssignmentUpdateInput,
) =>
  prisma.$transaction(async (tx) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid dorm assignment id", 400);
    }

    const existing = await tx.student_dorm_assignments.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
      },
    });

    if (!existing) {
      throw new AppError("not_found", "Dorm assignment not found", 404);
    }

    const studentId = input.student_id ?? existing.student_id;
    const dormitoryId = input.dormitory_id ?? existing.dormitory_id;
    const roomId =
      input.room_id === undefined ? existing.room_id : input.room_id;
    const academicYearId = input.academic_year_id ?? existing.academic_year_id;

    if (input.student_id) {
      await assertStudentBoarding(tx, schoolId, input.student_id);
    }

    if (input.academic_year_id) {
      await assertAcademicYear(tx, schoolId, input.academic_year_id);
    }

    if (input.dormitory_id) {
      await assertDormitory(tx, schoolId, input.dormitory_id);
    }

    if (input.student_id || input.academic_year_id) {
      await assertAssignmentUnique(tx, studentId, academicYearId, existing.id);
    }

    // Re-validate placement whenever the student or the dormitory changes, and
    // only while the assignment is active (releasing a student frees the bed).
    const isActive =
      input.left_at === undefined
        ? existing.left_at === null
        : input.left_at === null;

    if (isActive && (input.student_id || input.dormitory_id)) {
      const student = await tx.students.findFirst({
        where: { id: toBigInt(studentId) },
      });
      const dormitory = await tx.dormitories.findFirst({
        where: { id: toBigInt(dormitoryId) },
      });

      if (student && dormitory) {
        assertGenderMatch(student.gender, dormitory.gender, dormitory.name);
        await assertDormitoryCapacity(
          tx,
          dormitoryId,
          dormitory.capacity,
          existing.id,
        );
      }
    }

    if (roomId) {
      const room = await assertRoom(tx, schoolId, roomId);
      if (room.dormitory_id !== dormitoryId) {
        throw new AppError(
          "bad_request",
          "Dorm room does not belong to dormitory",
          400,
        );
      }
      await assertRoomCapacity(tx, roomId, room.capacity, existing.id);
    }

    const updated = await tx.student_dorm_assignments.update({
      where: { id: existing.id },
      data: {
        student_id: input.student_id ? toBigInt(input.student_id) : undefined,
        dormitory_id: input.dormitory_id
          ? toBigInt(input.dormitory_id)
          : undefined,
        room_id:
          input.room_id === undefined
            ? undefined
            : input.room_id
              ? toBigInt(input.room_id)
              : null,
        bed_number:
          input.bed_number === undefined ? undefined : input.bed_number,
        academic_year_id: input.academic_year_id
          ? toBigInt(input.academic_year_id)
          : undefined,
        assigned_at: input.assigned_at
          ? toDateValue(input.assigned_at)
          : undefined,
        left_at:
          input.left_at === undefined
            ? undefined
            : input.left_at
              ? toDateValue(input.left_at)
              : null,
      },
    });

    return formatAssignment(updated);
  });

export const deleteDormAssignment = async (
  schoolId: string | number | bigint,
  id: string,
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid dorm assignment id", 400);
  }

  const existing = await prisma.student_dorm_assignments.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
    },
  });

  if (!existing) {
    throw new AppError("not_found", "Dorm assignment not found", 404);
  }

  await prisma.student_dorm_assignments.delete({ where: { id: existing.id } });
  return formatAssignment(existing);
};
