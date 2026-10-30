import type { Prisma } from "@prisma/client";
import { StudentLeaveStatus } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";

const toBigInt = (value: string | number | bigint) =>
  typeof value === "bigint" ? value : BigInt(value);

export const assertDates = (startDate: Date, endDate: Date) => {
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new AppError("bad_request", "Invalid leave dates", 400);
  }

  if (startDate.getTime() > endDate.getTime()) {
    throw new AppError("bad_request", "Start date must be before end date", 400);
  }
};

/// Rejects a new/edited leave that overlaps an existing pending or approved one
/// for the same student. Runs inside the caller's transaction so the check and
/// the insert cannot interleave with a concurrent request.
export const assertNoLeaveConflict = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
  startDate: Date,
  endDate: Date,
  excludeLeaveId?: bigint
) => {
  const conflict = await tx.student_leave_requests.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      student_id: toBigInt(studentId),
      status: { in: [StudentLeaveStatus.pending, StudentLeaveStatus.approved] },
      start_date: { lte: endDate },
      end_date: { gte: startDate },
      id: excludeLeaveId ? { not: excludeLeaveId } : undefined
    }
  });

  if (conflict) {
    throw new AppError("conflict", "Student already has a leave in this period", 409);
  }
};
