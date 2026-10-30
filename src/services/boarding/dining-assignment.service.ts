import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

const id = (value: string | number | bigint) => BigInt(value);

export const listAssignments = async (schoolId: string | number | bigint, teacherId?: string, date?: string) => {
  const day = date ? new Date(date) : new Date();
  const rows = await prisma.dining_teacher_assignments.findMany({
    where: { school_id: id(schoolId), ...(teacherId ? { teacher_id: id(teacherId) } : {}), start_date: { lte: day }, end_date: { gte: day } },
    include: { teacher: { select: { id: true, name: true, email: true } } },
    orderBy: [{ start_date: "desc" }, { teacher: { name: "asc" } }],
  });
  return rows.map(format);
};

export const createAssignment = async (schoolId: string | number | bigint, assignedBy: string | number | bigint, input: { teacher_id: string; gender_group: "boys" | "girls"; start_date: string; end_date: string }) => {
  if (input.end_date < input.start_date) throw new AppError("validation_error", "End date must be on or after start date", 400);
  // Timetable and duty assignment responsibilities are not limited to the
  // user's primary role. A school may assign any active school user to cover
  // a dining group, including users with secondary roles.
  const teacher = await prisma.users.findFirst({ where: { id: id(input.teacher_id), school_id: id(schoolId), deleted_at: null } });
  if (!teacher) throw new AppError("not_found", "Teacher not found", 404);
  const row = await prisma.dining_teacher_assignments.create({ data: { school_id: id(schoolId), teacher_id: teacher.id, gender_group: input.gender_group, start_date: new Date(input.start_date), end_date: new Date(input.end_date), assigned_by: id(assignedBy) }, include: { teacher: { select: { id: true, name: true, email: true } } } });
  return format(row);
};

export const removeAssignment = async (schoolId: string | number | bigint, assignmentId: string) => {
  const row = await prisma.dining_teacher_assignments.findFirst({ where: { id: id(assignmentId), school_id: id(schoolId) } });
  if (!row) throw new AppError("not_found", "Dining teacher assignment not found", 404);
  await prisma.dining_teacher_assignments.delete({ where: { id: row.id } });
  return { id: assignmentId };
};

export const isAssigned = async (schoolId: string | number | bigint, teacherId: string | number | bigint, genderGroup: string, date: Date) => Boolean(await prisma.dining_teacher_assignments.findFirst({ where: { school_id: id(schoolId), teacher_id: id(teacherId), gender_group: genderGroup, start_date: { lte: date }, end_date: { gte: date } } }));

const format = (row: any) => ({ id: row.id.toString(), teacher_id: row.teacher_id.toString(), teacher: row.teacher ? { ...row.teacher, id: row.teacher.id.toString() } : undefined, gender_group: row.gender_group, start_date: row.start_date.toISOString().slice(0, 10), end_date: row.end_date.toISOString().slice(0, 10) });
