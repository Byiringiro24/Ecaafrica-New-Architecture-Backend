import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

const id = (value: string | number | bigint) => BigInt(value);
const formatExamType = (row: any) => ({ ...row, id: row.id.toString(), school_id: row.school_id.toString() });
const formatRole = (row: any) => ({
  ...row,
  id: row.id.toString(),
  school_id: row.school_id.toString(),
  min_percentage: row.min_percentage.toString(),
  max_percentage: row.max_percentage.toString()
});

export const listExamTypes = async (schoolId: string, includeInactive = false) => {
  const rows = await prisma.exam_types.findMany({
    where: { school_id: id(schoolId), ...(includeInactive ? {} : { is_active: true }) },
    orderBy: [{ is_active: "desc" }, { name: "asc" }]
  });
  return rows.map(formatExamType);
};

export const createExamType = async (schoolId: string, input: any) => {
  try {
    return formatExamType(await prisma.exam_types.create({
      data: { school_id: id(schoolId), name: input.name.trim(), description: input.description?.trim() || null, is_active: input.is_active ?? true }
    }));
  } catch (error: any) {
    if (error?.code === "P2002") throw new AppError("conflict", "An exam type with this name already exists", 409);
    throw error;
  }
};

export const updateExamType = async (schoolId: string, typeId: string, input: any) => {
  const existing = await prisma.exam_types.findFirst({ where: { id: id(typeId), school_id: id(schoolId) } });
  if (!existing) throw new AppError("not_found", "Exam type not found", 404);
  try {
    return formatExamType(await prisma.exam_types.update({
      where: { id: existing.id },
      data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}), ...(input.is_active !== undefined ? { is_active: input.is_active } : {}) }
    }));
  } catch (error: any) {
    if (error?.code === "P2002") throw new AppError("conflict", "An exam type with this name already exists", 409);
    throw error;
  }
};

export const listGradingRoles = async (schoolId: string, includeInactive = false) => {
  const rows = await prisma.grading_roles.findMany({
    where: { school_id: id(schoolId), ...(includeInactive ? {} : { is_active: true }) },
    orderBy: [{ min_percentage: "desc" }, { sort_order: "asc" }]
  });
  return rows.map(formatRole);
};

export const createGradingRole = async (schoolId: string, input: any) => {
  try {
    return formatRole(await prisma.grading_roles.create({
      data: { school_id: id(schoolId), code: input.code.trim().toUpperCase(), label: input.label.trim(), min_percentage: String(input.min_percentage), max_percentage: String(input.max_percentage), sort_order: input.sort_order ?? 0, is_active: input.is_active ?? true }
    }));
  } catch (error: any) {
    if (error?.code === "P2002") throw new AppError("conflict", "A grading role with this code already exists", 409);
    throw error;
  }
};

export const updateGradingRole = async (schoolId: string, roleId: string, input: any) => {
  const existing = await prisma.grading_roles.findFirst({ where: { id: id(roleId), school_id: id(schoolId) } });
  if (!existing) throw new AppError("not_found", "Grading role not found", 404);
  try {
    return formatRole(await prisma.grading_roles.update({
      where: { id: existing.id },
      data: {
        ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.min_percentage !== undefined ? { min_percentage: String(input.min_percentage) } : {}),
        ...(input.max_percentage !== undefined ? { max_percentage: String(input.max_percentage) } : {}),
        ...(input.sort_order !== undefined ? { sort_order: input.sort_order } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {})
      }
    }));
  } catch (error: any) {
    if (error?.code === "P2002") throw new AppError("conflict", "A grading role with this code already exists", 409);
    throw error;
  }
};
