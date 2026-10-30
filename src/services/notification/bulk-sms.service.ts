/**
 * Bulk SMS Service
 * Resolves parent phone numbers from a filter (all / class / dormitory / parent_id)
 * and sends the same SMS message to each unique parent phone once.
 */
import { prisma } from "../../database/prisma";
import { sendSMS } from "./sender.service";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { NotificationRecipientType } from "@prisma/client";

const toBigInt = (v: string | number | bigint) =>
  typeof v === "bigint" ? v : BigInt(v);

export type BulkSmsFilter =
  | { type: "all" }
  | { type: "class";      class_id: string }
  | { type: "dormitory";  dormitory_id: string }
  | { type: "parent";     parent_id: string };

export type BulkSmsInput = {
  filter: BulkSmsFilter;
  message: string;
  /** Optional: preview only — returns count without sending */
  preview?: boolean;
};

type ParentPhone = { id: bigint; phone: string; name: string };

/** Resolve unique parents from a filter — each parent appears only once */
const resolveParents = async (
  schoolId: bigint,
  filter: BulkSmsFilter,
): Promise<ParentPhone[]> => {
  const seenIds = new Set<bigint>();
  const results: ParentPhone[] = [];

  const push = (p: { id: bigint; phone: string; first_name: string; last_name: string }) => {
    if (!p.phone || seenIds.has(p.id)) return;
    seenIds.add(p.id);
    results.push({ id: p.id, phone: p.phone, name: `${p.first_name} ${p.last_name}`.trim() });
  };

  if (filter.type === "parent") {
    // Single parent lookup
    const parent = await prisma.parents_guardians.findFirst({
      where: { id: toBigInt(filter.parent_id), school_id: schoolId },
      select: { id: true, phone: true, first_name: true, last_name: true },
    });
    if (!parent) throw new AppError("not_found", "Parent not found", 404);
    push(parent);
    return results;
  }

  // Build student filter
  let studentIds: bigint[] | null = null;

  if (filter.type === "class") {
    const enrollments = await prisma.student_section_enrollments.findMany({
      where: {
        status: "active",
        section: { class_id: toBigInt(filter.class_id) },
        student: { school_id: schoolId, deleted_at: null, status: "active" },
      },
      select: { student_id: true },
    });
    studentIds = [...new Set(enrollments.map((e) => e.student_id))];
    if (!studentIds.length) return results;
  } else if (filter.type === "dormitory") {
    const assignments = await prisma.student_dorm_assignments.findMany({
      where: {
        school_id: schoolId,
        dormitory_id: toBigInt(filter.dormitory_id),
        left_at: null,
        student: { deleted_at: null, status: "active" },
      },
      select: { student_id: true },
    });
    studentIds = [...new Set(assignments.map((a) => a.student_id))];
    if (!studentIds.length) return results;
  }
  // filter.type === "all" → studentIds stays null = all students

  // Fetch parent links
  const links = await prisma.student_parent_links.findMany({
    where: {
      student: {
        school_id: schoolId,
        deleted_at: null,
        status: "active",
        ...(studentIds ? { id: { in: studentIds } } : {}),
      },
    },
    include: {
      parent: { select: { id: true, phone: true, first_name: true, last_name: true } },
    },
  });

  for (const link of links) {
    if (link.parent?.phone) push(link.parent as any);
  }

  return results;
};

export const bulkSmsSend = async (
  schoolId: string | number | bigint,
  input: BulkSmsInput,
): Promise<{ sent: number; failed: number; parent_count: number; preview: boolean }> => {
  const sid = toBigInt(schoolId);

  if (!input.message?.trim()) throw new AppError("bad_request", "Message is required", 400);

  const parents = await resolveParents(sid, input.filter);

  if (input.preview) {
    return { sent: 0, failed: 0, parent_count: parents.length, preview: true };
  }

  let sent = 0;
  let failed = 0;

  for (const parent of parents) {
    try {
      await sendSMS(parent.phone, input.message, undefined, sid, {
        recipientType: NotificationRecipientType.parent,
        recipientId: parent.id,
        triggerType: "bulk_sms",
      });
      sent++;
    } catch (err) {
      failed++;
      logger.warn(`[bulkSMS] Failed to send to parent ${parent.id}: ${(err as Error).message}`);
    }
  }

  logger.info(`[bulkSMS] School ${sid}: sent=${sent} failed=${failed} total=${parents.length}`);
  return { sent, failed, parent_count: parents.length, preview: false };
};
