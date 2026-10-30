import type { Prisma } from "@prisma/client";
import type { PaginationParams } from "../helpers/pagination";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

type TimetableSlotCreateInput = {
  section_id: string | number | bigint;
  subject_id: string | number | bigint;
  teacher_id: string | number | bigint;
  period_id: string | number | bigint;
  day_of_week: number;
  room?: string | null;
  term_id?: string | number | bigint | null;
};

type TimetableSlotUpdateInput = Partial<TimetableSlotCreateInput>;

type TimetableSlotFilters = {
  section_id?: string | number | bigint;
  subject_id?: string | number | bigint;
  teacher_id?: string | number | bigint;
  term_id?: string | number | bigint;
  include_deleted?: boolean;
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value);
};

type TimetableSlotRecord = {
  id: bigint;
  school_id: bigint;
  section_id: bigint;
  subject_id: bigint;
  teacher_id: bigint;
  period_id: bigint;
  day_of_week: number;
  room: string | null;
  term_id: bigint | null;
  deleted_at: Date | null;
};

const formatTimetableSlot = (record: TimetableSlotRecord) => ({
  ...record,
  id: record.id.toString(),
  school_id: record.school_id.toString(),
  section_id: record.section_id.toString(),
  subject_id: record.subject_id.toString(),
  teacher_id: record.teacher_id.toString(),
  period_id: record.period_id.toString(),
  term_id: record.term_id ? record.term_id.toString() : null
});

const resolveOrderBy = (sort?: string, order?: "asc" | "desc") => {
  const allowed = new Set(["day_of_week"]);
  if (sort && allowed.has(sort)) {
    return { [sort]: order ?? "asc" } as Record<string, "asc" | "desc">;
  }

  return { day_of_week: "asc" } as Record<string, "asc" | "desc">;
};

const assertTeacher = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  teacherId: string | number | bigint
) => {
  const teacher = await tx.users.findFirst({
    where: {
      id: toBigInt(teacherId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!teacher) {
    throw new AppError("not_found", "Teacher not found", 404);
  }

  return teacher;
};

const assertSection = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  sectionId: string | number | bigint
) => {
  const section = await tx.sections.findFirst({
    where: {
      id: toBigInt(sectionId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!section) {
    throw new AppError("not_found", "Section not found", 404);
  }

  return section;
};

const assertSubject = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  subjectId: string | number | bigint
) => {
  const subject = await tx.subjects.findFirst({
    where: {
      id: toBigInt(subjectId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!subject) {
    throw new AppError("not_found", "Subject not found", 404);
  }

  return subject;
};

const assertPeriod = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  periodId: string | number | bigint
) => {
  const period = await tx.timetable_periods.findFirst({
    where: {
      id: toBigInt(periodId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!period) {
    throw new AppError("not_found", "Period not found", 404);
  }

  return period;
};

const assertTerm = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  termId: string | number | bigint
) => {
  const term = await tx.terms.findFirst({
    where: {
      id: toBigInt(termId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!term) {
    throw new AppError("not_found", "Term not found", 404);
  }

  return term;
};

const assertTeacherAvailability = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  teacherId: string | number | bigint,
  periodId: string | number | bigint,
  dayOfWeek: number,
  excludeSlotId?: string | number | bigint,
  termId?: string | number | bigint | null
) => {
  const conflictingSlot = await tx.timetable_slots.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      teacher_id: toBigInt(teacherId),
      period_id: toBigInt(periodId),
      day_of_week: dayOfWeek,
      deleted_at: null,
      ...(termId !== undefined ? { term_id: termId === null ? null : toBigInt(termId) } : {}),
      ...(excludeSlotId !== undefined ? { id: { not: toBigInt(excludeSlotId) } } : {})
    },
    select: { id: true }
  });

  if (conflictingSlot) {
    throw new AppError(
      "conflict",
      "This teacher is already assigned to another class during this period",
      409
    );
  }
};

export const createTimetableSlot = async (
  schoolId: string | number | bigint,
  input: TimetableSlotCreateInput
) =>
  prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const teacher = await assertTeacher(tx, schoolId, input.teacher_id);
    const section = await assertSection(tx, schoolId, input.section_id);
    const subject = await assertSubject(tx, schoolId, input.subject_id);
    const period = await assertPeriod(tx, schoolId, input.period_id);
    const termId = input.term_id ? toBigInt(input.term_id) : null;

    if (input.term_id) {
      await assertTerm(tx, schoolId, input.term_id);
    }

    await assertTeacherAvailability(
      tx,
      schoolId,
      teacher.id,
      period.id,
      input.day_of_week,
      undefined,
      input.term_id
    );

    const created = await tx.timetable_slots.create({
      data: {
        school_id: toBigInt(schoolId),
        teacher_id: teacher.id,
        section_id: section.id,
        subject_id: subject.id,
        period_id: period.id,
        day_of_week: input.day_of_week,
        room: input.room ?? null,
        term_id: termId ?? undefined
      }
    });

    return formatTimetableSlot(created);
  });

export const findAllTimetableSlots = async (
  schoolId: string | number | bigint,
  pagination: PaginationParams,
  filters: TimetableSlotFilters = {}
) => {
  const { page, limit, sort, order } = pagination;
  const where: Record<string, unknown> = {
    school_id: toBigInt(schoolId),
    deleted_at: filters.include_deleted ? undefined : null
  };

  if (filters.section_id) where.section_id = toBigInt(filters.section_id);
  if (filters.subject_id) where.subject_id = toBigInt(filters.subject_id);
  if (filters.teacher_id) where.teacher_id = toBigInt(filters.teacher_id);
  if (filters.term_id === "legacy") where.term_id = null;
  else if (filters.term_id) where.term_id = toBigInt(filters.term_id);

  const [items, total] = await prisma.$transaction([
    prisma.timetable_slots.findMany({
      where,
      orderBy: resolveOrderBy(sort, order),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.timetable_slots.count({ where })
  ]);

  return {
    data: items.map((item: TimetableSlotRecord) => formatTimetableSlot(item)),
    meta: {
      page,
      limit,
      total
    }
  };
};

export const findTimetableSlotById = async (
  schoolId: string | number | bigint,
  id: string
) => {
  if (!/^\d+$/.test(id)) {
    throw new AppError("bad_request", "Invalid timetable slot id", 400);
  }

  const record = await prisma.timetable_slots.findFirst({
    where: {
      id: toBigInt(id),
      school_id: toBigInt(schoolId),
      deleted_at: null
    }
  });

  if (!record) {
    throw new AppError("not_found", "Timetable slot not found", 404);
  }

  return formatTimetableSlot(record);
};

export const updateTimetableSlot = async (
  schoolId: string | number | bigint,
  id: string,
  input: TimetableSlotUpdateInput
) =>
  prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid timetable slot id", 400);
    }

    const existing = await tx.timetable_slots.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Timetable slot not found", 404);
    }

    const teacherId = input.teacher_id ? toBigInt(input.teacher_id) : existing.teacher_id;
    const sectionId = input.section_id ? toBigInt(input.section_id) : existing.section_id;
    const subjectId = input.subject_id ? toBigInt(input.subject_id) : existing.subject_id;
    const periodId = input.period_id ? toBigInt(input.period_id) : existing.period_id;
    const termId = input.term_id ? toBigInt(input.term_id) : existing.term_id;

    if (input.teacher_id) await assertTeacher(tx, schoolId, input.teacher_id);
    if (input.section_id) await assertSection(tx, schoolId, input.section_id);
    if (input.subject_id) await assertSubject(tx, schoolId, input.subject_id);
    if (input.period_id) await assertPeriod(tx, schoolId, input.period_id);
    if (input.term_id) await assertTerm(tx, schoolId, input.term_id);

    await assertTeacherAvailability(
      tx,
      schoolId,
      teacherId,
      periodId,
      input.day_of_week ?? existing.day_of_week,
      existing.id,
      input.term_id !== undefined ? input.term_id : existing.term_id
    );

    const updated = await tx.timetable_slots.update({
      where: { id: existing.id },
      data: {
        teacher_id: teacherId,
        section_id: sectionId,
        subject_id: subjectId,
        period_id: periodId,
        day_of_week: input.day_of_week ?? existing.day_of_week,
        room: input.room !== undefined ? input.room : undefined,
        term_id: termId ?? undefined
      }
    });

    return formatTimetableSlot(updated);
  });

export const softDeleteTimetableSlot = async (
  schoolId: string | number | bigint,
  id: string
) =>
  prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!/^\d+$/.test(id)) {
      throw new AppError("bad_request", "Invalid timetable slot id", 400);
    }

    const existing = await tx.timetable_slots.findFirst({
      where: {
        id: toBigInt(id),
        school_id: toBigInt(schoolId),
        deleted_at: null
      }
    });

    if (!existing) {
      throw new AppError("not_found", "Timetable slot not found", 404);
    }

    const deleted = await tx.timetable_slots.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() }
    });

    return formatTimetableSlot(deleted);
  });

// ─── Combined Classes (bulk create) ─────────────────────────────────────────
// Creates one timetable slot per section for the same teacher/subject/period/day.
// Used when multiple streams share one lesson (e.g. S-4A + S-4B + S-4C).
//
// Teacher availability check: only blocks if the teacher is ALREADY assigned
// to a different slot at that period/day outside this batch — the slots inside
// this batch legitimately share the teacher (combined lesson).

type BulkCreateInput = {
  section_ids: Array<string | number | bigint>;
  subject_id: string | number | bigint;
  teacher_id: string | number | bigint;
  period_id: string | number | bigint;
  day_of_week: number;
  room?: string | null;
  term_id?: string | number | bigint | null;
};

export const bulkCreateTimetableSlots = async (
  schoolId: string | number | bigint,
  input: BulkCreateInput
): Promise<{ created: ReturnType<typeof formatTimetableSlot>[]; skipped: string[] }> => {
  if (!input.section_ids || input.section_ids.length === 0) {
    throw new AppError("bad_request", "section_ids must be a non-empty array", 400);
  }
  if (!input.term_id) {
    throw new AppError("bad_request", "A term is required for combined classes. Create/select an academic term before assigning this timetable.", 400);
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const teacher = await assertTeacher(tx, schoolId, input.teacher_id);
    const subject = await assertSubject(tx, schoolId, input.subject_id);
    const period  = await assertPeriod(tx, schoolId, input.period_id);
    const termId  = input.term_id ? toBigInt(input.term_id) : null;

    if (input.term_id) await assertTerm(tx, schoolId, input.term_id);

    // Check if teacher has a conflicting slot OUTSIDE this batch at this period/day.
    // Slots within this batch (combined lesson) share the teacher intentionally.
    const existingConflict = await tx.timetable_slots.findFirst({
      where: {
        school_id: toBigInt(schoolId),
        teacher_id: teacher.id,
        period_id: period.id,
        day_of_week: input.day_of_week,
        deleted_at: null,
        term_id: termId,
        // Only conflict if it's for a section NOT in this batch
        section_id: { notIn: input.section_ids.map((id) => toBigInt(id)) }
      },
      select: { id: true }
    });

    if (existingConflict) {
      throw new AppError(
        "conflict",
        "This teacher is already assigned to a different class during this period on this day",
        409
      );
    }

    const created: ReturnType<typeof formatTimetableSlot>[] = [];
    const skipped: string[] = [];

    for (const rawSectionId of input.section_ids) {
      const section = await tx.sections.findFirst({
        where: {
          id: toBigInt(rawSectionId),
          school_id: toBigInt(schoolId),
          deleted_at: null
        }
      });

      if (!section) {
        skipped.push(`Section ${rawSectionId} not found`);
        continue;
      }

      // Skip if an identical slot already exists (idempotent)
      const alreadyExists = await tx.timetable_slots.findFirst({
        where: {
          school_id: toBigInt(schoolId),
          section_id: section.id,
          period_id: period.id,
          day_of_week: input.day_of_week,
          term_id: termId,
          deleted_at: null
        },
        select: { id: true }
      });

      if (alreadyExists) {
        skipped.push(`Section ${section.id} already has a slot for this period on this day`);
        continue;
      }

      const slot = await tx.timetable_slots.create({
        data: {
          school_id: toBigInt(schoolId),
          teacher_id: teacher.id,
          section_id: section.id,
          subject_id: subject.id,
          period_id: period.id,
          day_of_week: input.day_of_week,
          room: input.room ?? null,
          term_id: termId ?? undefined
        }
      });

      created.push(formatTimetableSlot(slot));
    }

    return { created, skipped };
  });
};

// ─── DOS Auto-Generate Timetable ─────────────────────────────────────────────
// Accepts a template describing the full week and bulk-creates all slots.
// Existing slots that would conflict are skipped (not overwritten) — safe to
// call multiple times; it fills gaps rather than replacing the whole timetable.
//
// Template entry shape:
//   { section_id, subject_id, teacher_id, period_id, days: number[] }
//   days: array of day_of_week values (1=Mon … 7=Sun)
//
// Returns { created_count, skipped_count, errors[] }

export const copyLegacyTimetable = async (
  schoolId: string | number | bigint,
  targetTermId: string | number | bigint
): Promise<{
  source_count: number;
  created_count: number;
  skipped_count: number;
  conflicts: string[];
}> => {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const schoolKey = toBigInt(schoolId);
    const termId = toBigInt(targetTermId);
    await assertTerm(tx, schoolId, targetTermId);

    const sourceSlots = await tx.timetable_slots.findMany({
      where: { school_id: schoolKey, term_id: null, deleted_at: null },
      orderBy: [{ section_id: "asc" }, { day_of_week: "asc" }, { period_id: "asc" }]
    });
    const targetSlots = await tx.timetable_slots.findMany({
      where: { school_id: schoolKey, term_id: termId, deleted_at: null }
    });
    const conflicts: string[] = [];
    let createdCount = 0;
    let skippedCount = 0;
    const copiedTeacherGroups = new Set<string>();
    const targetKey = (slot: { section_id: bigint; period_id: bigint; day_of_week: number }) =>
      `${slot.section_id}:${slot.period_id}:${slot.day_of_week}`;
    const teacherGroupKey = (slot: { teacher_id: bigint; period_id: bigint; day_of_week: number }) =>
      `${slot.teacher_id}:${slot.period_id}:${slot.day_of_week}`;
    const targetByKey = new Map(targetSlots.map((slot) => [targetKey(slot), slot]));

    for (const sourceSlot of sourceSlots) {
      const key = targetKey(sourceSlot);
      const existingForSection = targetByKey.get(key);
      if (existingForSection) {
        if (existingForSection.teacher_id === sourceSlot.teacher_id) {
          copiedTeacherGroups.add(teacherGroupKey(sourceSlot));
        }
        skippedCount++;
        continue;
      }

      const teacherConflict = targetSlots.find(
        (slot) =>
          slot.teacher_id === sourceSlot.teacher_id &&
          slot.period_id === sourceSlot.period_id &&
          slot.day_of_week === sourceSlot.day_of_week &&
          slot.section_id !== sourceSlot.section_id
      );
      if (teacherConflict && !copiedTeacherGroups.has(teacherGroupKey(sourceSlot))) {
        conflicts.push(
          `Section ${sourceSlot.section_id} ${sourceSlot.day_of_week}/${sourceSlot.period_id}: teacher is already assigned in the selected term`
        );
        skippedCount++;
        continue;
      }

      const created = await tx.timetable_slots.create({
        data: {
          school_id: schoolKey,
          section_id: sourceSlot.section_id,
          subject_id: sourceSlot.subject_id,
          teacher_id: sourceSlot.teacher_id,
          period_id: sourceSlot.period_id,
          day_of_week: sourceSlot.day_of_week,
          room: sourceSlot.room,
          term_id: termId
        }
      });
      targetSlots.push(created);
      targetByKey.set(key, created);
      copiedTeacherGroups.add(teacherGroupKey(sourceSlot));
      createdCount++;
    }

    return {
      source_count: sourceSlots.length,
      created_count: createdCount,
      skipped_count: skippedCount,
      conflicts
    };
  });
};

type GenerateTemplateEntry = {
  section_id: string | number | bigint;
  subject_id: string | number | bigint;
  teacher_id: string | number | bigint;
  period_id: string | number | bigint;
  days: number[];              // 1–7; typically [1,2,3,4,5] = Mon–Fri
  room?: string | null;
  term_id?: string | number | bigint;
};

type GenerateInput = {
  entries: GenerateTemplateEntry[];
  overwrite_existing?: boolean; // default false — skip conflicts rather than replacing
};

export const generateTimetableSlots = async (
  schoolId: string | number | bigint,
  input: GenerateInput
): Promise<{ created_count: number; skipped_count: number; errors: string[] }> => {
  if (!input.entries || input.entries.length === 0) {
    throw new AppError("bad_request", "entries must be a non-empty array", 400);
  }

  let createdCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  // Process each entry sequentially to give clear per-entry error messages
  for (const entry of input.entries) {
    if (!entry.days || entry.days.length === 0) {
      errors.push(`Entry for section ${entry.section_id} has no days specified — skipped`);
      skippedCount++;
      continue;
    }

    for (const day of entry.days) {
      try {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const teacher = await assertTeacher(tx, schoolId, entry.teacher_id);
          const section = await assertSection(tx, schoolId, entry.section_id);
          const subject = await assertSubject(tx, schoolId, entry.subject_id);
          const period  = await assertPeriod(tx, schoolId, entry.period_id);
          const termId  = entry.term_id ? toBigInt(entry.term_id) : null;

          if (entry.term_id) await assertTerm(tx, schoolId, entry.term_id);

          // Check for existing slot on this section + period + day
          const existingSection = await tx.timetable_slots.findFirst({
            where: {
              school_id: toBigInt(schoolId),
              section_id: section.id,
              period_id: period.id,
              day_of_week: day,
              deleted_at: null
            },
            select: { id: true }
          });

          if (existingSection) {
            if (input.overwrite_existing) {
              // Soft-delete existing then re-create
              await tx.timetable_slots.update({
                where: { id: existingSection.id },
                data: { deleted_at: new Date() }
              });
            } else {
              // Skip — don't overwrite existing
              skippedCount++;
              return;
            }
          }

          // Check teacher availability on this day/period (other sections)
          const teacherConflict = await tx.timetable_slots.findFirst({
            where: {
              school_id: toBigInt(schoolId),
              teacher_id: teacher.id,
              period_id: period.id,
              day_of_week: day,
              deleted_at: null,
              section_id: { not: section.id }
            },
            select: { id: true }
          });

          if (teacherConflict) {
            errors.push(
              `Teacher conflict: section ${section.id}, period ${period.id}, day ${day} — teacher already assigned elsewhere`
            );
            skippedCount++;
            return;
          }

          await tx.timetable_slots.create({
            data: {
              school_id: toBigInt(schoolId),
              teacher_id: teacher.id,
              section_id: section.id,
              subject_id: subject.id,
              period_id: period.id,
              day_of_week: day,
              room: entry.room ?? null,
              term_id: termId ?? undefined
            }
          });

          createdCount++;
        });
      } catch (err) {
        const msg = err instanceof AppError ? err.message : (err instanceof Error ? err.message : "Unknown error");
        errors.push(`Section ${entry.section_id} day ${day}: ${msg}`);
        skippedCount++;
      }
    }
  }

  return { created_count: createdCount, skipped_count: skippedCount, errors };
};
