/**
 * Late Return Detection Job (spec §23)
 *
 * Runs every 5 minutes. Finds students who are OUTSIDE_SCHOOL
 * and have passed their expected return time.
 * - Flags leave as late_return
 * - Alerts DOD and the responsible patron/matron
 * - Sends parent SMS/notification (spec §23 — parent gets notified on late return)
 */
import { LeaveState } from "@prisma/client";
import { prisma } from "../database/prisma";
import { createNotification } from "../services/app.service";
import { sendSMS } from "../services/notification/sender.service";
import { logger } from "../utils/logger";

const LATE_CHECK_INTERVAL_MS = parseInt(
  process.env.LATE_RETURN_CHECK_INTERVAL_MS ?? String(5 * 60_000),
  10
);

async function runLateReturnSweep(): Promise<void> {
  const now = new Date();

  try {
    // Find all outside-school leaves that have passed expected return time
    // and haven't been flagged yet
    const overdue = await prisma.student_leave_requests.findMany({
      where: {
        leave_state: LeaveState.outside_school,
        late_return_flagged: false,
      },
      select: {
        id: true,
        school_id: true,
        student_id: true,
        parent_id: true,
        end_date: true,
        expected_return_time: true,
        leave_category: true,
        leave_type: true,
      },
    });

    for (const leave of overdue) {
      try {
        const expectedReturn = new Date(
          `${leave.end_date.toISOString().split("T")[0]}T${leave.expected_return_time ?? "23:59:00"}`
        );
        if (now <= expectedReturn) continue; // Not late yet

        // Flag as late
        await prisma.student_leave_requests.update({
          where: { id: leave.id },
          data: { late_return_flagged: true },
        });

        // Get student details
        const student = await prisma.students.findFirst({
          where: { id: leave.student_id },
          select: { first_name: true, last_name: true, school_id: true },
        });
        const studentName = student
          ? `${student.first_name} ${student.last_name}`
          : "A student";

        const overdueMins = Math.round(
          (now.getTime() - expectedReturn.getTime()) / 60000
        );
        const msg = `LATE RETURN: ${studentName} was expected back at ${expectedReturn.toLocaleTimeString()} but has not returned. Overdue by ${overdueMins} minute${overdueMins !== 1 ? "s" : ""}.`;

        // Alert DOD(s) and school admin
        const dodUsers = await prisma.users.findMany({
          where: {
            school_id: leave.school_id,
            role: { in: ["director_of_discipline", "school_admin"] },
            deleted_at: null,
            status: "active",
          },
          select: { id: true },
        });
        for (const dod of dodUsers) {
          await createNotification(dod.id, leave.school_id, {
            title: "Late Return Alert",
            body: msg,
            type: "late_return",
            studentId: leave.student_id,
            metadata: {
              leave_id: leave.id.toString(),
              overdue_mins: overdueMins,
              expected_return: expectedReturn.toISOString(),
            },
          }).catch(() => null);
        }

        // Alert patron/matron assigned to this student's dormitory
        const dormAssignment = await prisma.student_dorm_assignments.findFirst({
          where: { student_id: leave.student_id, left_at: null },
          select: { dormitory_id: true },
        });
        if (dormAssignment) {
          const patrons = await prisma.patron_dormitory_assignments.findMany({
            where: {
              dormitory_id: dormAssignment.dormitory_id,
              school_id: leave.school_id,
              is_active: true,
            },
            select: { user_id: true },
          });
          for (const pa of patrons) {
            await createNotification(pa.user_id, leave.school_id, {
              title: "Late Return — Your Dormitory",
              body: msg,
              type: "late_return",
              studentId: leave.student_id,
            }).catch(() => null);
          }
        }

        // Parent notification + SMS (spec §23)
        if (leave.parent_id) {
          const parentMsg = `Your child ${studentName} was expected to return to school by ${expectedReturn.toLocaleTimeString()} but has not yet returned. Please contact the school immediately.`;
          await createNotification(leave.parent_id, leave.school_id, {
            title: "Late Return — Action Required",
            body: parentMsg,
            type: "late_return_parent",
            studentId: leave.student_id,
          }).catch(() => null);

          // SMS via parent phone
          const parent = await prisma.users.findFirst({
            where: { id: leave.parent_id },
            select: { phone: true },
          });
          if (parent?.phone) {
            await sendSMS(parent.phone, parentMsg, undefined, leave.school_id, {
              recipientType: "parent",
              recipientId: leave.parent_id,
              triggerType: "late_return",
            }).catch(() => null);
          }
        }

        logger.warn(
          { leaveId: leave.id.toString(), studentId: leave.student_id.toString(), overdueMins },
          "[late-return] Student flagged as late return"
        );
      } catch (err) {
        logger.warn({ err, leaveId: leave.id.toString() }, "[late-return] Error processing leave");
      }
    }
  } catch (err) {
    logger.error({ err }, "[late-return] Sweep failed");
  }
}

let lateReturnTimer: ReturnType<typeof setInterval> | null = null;

export function startLateReturnJob(): void {
  if (lateReturnTimer) return;
  logger.info(
    { intervalMs: LATE_CHECK_INTERVAL_MS },
    "[late-return] Late return detection job started"
  );
  // Initial run 15s after startup
  const init = setTimeout(() => void runLateReturnSweep(), 15_000);
  init.unref?.();

  lateReturnTimer = setInterval(() => void runLateReturnSweep(), LATE_CHECK_INTERVAL_MS);
  lateReturnTimer.unref?.();
}

export function stopLateReturnJob(): void {
  if (lateReturnTimer) {
    clearInterval(lateReturnTimer);
    lateReturnTimer = null;
  }
}
