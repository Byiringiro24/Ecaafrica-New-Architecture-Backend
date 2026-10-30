/**
 * Enhanced Leave Service â€” Full state machine per spec:
 * DRAFT â†’ REQUESTED â†’ PENDING_DOD_APPROVAL â†’ APPROVED â†’ AWAITING_PHYSICAL_EXIT
 * â†’ OUTSIDE_SCHOOL â†’ RETURNED â†’ CLOSED
 *
 * Also handles:
 * - Gate keeper CONFIRM EXIT (creates gate_exit_records, updates student boarding_status)
 * - Biometric return auto-close
 * - Medical/long leave SMS triggers
 * - Parent notification on every state change
 */
import { LeaveState, LeaveCategory, StudentLeaveStatus, StudentLeaveType, BoardingStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";
import { createNotification } from "../app.service";
import { sendSMS } from "../notification/sender.service";
import { assertDates, assertNoLeaveConflict } from "./leave.helpers";

const toBigInt = (v: string | number | bigint) =>
  typeof v === "bigint" ? v : BigInt(v);

const fmtLeave = (r: Awaited<ReturnType<typeof prisma.student_leave_requests.findFirst>>) => {
  if (!r) return null;
  return {
    id: r.id.toString(),
    school_id: r.school_id.toString(),
    student_id: r.student_id.toString(),
    parent_id: r.parent_id?.toString() ?? null,
    leave_type: r.leave_type,
    leave_state: r.leave_state,
    leave_category: r.leave_category,
    start_date: r.start_date.toISOString().split("T")[0],
    end_date: r.end_date.toISOString().split("T")[0],
    start_time: r.start_time ? String(r.start_time) : null,
    expected_return_time: r.expected_return_time ? String(r.expected_return_time) : null,
    destination: r.destination,
    reason: r.reason,
    medical_notes: r.medical_notes,
    supporting_doc_url: r.supporting_doc_url,
    status: r.status,
    approved_by: r.approved_by?.toString() ?? null,
    approved_at: r.approved_at?.toISOString() ?? null,
    rejection_reason: r.rejection_reason,
    exited_at: r.exited_at?.toISOString() ?? null,
    returned_at: r.returned_at?.toISOString() ?? null,
    gate_keeper_id: r.gate_keeper_id?.toString() ?? null,
    late_return_flagged: r.late_return_flagged,
    actual_duration_mins: r.actual_duration_mins,
    approved_duration_mins: r.approved_duration_mins,
    created_by: (r as any).created_by?.toString() ?? null,
    is_unauthorized: r.is_unauthorized,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
};

export type LeaveCreateInputV2 = {
  student_id: string | number | bigint;
  parent_id?: string | number | bigint;
  leave_type?: StudentLeaveType;
  leave_category?: LeaveCategory;
  start_date: string | Date;
  start_time?: string;
  end_date: string | Date;
  expected_return_time?: string;
  destination?: string;
  reason?: string;
  medical_notes?: string;
  supporting_doc_url?: string;
  requested_by_role?: string;
  created_by?: string | number | bigint;
};

/** Create leave â€” starts in REQUESTED state (or PENDING_DOD if created by DOD/admin directly) */
export const createLeaveV2 = async (
  schoolId: string | number | bigint,
  input: LeaveCreateInputV2
) =>
  prisma.$transaction(async (tx) => {
    const student = await tx.students.findFirst({
      where: { id: toBigInt(input.student_id), school_id: toBigInt(schoolId), deleted_at: null },
    });
    if (!student) throw new AppError("not_found", "Student not found", 404);
    if (student.student_type !== "boarding")
      throw new AppError("bad_request", "Student is not a boarding student", 400);

    const startDate = input.start_date instanceof Date ? input.start_date : new Date(input.start_date);
    const endDate = input.end_date instanceof Date ? input.end_date : new Date(input.end_date);
    assertDates(startDate, endDate);
    await assertNoLeaveConflict(tx, schoolId, input.student_id, startDate, endDate);

    // Determine initial state based on who creates it
    const isDodOrAdmin = input.requested_by_role &&
      ["school_admin", "director_of_discipline"].includes(input.requested_by_role);
    const initialState: LeaveState = isDodOrAdmin ? LeaveState.pending_dod_approval : LeaveState.requested;

    // Auto-determine leave category if not provided
    const category = input.leave_category ?? categorizLeaveType(input.leave_type);

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const approvedMins = days * 24 * 60;

    const created = await tx.student_leave_requests.create({
      data: {
        school_id: toBigInt(schoolId),
        student_id: toBigInt(input.student_id),
        parent_id: input.parent_id ? toBigInt(input.parent_id) : undefined,
        leave_type: input.leave_type ?? StudentLeaveType.other,
        leave_state: initialState,
        leave_category: category,
        start_date: startDate,
        end_date: endDate,
        reason: input.reason,
        medical_notes: input.medical_notes,
        supporting_doc_url: input.supporting_doc_url,
        destination: input.destination,
        requested_by_role: input.requested_by_role,
        created_by: input.created_by ? toBigInt(input.created_by) : undefined,
        approved_duration_mins: approvedMins,
        status: StudentLeaveStatus.pending,
      },
    });

    return fmtLeave(created);
  });

/** DOD approves leave â†’ APPROVED â†’ AWAITING_PHYSICAL_EXIT */
export const approveLeaveV2 = async (
  schoolId: string | number | bigint,
  leaveId: string,
  approvedBy: string | number | bigint
) =>
  prisma.$transaction(async (tx) => {
    const leave = await getLeaveOrThrow(tx, schoolId, leaveId);

    if (!["requested", "pending_dod_approval"].includes(leave.leave_state as string)) {
      throw new AppError("conflict", `Cannot approve leave in state: ${leave.leave_state}`, 409);
    }

    const updated = await tx.student_leave_requests.update({
      where: { id: leave.id },
      data: {
        leave_state: LeaveState.awaiting_physical_exit,
        status: StudentLeaveStatus.approved,
        approved_by: toBigInt(approvedBy),
        approved_at: new Date(),
        rejection_reason: null,
        dod_notified_at: new Date(),
      },
    });

    // Notify parent
    if (leave.parent_id) {
      const student = await tx.students.findFirst({ where: { id: leave.student_id } });
      const studentName = student ? `${student.first_name} ${student.last_name}` : "your child";

      await createNotification(leave.parent_id, leave.school_id, {
        title: "Leave Request Approved",
        body: `Leave for ${studentName} has been approved. ${studentName} may exit after gate keeper verification.`,
        type: "leave_approved",
        studentId: leave.student_id,
        metadata: { leave_id: leaveId, leave_type: leave.leave_type, leave_category: leave.leave_category },
      }, tx);

      // SMS for long leave and medical leave
      if (["long_leave", "medical_leave"].includes(leave.leave_category as string)) {
        const parent = await tx.parents_guardians.findFirst({ where: { id: leave.parent_id } });
        if (parent) {
          const msg = leave.leave_category === LeaveCategory.medical_leave
            ? `Your child ${studentName} has been placed on medical leave from ${leave.start_date.toISOString().split("T")[0]} to ${leave.end_date.toISOString().split("T")[0]}. Please contact the school for details.`
            : `Leave approved for ${studentName} from ${leave.start_date.toISOString().split("T")[0]} to ${leave.end_date.toISOString().split("T")[0]}.`;
          await sendSMS(parent.phone, msg, undefined, leave.school_id, {
            recipientType: "parent", recipientId: parent.id, triggerType: "leave_approved",
          }).catch(() => null); // don't fail the transaction on SMS error
        }
      }
    }

    return fmtLeave(updated);
  });

/** DOD rejects leave */
export const rejectLeaveV2 = async (
  schoolId: string | number | bigint,
  leaveId: string,
  rejectedBy: string | number | bigint,
  reason: string
) =>
  prisma.$transaction(async (tx) => {
    const leave = await getLeaveOrThrow(tx, schoolId, leaveId);

    if (["outside_school", "returned", "closed"].includes(leave.leave_state as string)) {
      throw new AppError("conflict", `Cannot reject leave in state: ${leave.leave_state}`, 409);
    }

    const updated = await tx.student_leave_requests.update({
      where: { id: leave.id },
      data: {
        leave_state: LeaveState.rejected,
        status: StudentLeaveStatus.rejected,
        approved_by: toBigInt(rejectedBy),
        approved_at: new Date(),
        rejection_reason: reason,
      },
    });

    if (leave.parent_id) {
      const student = await tx.students.findFirst({ where: { id: leave.student_id } });
      const studentName = student ? `${student.first_name} ${student.last_name}` : "your child";
      await createNotification(leave.parent_id, leave.school_id, {
        title: "Leave Request Rejected",
        body: `Leave request for ${studentName} was not approved. Reason: ${reason}`,
        type: "leave_rejected",
        studentId: leave.student_id,
        metadata: { leave_id: leaveId, rejection_reason: reason },
      }, tx);
    }

    return fmtLeave(updated);
  });

/** Gate keeper CONFIRMS physical exit â†’ OUTSIDE_SCHOOL */
export const confirmGateExit = async (
  schoolId: string | number | bigint,
  leaveId: string,
  gateKeeperId: string | number | bigint,
  notes?: string
) =>
  prisma.$transaction(async (tx) => {
    const leave = await getLeaveOrThrow(tx, schoolId, leaveId);

    if (leave.leave_state !== LeaveState.awaiting_physical_exit) {
      throw new AppError("conflict",
        `Gate exit only allowed when leave is awaiting_physical_exit. Current state: ${leave.leave_state}`, 409);
    }

    const exitAt = new Date();

    // Create immutable exit audit record
    await tx.gate_exit_records.create({
      data: {
        school_id: toBigInt(schoolId),
        leave_id: leave.id,
        student_id: leave.student_id,
        gate_keeper_id: toBigInt(gateKeeperId),
        exit_at: exitAt,
        notes,
      },
    });

    // Update leave state
    const updated = await tx.student_leave_requests.update({
      where: { id: leave.id },
      data: {
        leave_state: LeaveState.outside_school,
        status: StudentLeaveStatus.approved,
        exited_at: exitAt,
        gate_keeper_id: toBigInt(gateKeeperId),
      },
    });

    // Update student boarding status
    const boardingStatus = leave.leave_category === LeaveCategory.medical_leave
      ? BoardingStatus.on_medical_leave
      : leave.leave_category === LeaveCategory.long_leave
        ? BoardingStatus.on_long_leave
        : BoardingStatus.on_short_leave;

    await tx.students.update({
      where: { id: leave.student_id },
      data: { boarding_status: boardingStatus },
    });

    // Notify parent
    if (leave.parent_id) {
      const student = await tx.students.findFirst({ where: { id: leave.student_id } });
      const studentName = student ? `${student.first_name} ${student.last_name}` : "your child";
      await createNotification(leave.parent_id, leave.school_id, {
        title: "Student Has Left School",
        body: `${studentName} has exited school at ${exitAt.toLocaleTimeString()}. Expected return: ${leave.end_date.toISOString().split("T")[0]}.`,
        type: "student_exited",
        studentId: leave.student_id,
        metadata: { leave_id: leaveId, exit_at: exitAt.toISOString() },
      }, tx);
    }

    return fmtLeave(updated);
  });

/** Record biometric return â†’ auto-closes leave, student status â†’ IN_SCHOOL */
export const recordBiometricReturn = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint,
  returnAt?: Date
) => {
  const now = returnAt ?? new Date();

  // Find active outside-school leave for this student
  const leave = await prisma.student_leave_requests.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      student_id: toBigInt(studentId),
      leave_state: LeaveState.outside_school,
    },
    orderBy: { exited_at: "desc" },
  });

  if (!leave) return null; // No active leave â€” normal gate scan, not a return

  // Calculate actual duration
  const exitAt = leave.exited_at ?? leave.start_date;
  const actualMins = Math.round((now.getTime() - new Date(exitAt).getTime()) / 60000);

  // Check if late return
  const expectedReturn = new Date(`${leave.end_date.toISOString().split("T")[0]}T${leave.expected_return_time ?? "23:59:00"}`);
  const isLate = now > expectedReturn;

  return prisma.$transaction(async (tx) => {
    // Update leave exit record with return time
    await tx.gate_exit_records.updateMany({
      where: { leave_id: leave.id, return_at: null },
      data: { return_at: now },
    });

    const updated = await tx.student_leave_requests.update({
      where: { id: leave.id },
      data: {
        leave_state: LeaveState.returned,  // patron confirms -> closed per spec Â§21
        returned_at: now,
        actual_duration_mins: actualMins,
        late_return_flagged: isLate,
      },
    });

    // Reset student boarding status
    await tx.students.update({
      where: { id: leave.student_id },
      data: { boarding_status: BoardingStatus.in_school },
    });

    // Parent notification
    if (leave.parent_id) {
      const student = await tx.students.findFirst({ where: { id: leave.student_id } });
      const studentName = student ? `${student.first_name} ${student.last_name}` : "your child";
      const msg = isLate
        ? `${studentName} has returned to school at ${now.toLocaleTimeString()} â€” this is a LATE RETURN. Expected: ${expectedReturn.toLocaleTimeString()}.`
        : `${studentName} has safely returned to school at ${now.toLocaleTimeString()}.`;

      await createNotification(leave.parent_id, leave.school_id, {
        title: isLate ? "Late Return" : "Student Returned",
        body: msg,
        type: isLate ? "late_return" : "student_returned",
        studentId: leave.student_id,
        metadata: { leave_id: leave.id.toString(), return_at: now.toISOString(), is_late: isLate },
      }, tx);
    }

    return fmtLeave(updated);
  });
};

/** Get approved exits for gate keeper view */

/**
 * Patron/Matron confirms student return -- closes the leave (spec §21).
 * Biometric scan at gate sets RETURNED state; patron/matron then confirms → CLOSED.
 */
export const confirmReturnByPatron = async (
  schoolId: string | number | bigint,
  leaveId: string,
  confirmedBy: string | number | bigint
) =>
  prisma.$transaction(async (tx) => {
    const leave = await getLeaveOrThrow(tx, schoolId, leaveId);
    if (leave.leave_state !== LeaveState.returned) {
      throw new AppError(
        "conflict",
        `Return confirmation only allowed when leave state is 'returned'. Current: ${leave.leave_state}`,
        409
      );
    }
    return tx.student_leave_requests.update({
      where: { id: leave.id },
      data: { leave_state: LeaveState.closed },
    });
  });

/**
 * Photo enforcement — throws if student has no photo (spec §6).
 * Called before confirmGateExit to block exit without a verified photo.
 */
export const assertStudentHasPhoto = async (
  schoolId: string | number | bigint,
  studentId: string | number | bigint
): Promise<void> => {
  const student = await prisma.students.findFirst({
    where: { id: toBigInt(studentId), school_id: toBigInt(schoolId) },
    select: { photo_url: true, first_name: true, last_name: true },
  });
  if (!student?.photo_url) {
    throw new AppError(
      "bad_request",
      "Student does not have a passport photograph on file. " +
        "Upload a photo before allowing gate exit — this is a security requirement.",
      400
    );
  }
};

/**
 * Lightweight leave lookup for photo pre-check — does not throw if not found.
 */
export const getLeaveForPhotoCheck = async (
  schoolId: string | number | bigint,
  leaveId: string
) => {
  if (!/^\d+$/.test(leaveId)) return null;
  return prisma.student_leave_requests.findFirst({
    where: { id: toBigInt(leaveId), school_id: toBigInt(schoolId) },
    select: { student_id: true, leave_state: true },
  });
};

export const getApprovedExitsForGateKeeper = async (
  schoolId: string | number | bigint,
  filters?: { date?: string }
) => {
  const today = filters?.date ? new Date(filters.date) : new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const leaves = await prisma.student_leave_requests.findMany({
    where: {
      school_id: toBigInt(schoolId),
      leave_state: { in: [LeaveState.awaiting_physical_exit, LeaveState.outside_school] },
      OR: [
        { start_date: { gte: startOfDay, lte: endOfDay } },
        { leave_state: LeaveState.outside_school }, // show all currently outside
      ],
    },
    include: {
      student: {
        select: {
          id: true, first_name: true, last_name: true, student_id_number: true,
          photo_url: true, gender: true, boarding_status: true,
          student_dorm_assignments: {
            where: { left_at: null },
            include: {
              dormitory: { select: { id: true, name: true, block_name: true } },
              room: { select: { id: true, room_number: true } },
            },
            take: 1,
          },
        },
      },
      gate_exit_records: { orderBy: { exit_at: "desc" }, take: 1 },
    },
    orderBy: { approved_at: "desc" },
  });

  return leaves.map((l) => {
    const dormAssignment = l.student.student_dorm_assignments[0];
    const exitRecord = l.gate_exit_records[0];
    return {
      leave_id: l.id.toString(),
      leave_state: l.leave_state,
      leave_type: l.leave_type,
      leave_category: l.leave_category,
      start_date: l.start_date.toISOString().split("T")[0],
      end_date: l.end_date.toISOString().split("T")[0],
      expected_return_time: l.expected_return_time ? String(l.expected_return_time) : null,
      destination: l.destination,
      reason: l.reason,
      approved_at: l.approved_at?.toISOString() ?? null,
      exited_at: l.exited_at?.toISOString() ?? null,
      exit_record: exitRecord ? {
        exit_at: exitRecord.exit_at.toISOString(),
        gate_keeper_id: exitRecord.gate_keeper_id?.toString() ?? null,
      } : null,
      student: {
        id: l.student.id.toString(),
        first_name: l.student.first_name,
        last_name: l.student.last_name,
        full_name: `${l.student.first_name} ${l.student.last_name}`,
        student_id_number: l.student.student_id_number,
        photo_url: l.student.photo_url,
        gender: l.student.gender,
        boarding_status: l.student.boarding_status,
        dormitory: dormAssignment?.dormitory ? {
          id: dormAssignment.dormitory.id.toString(),
          name: dormAssignment.dormitory.name,
          block_name: dormAssignment.dormitory.block_name,
        } : null,
        room: dormAssignment?.room ? {
          id: dormAssignment.room.id.toString(),
          room_number: dormAssignment.room.room_number,
        } : null,
      },
    };
  });
};

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const getLeaveOrThrow = async (
  tx: Prisma.TransactionClient,
  schoolId: string | number | bigint,
  leaveId: string
) => {
  if (!/^\d+$/.test(leaveId)) throw new AppError("bad_request", "Invalid leave id", 400);
  const leave = await tx.student_leave_requests.findFirst({
    where: { id: toBigInt(leaveId), school_id: toBigInt(schoolId) },
  });
  if (!leave) throw new AppError("not_found", "Leave not found", 404);
  return leave;
};

const categorizLeaveType = (type?: StudentLeaveType): LeaveCategory => {
  if (!type) return LeaveCategory.short_leave;
  if (type === StudentLeaveType.medical) return LeaveCategory.medical_leave;
  if (type === StudentLeaveType.emergency) return LeaveCategory.emergency_leave;
  if ([StudentLeaveType.weekend, StudentLeaveType.home_leave, StudentLeaveType.long_leave].includes(type as any))
    return LeaveCategory.long_leave;
  return LeaveCategory.short_leave;
};
