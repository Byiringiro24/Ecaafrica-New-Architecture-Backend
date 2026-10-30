import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import type { StudentLeaveType } from "@prisma/client";
import { prisma } from "../database/prisma";
import { env } from "../configs/env";
import { AppError } from "../middleware/errorHandler";
import { sendSMS } from "./notification/sender.service";
import { buildSubjectRows } from "./report-card.service";
import {
  assertDates,
  assertNoLeaveConflict
} from "./boarding/leave.helpers";

const APP_ACCESS_TTL = "1h";
const APP_REFRESH_TTL = "14d";
const OTP_EXPIRY_MINUTES = 10;

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const getAccessSecret = () => env.APP_JWT_SECRET ?? env.JWT_SECRET;
const getRefreshSecret = () => env.APP_JWT_REFRESH_SECRET ?? env.JWT_REFRESH_SECRET;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildTokenHash = (token: string) => `app_refresh_${hashToken(token)}`;

const findParentByPhone = async (phone: string) => {
  const normalizedPhone = phone.replace(/[^\d+]/g, "");
  const parent = await prisma.parents_guardians.findFirst({
    where: {
      phone: { contains: normalizedPhone.slice(-9) },
      school: { deleted_at: null, status: { not: "suspended" } }
    },
    include: {
      school: {
        select: {
          id: true,
          name: true,
          logo_url: true,
          country: true,
          province: true,
          district: true,
          school_phone: true,
          school_email: true
        }
      },
      student_parent_links: {
        include: {
          student: {
            include: {
              student_section_enrollments: {
                where: { status: "active" },
                include: {
                  section: {
                    include: {
                      class: true
                    }
                  }
                },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  if (!parent) {
    throw new AppError("not_found", "PARENT_NOT_FOUND - Phone number not registered in any school. Contact your school admin.", 404);
  }

  return parent;
};

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const sendOtp = async (phone: string) => {
  const parent = await findParentByPhone(phone);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.parent_app_otps.create({
    data: {
      parent_id: parent.id,
      school_id: parent.school_id,
      phone: parent.phone,
      otp,
      expires_at: expiresAt
    }
  });

  // Invalidate old unused OTPs
  await prisma.parent_app_otps.updateMany({
    where: {
      parent_id: parent.id,
      used_at: null,
      expires_at: { gt: new Date() },
      id: { not: (await prisma.parent_app_otps.findFirst({
        where: { parent_id: parent.id },
        orderBy: { created_at: "desc" }
      }))?.id }
    },
    data: { expires_at: new Date() }
  });

  const message = `Your ECareAfrica verification code is: ${otp}. This code expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;

  await sendSMS(
    parent.phone,
    message,
    undefined,
    parent.school_id,
    {
      recipientType: "parent",
      recipientId: parent.id,
      triggerType: "app_otp"
    }
  );

  return {
    message: "OTP sent successfully",
    phone: parent.phone.slice(-4).padStart(parent.phone.length, "*")
  };
};

export const verifyOtp = async (phone: string, otp: string) => {
  const parent = await findParentByPhone(phone);

  const otpRecord = await prisma.parent_app_otps.findFirst({
    where: {
      parent_id: parent.id,
      otp,
      used_at: null,
      expires_at: { gt: new Date() }
    },
    orderBy: { created_at: "desc" }
  });

  if (!otpRecord) {
    throw new AppError("unauthorized", "Invalid or expired OTP", 401);
  }

  await prisma.parent_app_otps.update({
    where: { id: otpRecord.id },
    data: { used_at: new Date() }
  });

  const payload = {
    id: parent.id.toString(),
    school_id: parent.school_id.toString(),
    role: "parent",
    phone: parent.phone,
    auth_type: "app" as const
  };

  const accessToken = jwt.sign(
    { ...payload, token_type: "access" },
    getAccessSecret(),
    { expiresIn: APP_ACCESS_TTL }
  );

  const refreshToken = jwt.sign(
    { ...payload, token_type: "refresh" },
    getRefreshSecret(),
    { expiresIn: APP_REFRESH_TTL }
  );

  const tokenHash = buildTokenHash(refreshToken);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.parent_app_sessions.create({
    data: {
      parent_id: parent.id,
      school_id: parent.school_id,
      phone: parent.phone,
      token_hash: tokenHash,
      expires_at: expiresAt
    }
  });

  return {
    accessToken,
    refreshToken,
    parent: formatParentProfile(parent)
  };
};

export const refreshTokens = async (refreshToken: string) => {
  let decoded: Record<string, unknown>;
  try {
    decoded = jwt.verify(refreshToken, getRefreshSecret()) as Record<string, unknown>;
  } catch {
    throw new AppError("unauthorized", "Invalid or expired refresh token", 401);
  }

  if (decoded.token_type !== "refresh" || decoded.auth_type !== "app") {
    throw new AppError("unauthorized", "Invalid token type", 401);
  }

  const tokenHash = buildTokenHash(refreshToken);
  const session = await prisma.parent_app_sessions.findFirst({
    where: {
      token_hash: tokenHash,
      revoked_at: null,
      expires_at: { gt: new Date() }
    }
  });

  if (!session) {
    throw new AppError("unauthorized", "Session expired or revoked", 401);
  }

  const parentId = typeof decoded.id === "string" ? decoded.id : String(decoded.id);
  const schoolId = typeof decoded.school_id === "string" ? decoded.school_id : String(decoded.school_id);

  const parent = await prisma.parents_guardians.findFirst({
    where: { id: toBigInt(parentId), school_id: toBigInt(schoolId) }
  });

  if (!parent) {
    throw new AppError("not_found", "Parent not found", 404);
  }

  const payload = {
    id: parent.id.toString(),
    school_id: parent.school_id.toString(),
    role: "parent",
    phone: parent.phone,
    auth_type: "app" as const
  };

  const newAccessToken = jwt.sign(
    { ...payload, token_type: "access" },
    getAccessSecret(),
    { expiresIn: APP_ACCESS_TTL }
  );

  const newRefreshToken = jwt.sign(
    { ...payload, token_type: "refresh" },
    getRefreshSecret(),
    { expiresIn: APP_REFRESH_TTL }
  );

  const newTokenHash = buildTokenHash(newRefreshToken);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.parent_app_sessions.update({
    where: { id: session.id },
    data: {
      token_hash: newTokenHash,
      expires_at: expiresAt,
      revoked_at: null
    }
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    parent: formatParentProfile(parent)
  };
};

const formatParentProfile = (parent: {
  id: bigint;
  school_id: bigint;
  first_name: string;
  last_name: string;
  phone: string;
  phone_alt?: string | null;
  email?: string | null;
  national_id?: string | null;
  relationship: string;
  address?: string | null;
  occupation?: string | null;
  school?: {
    id: bigint;
    name: string;
    logo_url?: string | null;
    country?: string | null;
    province?: string | null;
    district?: string | null;
    school_phone?: string | null;
    school_email?: string | null;
  } | null;
  student_parent_links?: Array<{
    student: {
      id: bigint;
      first_name: string;
      last_name: string;
      student_id_number?: string | null;
      photo_url?: string | null;
      gender?: string | null;
      date_of_birth?: Date | null;
      student_type?: string | null;
      student_section_enrollments: Array<{
        section: {
          id: bigint;
          name: string;
          full_name: string;
          class: {
            id: bigint;
            name: string;
            level: number;
          };
        };
      }>;
    };
  }>;
}) => {
  const children = parent.student_parent_links?.map(link => {
    const student = link.student;
    const enrollment = student.student_section_enrollments?.[0];
    return {
      student_id: student.id.toString(),
      first_name: student.first_name,
      last_name: student.last_name,
      full_name: `${student.first_name} ${student.last_name}`,
      student_id_number: student.student_id_number,
      photo_url: student.photo_url,
      gender: student.gender,
      date_of_birth: student.date_of_birth?.toISOString(),
      student_type: student.student_type,
      class: enrollment ? {
        id: enrollment.section.class.id.toString(),
        name: enrollment.section.class.name,
        level: enrollment.section.class.level
      } : null,
      section: enrollment ? {
        id: enrollment.section.id.toString(),
        name: enrollment.section.name,
        full_name: enrollment.section.full_name
      } : null
    };
  }) ?? [];

  return {
    id: parent.id.toString(),
    school_id: parent.school_id.toString(),
    first_name: parent.first_name,
    last_name: parent.last_name,
    full_name: `${parent.first_name} ${parent.last_name}`,
    phone: parent.phone,
    phone_alt: parent.phone_alt,
    email: parent.email,
    relationship: parent.relationship,
    address: parent.address,
    occupation: parent.occupation,
    school: parent.school ? {
      id: parent.school.id.toString(),
      name: parent.school.name,
      logo_url: parent.school.logo_url,
      country: parent.school.country,
      province: parent.school.province,
      district: parent.school.district,
      phone: parent.school.school_phone,
      email: parent.school.school_email
    } : null,
    children
  };
};

export const getProfile = async (parentId: string | number | bigint) => {
  const parent = await prisma.parents_guardians.findUnique({
    where: { id: toBigInt(parentId) },
    include: {
      school: {
        select: {
          id: true,
          name: true,
          logo_url: true,
          country: true,
          province: true,
          district: true,
          school_phone: true,
          school_email: true
        }
      },
      student_parent_links: {
        include: {
          student: {
            include: {
              student_section_enrollments: {
                where: { status: "active" },
                include: {
                  section: {
                    include: {
                      class: true
                    }
                  }
                },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  if (!parent) {
    throw new AppError("not_found", "Parent not found", 404);
  }

  return formatParentProfile(parent);
};

export const getChildren = async (parentId: string | number | bigint) => {
  const profile = await getProfile(parentId);
  return profile.children;
};

const assertParentStudentLink = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await prisma.students.findUnique({
    where: { id: toBigInt(studentId) }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  const link = await prisma.student_parent_links.findFirst({
    where: {
      student_id: student.id,
      parent_id: toBigInt(parentId)
    }
  });

  if (!link) {
    throw new AppError("forbidden", "You are not linked to this student", 403);
  }

  return student;
};

export const getStudentAttendance = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint,
  options?: { from?: string; to?: string }
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const records = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT ar.id, ar.status, ar.scan_method, ar.scanned_at, ar.notes,
      as2.id as session_id, as2.session_date, as2.session_type,
      s.id as section_id, s.name as section_name, s.full_name as section_full_name,
      sub.id as subject_id, sub.name as subject_name
    FROM attendance_records ar
    JOIN attendance_sessions as2 ON ar.session_id = as2.id
    LEFT JOIN sections s ON as2.section_id = s.id
    LEFT JOIN subjects sub ON as2.subject_id = sub.id
    WHERE ar.student_id = ${student.id} AND ar.school_id = ${student.school_id}
    ${options?.from ? Prisma.sql`AND as2.session_date >= ${new Date(options.from)}` : Prisma.empty}
    ${options?.to ? Prisma.sql`AND as2.session_date <= ${new Date(options.to)}` : Prisma.empty}
    ORDER BY as2.session_date DESC
  `;

  return records.map(r => ({
    id: String(r.id),
    date: String(r.session_date).split("T")[0],
    status: String(r.status),
    scan_method: String(r.scan_method),
    scanned_at: r.scanned_at ? String(r.scanned_at) : null,
    notes: r.notes ? String(r.notes) : null,
    session: {
      id: String(r.session_id),
      session_type: String(r.session_type),
      section: r.section_id ? {
        id: String(r.section_id),
        name: String(r.section_name),
        full_name: String(r.section_full_name)
      } : null,
      subject: r.subject_id ? {
        id: String(r.subject_id),
        name: String(r.subject_name)
      } : null
    }
  }));
};

export const getStudentGrades = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const results = await prisma.exam_results.findMany({
    where: {
      student_id: student.id,
      published_at: { not: null },
      exam: {
        status: "completed"
      }
    },
    include: {
      exam: {
        include: {
          subject: { select: { id: true, name: true, code: true } }
        }
      }
    },
    orderBy: { exam: { exam_date: "desc" } }
  });

  return results.map(r => ({
    id: r.id.toString(),
    exam_id: r.exam_id.toString(),
    exam_name: r.exam.name,
    exam_type: r.exam.type,
    exam_date: r.exam.exam_date?.toISOString().split("T")[0],
    subject: r.exam.subject,
    marks_obtained: r.marks_obtained?.toString(),
    max_marks: r.exam.max_marks.toString(),
    grade: r.grade,
    grade_label: r.grade_label,
    is_absent: r.is_absent,
    remarks: r.remarks,
    published_at: r.published_at?.toISOString()
  }));
};

export const getStudentTimetable = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const enrollments = await prisma.student_section_enrollments.findMany({
    where: { student_id: student.id, status: "active" },
    include: { section: true },
    take: 1
  });

  const enrollment = enrollments[0];
  if (!enrollment) {
    return [];
  }

  const slots = await prisma.timetable_slots.findMany({
    where: {
      section_id: enrollment.section_id,
      deleted_at: null
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: { id: true, name: true } },
      period: { select: { id: true, name: true, start_time: true, end_time: true, is_break: true, sort_order: true } }
    },
    orderBy: [{ day_of_week: "asc" }, { period: { sort_order: "asc" } }]
  });

  return slots.map(s => ({
    id: s.id.toString(),
    day_of_week: s.day_of_week,
    period: {
      id: s.period.id.toString(),
      name: s.period.name,
      start_time: s.period.start_time.toISOString().split("T")[1]?.slice(0, 5),
      end_time: s.period.end_time.toISOString().split("T")[1]?.slice(0, 5),
      is_break: s.period.is_break,
      sort_order: s.period.sort_order
    },
    subject: s.subject,
    teacher: s.teacher,
    room: s.room
  }));
};

/**
 * Published report cards for a parent's child — one card per term that has at
 * least one published result. Only results the school has published are ever
 * included, mirroring the admin report-card service.
 */
export const getStudentReports = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const [school, enrollment] = await Promise.all([
    prisma.schools.findFirst({
      where: { id: student.school_id, deleted_at: null },
      select: { id: true, name: true, logo_url: true }
    }),
    prisma.student_section_enrollments.findFirst({
      where: { student_id: student.id, status: "active" },
      include: { section: true },
      orderBy: { enrolled_at: "desc" }
    })
  ]);

  const section = enrollment?.section ?? null;

  // Terms the student has published results in — the ones that count as
  // "published by the school".
  const termRows = await prisma.exam_results.findMany({
    where: {
      student_id: student.id,
      published_at: { not: null },
      exam: { status: "completed", term_id: { not: null } }
    },
    select: {
      exam: { select: { term_id: true } }
    },
    distinct: ["exam_id"]
  });

  const termIds = [
    ...new Set(
      termRows
        .map(r => r.exam.term_id)
        .filter((t): t is bigint => t !== null)
    )
  ];

  const terms = termIds.length
    ? await prisma.terms.findMany({
        where: { id: { in: termIds }, school_id: student.school_id, deleted_at: null },
        include: { academic_year: true }
      })
    : [];

  terms.sort((a, b) => b.start_date.getTime() - a.start_date.getTime());

  if (terms.length === 0) {
    return {
      school: school ? { id: school.id.toString(), name: school.name, logo_url: school.logo_url } : null,
      student: { id: student.id.toString(), first_name: student.first_name, last_name: student.last_name },
      section: section ? { id: section.id.toString(), name: section.name, full_name: section.full_name } : null,
      reports: []
    };
  }

  // Class rank: same ranking the admin's section report card uses — every
  // student in the section, ranked by their average across published results
  // in the term.
  const sectionStudents = section
    ? await prisma.student_section_enrollments.findMany({
        where: { section_id: section.id, status: "active" },
        select: { student_id: true }
      })
    : [];

  const resolvedTermIds = terms.map(t => t.id);
  const sectionStudentIds = sectionStudents.map(s => s.student_id);

  const rankRows = await prisma.exam_results.findMany({
    where: {
      student_id: { in: sectionStudentIds },
      published_at: { not: null },
      exam: { status: "completed", term_id: { in: resolvedTermIds } }
    },
    select: {
      student_id: true,
      marks_obtained: true,
      is_absent: true,
      exam: { select: { term_id: true, max_marks: true } }
    }
  });

  const cards = [];
  for (const term of terms) {
    const results = await prisma.exam_results.findMany({
      where: {
        student_id: student.id,
        published_at: { not: null },
        exam: {
          status: "completed",
          term_id: term.id
        }
      },
      select: {
        marks_obtained: true,
        is_absent: true,
        remarks: true,
        exam: {
          select: {
            max_marks: true,
            subject: { select: { id: true, name: true, code: true } }
          }
        }
      }
    });

    const subjects = buildSubjectRows(results);
    const ranked = rankRows.filter(
      r => r.exam.term_id?.toString() === term.id.toString()
    );

    const classSize = sectionStudents.length || 0;
    const scores = new Map<string, number[]>();
    for (const r of ranked) {
      const max = Number(r.exam.max_marks);
      if (max <= 0 || r.is_absent || r.marks_obtained === null) continue;
      const key = r.student_id.toString();
      const arr = scores.get(key) ?? [];
      arr.push((Number(r.marks_obtained) / max) * 100);
      scores.set(key, arr);
    }

    const averages = [...scores.entries()]
      .map(([id, pcts]) => ({ id, avg: pcts.reduce((a, b) => a + b, 0) / pcts.length }))
      .sort((a, b) => b.avg - a.avg);

    const myScore = scores.get(student.id.toString());
    const myAvg = myScore && myScore.length > 0
      ? myScore.reduce((a, b) => a + b, 0) / myScore.length
      : null;

    const classPosition = myAvg !== null
      ? averages.filter(a => a.avg > myAvg).length + 1
      : null;

    const subjectAverages = subjects
      .map(s => s.percentage)
      .filter((p): p is number => p !== null);
    const overallAverage = subjectAverages.length > 0
      ? Math.round(
          (subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length) * 10
        ) / 10
      : null;

    cards.push({
      term: {
        id: term.id.toString(),
        name: term.name,
        start_date: term.start_date,
        end_date: term.end_date,
        is_current: term.is_current,
        academic_year: term.academic_year?.name ?? null
      },
      overall_average: overallAverage,
      class_position: classPosition,
      class_size: classSize,
      subjects
    });
  }

  return {
    school: school
      ? { id: school.id.toString(), name: school.name, logo_url: school.logo_url }
      : null,
    student: {
      id: student.id.toString(),
      first_name: student.first_name,
      last_name: student.last_name
    },
    section: section
      ? { id: section.id.toString(), name: section.name, full_name: section.full_name }
      : null,
    reports: cards
  };
};

export const requestStudentLeave = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint,
  input: {
    leave_type: StudentLeaveType;
    start_date: string;
    end_date: string;
    reason?: string;
  }
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const startDate = new Date(input.start_date);
  const endDate = new Date(input.end_date);
  assertDates(startDate, endDate);

  // The overlap check and the insert share one transaction so two concurrent
  // submissions can't both pass the check and create duplicate leaves.
  const leave = await prisma.$transaction(async (tx) => {
    await assertNoLeaveConflict(
      tx,
      student.school_id,
      student.id,
      startDate,
      endDate
    );

    return tx.student_leave_requests.create({
      data: {
        school_id: student.school_id,
        student_id: student.id,
        parent_id: toBigInt(parentId),
        leave_type: input.leave_type,
        start_date: startDate,
        end_date: endDate,
        reason: input.reason ?? null,
        status: "pending"
      }
    });
  });

  // Keep the action in the same notification inbox as decisions and school
  // broadcasts, so the parent has a complete audit trail.
  try {
    await createNotification(parentId, student.school_id, {
      title: "Leave Request Submitted",
      body: `Your leave request for ${student.first_name} ${student.last_name} is awaiting approval.`,
      type: "leave_submitted",
      studentId: student.id,
      metadata: {
        leave_id: leave.id.toString(),
        start_date: leave.start_date.toISOString().split("T")[0],
        end_date: leave.end_date.toISOString().split("T")[0]
      }
    });
  } catch {
    // A notification failure must not turn a successful leave request into a
    // failed API action.
  }

  return {
    id: leave.id.toString(),
    student_id: leave.student_id.toString(),
    leave_type: leave.leave_type,
    start_date: leave.start_date.toISOString().split("T")[0],
    end_date: leave.end_date.toISOString().split("T")[0],
    reason: leave.reason,
    status: leave.status,
    created_at: leave.created_at.toISOString()
  };
};

/// Lets a parent withdraw their own still-pending request. Approved and
/// rejected leaves are terminal — only an admin can revisit those.
export const cancelStudentLeave = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint,
  leaveId: string | number | bigint
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const leave = await prisma.student_leave_requests.findFirst({
    where: {
      id: toBigInt(leaveId),
      student_id: student.id,
      parent_id: toBigInt(parentId)
    }
  });

  if (!leave) {
    throw new AppError("not_found", "Leave request not found", 404);
  }

  if (leave.status !== "pending") {
    throw new AppError(
      "bad_request",
      `Cannot cancel a leave that is already ${leave.status}`,
      400
    );
  }

  const updated = await prisma.student_leave_requests.update({
    where: { id: leave.id },
    data: { status: "cancelled" }
  });

  try {
    await createNotification(parentId, student.school_id, {
      title: "Leave Request Withdrawn",
      body: `The leave request for ${student.first_name} ${student.last_name} was withdrawn.`,
      type: "leave_cancelled",
      studentId: student.id,
      metadata: { leave_id: updated.id.toString() }
    });
  } catch {
    // The leave status change remains successful if notification storage fails.
  }

  return {
    id: updated.id.toString(),
    student_id: updated.student_id.toString(),
    status: updated.status
  };
};

export const getStudentLeaves = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const leaves = await prisma.student_leave_requests.findMany({
    where: {
      student_id: student.id,
      parent_id: toBigInt(parentId)
    },
    include: {
      approved_by_user: { select: { id: true, name: true } }
    },
    orderBy: { created_at: "desc" }
  });

  return leaves.map(l => ({
    id: l.id.toString(),
    student_id: l.student_id.toString(),
    leave_type: l.leave_type,
    start_date: l.start_date.toISOString().split("T")[0],
    end_date: l.end_date.toISOString().split("T")[0],
    reason: l.reason,
    status: l.status,
    rejection_reason: l.rejection_reason,
    approved_by: l.approved_by_user ? { id: l.approved_by_user.id.toString(), name: l.approved_by_user.name } : null,
    approved_at: l.approved_at?.toISOString(),
    created_at: l.created_at.toISOString()
  }));
};

// ── Finance ─────────────────────────────────────────────────────────────────

export const getStudentFeeSummary = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const assignments = await prisma.student_fee_assignments.findMany({
    where: { student_id: student.id, school_id: student.school_id },
    include: {
      fee_structure: {
        select: { id: true, name: true, amount: true, currency: true, due_date: true }
      }
    },
    orderBy: { created_at: "desc" }
  });

  const totalDue = assignments.reduce((sum, a) => sum + Number(a.amount_due), 0);
  const totalPaid = assignments.reduce((sum, a) => sum + Number(a.amount_paid), 0);
  const balance = assignments.reduce((sum, a) => sum + Number(a.balance), 0);

  return {
    total_due: totalDue.toFixed(2),
    total_paid: totalPaid.toFixed(2),
    balance: balance.toFixed(2),
    currency: assignments[0]?.fee_structure.currency ?? "RWF",
    assignments: assignments.map(a => ({
      id: a.id.toString(),
      fee_structure_id: a.fee_structure_id.toString(),
      name: a.fee_structure.name,
      amount_due: a.amount_due.toString(),
      amount_paid: a.amount_paid.toString(),
      balance: a.balance.toString(),
      status: a.status,
      due_date: a.due_date?.toISOString().split("T")[0],
      due_date_original: a.fee_structure.due_date?.toISOString().split("T")[0],
      currency: a.fee_structure.currency
    }))
  };
};

export const getStudentInvoices = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const invoices = await prisma.student_invoices.findMany({
    where: { student_id: student.id, school_id: student.school_id, deleted_at: null },
    include: {
      items: {
        select: { id: true, label: true, amount: true }
      }
    },
    orderBy: { issue_date: "desc" }
  });

  return invoices.map(inv => ({
    id: inv.id.toString(),
    invoice_number: inv.invoice_number,
    issue_date: inv.issue_date.toISOString().split("T")[0],
    due_date: inv.due_date.toISOString().split("T")[0],
    subtotal: inv.subtotal.toString(),
    discount: inv.discount.toString(),
    previous_balance: inv.previous_balance.toString(),
    late_charges: inv.late_charges.toString(),
    total: inv.total.toString(),
    amount_paid: inv.amount_paid.toString(),
    balance: (Number(inv.total) - Number(inv.amount_paid)).toFixed(2),
    currency: inv.currency,
    status: inv.status,
    notes: inv.notes,
    document_url: inv.document_url,
    items: inv.items.map(item => ({
      id: item.id.toString(),
      label: item.label,
      amount: item.amount.toString()
    }))
  }));
};

export const getStudentInvoiceById = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint,
  invoiceId: string | number | bigint
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const invoice = await prisma.student_invoices.findFirst({
    where: {
      id: toBigInt(invoiceId),
      student_id: student.id,
      school_id: student.school_id,
      deleted_at: null
    },
    include: {
      items: {
        select: { id: true, label: true, amount: true }
      }
    }
  });

  if (!invoice) {
    throw new AppError("not_found", "Invoice not found", 404);
  }

  return {
    id: invoice.id.toString(),
    invoice_number: invoice.invoice_number,
    issue_date: invoice.issue_date.toISOString().split("T")[0],
    due_date: invoice.due_date.toISOString().split("T")[0],
    subtotal: invoice.subtotal.toString(),
    discount: invoice.discount.toString(),
    previous_balance: invoice.previous_balance.toString(),
    late_charges: invoice.late_charges.toString(),
    total: invoice.total.toString(),
    amount_paid: invoice.amount_paid.toString(),
    balance: (Number(invoice.total) - Number(invoice.amount_paid)).toFixed(2),
    currency: invoice.currency,
    status: invoice.status,
    notes: invoice.notes,
    document_url: invoice.document_url,
    items: invoice.items.map(item => ({
      id: item.id.toString(),
      label: item.label,
      amount: item.amount.toString()
    }))
  };
};

export const getStudentTransactions = async (
  parentId: string | number | bigint,
  studentId: string | number | bigint
) => {
  const student = await assertParentStudentLink(parentId, studentId);

  const transactions = await prisma.fee_transactions.findMany({
    where: { student_id: student.id, school_id: student.school_id },
    orderBy: { paid_at: "desc" },
    take: 50
  });

  return transactions.map(t => ({
    id: t.id.toString(),
    receipt_number: t.receipt_number,
    amount: t.amount.toString(),
    currency: t.currency,
    payment_method: t.payment_method,
    payment_ref: t.payment_ref,
    paid_at: t.paid_at.toISOString(),
    notes: t.notes,
    receipt_url: t.receipt_url
  }));
};

// ── Notifications ───────────────────────────────────────────────────────────

/// Pass [tx] when the notification must be committed atomically with the
/// action that triggered it (e.g. approving a leave) — otherwise the parent can
/// be told about a change that later rolls back.
export const createNotification = async (
  parentId: string | number | bigint,
  schoolId: string | number | bigint,
  input: {
    title: string;
    body: string;
    type: string;
    studentId?: string | number | bigint;
    metadata?: Record<string, unknown>;
  },
  tx?: Prisma.TransactionClient
) => {
  const db = tx ?? prisma;
  const notification = await db.parent_app_notifications.create({
    data: {
      parent_id: toBigInt(parentId),
      school_id: toBigInt(schoolId),
      student_id: input.studentId ? toBigInt(input.studentId) : null,
      title: input.title,
      body: input.body,
      type: input.type,
      metadata: (input.metadata ?? Prisma.DbNull) as Prisma.InputJsonValue
    }
  });

  return {
    id: notification.id.toString(),
    title: notification.title,
    body: notification.body,
    type: notification.type,
    student_id: notification.student_id?.toString() ?? null,
    is_read: notification.is_read,
    metadata: notification.metadata,
    created_at: notification.created_at.toISOString()
  };
};

/// Creates the same event for every parent linked to one or more students.
/// School and student constraints are applied together to keep notification
/// fan-out tenant-safe.
export const createStudentNotifications = async (
  schoolId: string | number | bigint,
  studentIds: Array<string | number | bigint>,
  input: {
    title: string;
    body: string;
    type: string;
    metadata?: Record<string, unknown>;
  }
) => {
  const ids = studentIds.map(toBigInt);
  if (ids.length === 0) return [];

  const links = await prisma.student_parent_links.findMany({
    where: {
      student_id: { in: ids },
      student: { school_id: toBigInt(schoolId) }
    },
    select: { parent_id: true, student_id: true }
  });

  return Promise.all(
    links.map((link) =>
      createNotification(link.parent_id, schoolId, {
        ...input,
        studentId: link.student_id
      })
    )
  );
};

export const getNotifications = async (
  parentId: string | number | bigint,
  pagination: { page: number; limit: number } = { page: 1, limit: 20 }
) => {
  const { page, limit } = pagination;
  const where = { parent_id: toBigInt(parentId) };

  const [notifications, total] = await prisma.$transaction([
    prisma.parent_app_notifications.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.parent_app_notifications.count({ where })
  ]);

  return {
    data: notifications.map(n => ({
      id: n.id.toString(),
      title: n.title,
      body: n.body,
      type: n.type,
      student_id: n.student_id?.toString() ?? null,
      is_read: n.is_read,
      metadata: n.metadata,
      created_at: n.created_at.toISOString()
    })),
    meta: { page, limit, total }
  };
};

export const markNotificationRead = async (
  parentId: string | number | bigint,
  notificationId: string | number | bigint
) => {
  const notification = await prisma.parent_app_notifications.findFirst({
    where: {
      id: toBigInt(notificationId),
      parent_id: toBigInt(parentId)
    }
  });

  if (!notification) {
    throw new AppError("not_found", "Notification not found", 404);
  }

  await prisma.parent_app_notifications.update({
    where: { id: notification.id },
    data: { is_read: true }
  });

  return { message: "Notification marked as read" };
};

export const getUnreadNotificationCount = async (
  parentId: string | number | bigint
) => {
  const count = await prisma.parent_app_notifications.count({
    where: {
      parent_id: toBigInt(parentId),
      is_read: false
    }
  });

  return { unread_count: count };
};
