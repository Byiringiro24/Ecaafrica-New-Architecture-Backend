import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";

const toId = (value: string | number | bigint) => BigInt(value);

const format = (row: any) => ({
  ...row,
  id: row.id.toString(),
  school_id: row.school_id.toString(),
  exam_id: row.exam_id.toString(),
  teacher_id: row.teacher_id.toString(),
  reviewed_by: row.reviewed_by?.toString() ?? null
});

export const listRequests = async (schoolId: string, status?: string, teacherId?: string) => {
  const rows = await prisma.exam_modification_requests.findMany({
    where: {
      school_id: toId(schoolId),
      ...(teacherId ? { teacher_id: toId(teacherId) } : {}),
      ...(status ? { status: status as any } : {})
    },
    orderBy: { created_at: "desc" }
  });

  return Promise.all(rows.map(async (row) => {
    const [exam, teacher] = await Promise.all([
      prisma.exams.findFirst({
        where: { id: row.exam_id, school_id: toId(schoolId) },
        include: { section: true, subject: true }
      }),
      prisma.users.findFirst({
        where: { id: row.teacher_id, school_id: toId(schoolId) },
        select: { id: true, name: true, email: true }
      })
    ]);

    return {
      ...format(row),
      exam: exam ? {
        id: exam.id.toString(),
        name: exam.name,
        status: exam.status,
        exam_date: exam.exam_date,
        subject: exam.subject ? { id: exam.subject.id.toString(), name: exam.subject.name } : null,
        section: exam.section ? { id: exam.section.id.toString(), full_name: exam.section.full_name } : null
      } : null,
      teacher: teacher ? {
        id: teacher.id.toString(),
        name: teacher.name,
        email: teacher.email
      } : null
    };
  }));
};

export const createRequest = async (schoolId: string, examId: string, teacherId: string, reason: string) => {
  const exam = await prisma.exams.findFirst({ where: { id: toId(examId), school_id: toId(schoolId), teacher_id: toId(teacherId) } });
  if (!exam) throw new AppError("not_found", "Exam not found", 404);
  if (exam.status === "scheduled") throw new AppError("conflict", "Draft exams can be edited directly", 409);
  try {
    return format(await prisma.exam_modification_requests.create({
      data: { school_id: toId(schoolId), exam_id: toId(examId), teacher_id: toId(teacherId), reason: reason.trim() }
    }));
  } catch (error: any) {
    if (error?.code === "P2002") throw new AppError("conflict", "A modification request is already pending", 409);
    throw error;
  }
};

export const reviewRequest = async (schoolId: string, requestId: string, adminId: string, status: "approved" | "rejected") => {
  const request = await prisma.exam_modification_requests.findFirst({ where: { id: toId(requestId), school_id: toId(schoolId) } });
  if (!request) throw new AppError("not_found", "Modification request not found", 404);
  if (request.status !== "pending") throw new AppError("conflict", "This request has already been reviewed", 409);

  return prisma.$transaction(async (tx) => {
    let updated;
    try {
      updated = await tx.exam_modification_requests.update({
        where: { id: request.id },
        data: { status, reviewed_by: toId(adminId), reviewed_at: new Date() }
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new AppError("conflict", "A request with this status already exists for this exam", 409);
      }
      throw error;
    }
    if (status === "approved") {
      // Approval is the explicit edit grant. If the results were published,
      // hide them while the teacher makes the correction; unpublishing alone
      // never grants this access.
      await tx.exam_results.updateMany({
        where: { exam_id: request.exam_id },
        data: { published_at: null }
      });
      await tx.exams.update({
        where: { id: request.exam_id },
        data: { status: "scheduled", published_at: null, published_by: null }
      });
    }
    return format(updated);
  });
};
