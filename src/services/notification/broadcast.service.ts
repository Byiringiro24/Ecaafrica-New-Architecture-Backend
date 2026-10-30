import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { AppError } from "../../middleware/errorHandler";

/// Who a broadcast goes to. `all` covers every parent with a linked student in
/// the school; the narrower audiences resolve through the students those
/// parents are linked to.
export type BroadcastAudience =
  | { type: "all" }
  | { type: "class"; class_id: string }
  | { type: "section"; section_id: string }
  | { type: "students"; student_ids: string[] };

export type BroadcastInput = {
  title: string;
  body: string;
  audience: BroadcastAudience;
};

const toBigInt = (value: string | number | bigint) =>
  typeof value === "bigint" ? value : BigInt(value);

/// Postgres caps a statement at 65535 bound parameters. Each row here binds 7,
/// so ~1000 rows per insert stays comfortably clear of the ceiling.
const INSERT_CHUNK = 1000;

type Recipient = { parent_id: bigint; student_id: bigint };

/// Resolves the audience to (parent, student) pairs, scoped to [schoolId] so a
/// caller can never reach another tenant's parents by passing a foreign id.
const resolveRecipients = async (
  schoolId: bigint,
  audience: BroadcastAudience
): Promise<Recipient[]> => {
  const studentWhere: Prisma.studentsWhereInput = {
    school_id: schoolId,
    deleted_at: null
  };

  if (audience.type === "students") {
    if (audience.student_ids.length === 0) {
      throw new AppError("bad_request", "No students selected", 400);
    }
    studentWhere.id = { in: audience.student_ids.map(toBigInt) };
  } else if (audience.type === "class" || audience.type === "section") {
    const sectionFilter =
      audience.type === "section"
        ? { id: toBigInt(audience.section_id) }
        : { class_id: toBigInt(audience.class_id) };

    studentWhere.student_section_enrollments = {
      some: {
        school_id: schoolId,
        status: "active",
        left_at: null,
        section: sectionFilter
      }
    };
  }

  const links = await prisma.student_parent_links.findMany({
    where: { student: studentWhere },
    select: { parent_id: true, student_id: true }
  });

  // A parent linked to two students in the audience should get one notification
  // per child, but never two identical rows for the same child.
  const seen = new Set<string>();
  return links.filter((l) => {
    const key = `${l.parent_id}:${l.student_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const previewBroadcast = async (
  schoolId: string | number | bigint,
  audience: BroadcastAudience
) => {
  const recipients = await resolveRecipients(toBigInt(schoolId), audience);
  return {
    parent_count: new Set(recipients.map((r) => r.parent_id.toString())).size,
    notification_count: recipients.length
  };
};

export const sendParentBroadcast = async (
  schoolId: string | number | bigint,
  input: BroadcastInput
) => {
  const school = toBigInt(schoolId);
  const recipients = await resolveRecipients(school, input.audience);

  if (recipients.length === 0) {
    throw new AppError(
      "not_found",
      "No parents match the selected audience",
      404
    );
  }

  const rows = recipients.map((r) => ({
    parent_id: r.parent_id,
    school_id: school,
    student_id: r.student_id,
    title: input.title,
    body: input.body,
    type: "school_broadcast",
    metadata: { audience: input.audience } as Prisma.InputJsonValue
  }));

  let created = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const batch = rows.slice(i, i + INSERT_CHUNK);
    const result = await prisma.parent_app_notifications.createMany({
      data: batch
    });
    created += result.count;
  }

  return {
    delivered: created,
    parent_count: new Set(recipients.map((r) => r.parent_id.toString())).size
  };
};
