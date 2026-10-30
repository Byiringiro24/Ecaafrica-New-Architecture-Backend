import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma";
import { AppError } from "../middleware/errorHandler";
import { createStudentNotifications } from "./app.service";

type ReportCardSubjectRow = {
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  percentage: number | null;
  grade: string | null;
  comments: string | null;
  is_absent: boolean;
};

export type { ReportCardSubjectRow };

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
};

const assertNumericId = (value: string, label: string) => {
  if (!/^\d+$/.test(value)) {
    throw new AppError("bad_request", `Invalid ${label}`, 400);
  }
};

// Same thresholds the teacher sees when entering marks (exam-result.service.ts)
export const gradeFromPercent = (percent: number): string => {
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  return "F";
};

const resolveTerm = async (
  schoolId: string | number | bigint,
  termId?: string
) => {
  if (termId) {
    assertNumericId(termId, "term id");
    const term = await prisma.terms.findFirst({
      where: {
        id: toBigInt(termId),
        school_id: toBigInt(schoolId),
        deleted_at: null
      },
      include: { academic_year: true }
    });

    if (!term) {
      throw new AppError("not_found", "Term not found", 404);
    }

    return term;
  }

  const current = await prisma.terms.findFirst({
    where: {
      school_id: toBigInt(schoolId),
      is_current: true,
      deleted_at: null
    },
    include: { academic_year: true }
  });

  if (!current) {
    throw new AppError(
      "not_found",
      "No current term is set. Select a term or mark one as current.",
      404
    );
  }

  return current;
};

const loadSchool = async (schoolId: string | number | bigint) => {
  const school = await prisma.schools.findFirst({
    where: { id: toBigInt(schoolId), deleted_at: null },
    select: { id: true, name: true, logo_url: true }
  });

  if (!school) {
    throw new AppError("not_found", "School not found", 404);
  }

  return { name: school.name, logo_url: school.logo_url };
};

// Only published results reach a report card. One row per subject; if a subject
// has several published exams in the term we average their percentages so the
// card shows a single figure per subject.
export const buildSubjectRows = (
  results: Array<{
    marks_obtained: Prisma.Decimal | null;
    is_absent: boolean;
    remarks: string | null;
    exam: {
      max_marks: Prisma.Decimal;
      subject: { id: bigint; name: string; code: string | null };
    };
  }>
): ReportCardSubjectRow[] => {
  const bySubject = new Map<
    string,
    {
      subject_id: string;
      subject_name: string;
      subject_code: string | null;
      percentages: number[];
      comments: string[];
      absentCount: number;
      total: number;
    }
  >();

  for (const result of results) {
    const subject = result.exam.subject;
    const key = subject.id.toString();
    const entry = bySubject.get(key) ?? {
      subject_id: key,
      subject_name: subject.name,
      subject_code: subject.code,
      percentages: [],
      comments: [],
      absentCount: 0,
      total: 0
    };

    entry.total += 1;

    if (result.is_absent) {
      entry.absentCount += 1;
    } else if (result.marks_obtained !== null) {
      const maxMarks = Number(result.exam.max_marks);
      if (maxMarks > 0) {
        entry.percentages.push((Number(result.marks_obtained) / maxMarks) * 100);
      }
    }

    if (result.remarks) {
      entry.comments.push(result.remarks);
    }

    bySubject.set(key, entry);
  }

  return Array.from(bySubject.values())
    .map((entry) => {
      const percentage =
        entry.percentages.length > 0
          ? Math.round(
              entry.percentages.reduce((a, b) => a + b, 0) / entry.percentages.length
            )
          : null;

      return {
        subject_id: entry.subject_id,
        subject_name: entry.subject_name,
        subject_code: entry.subject_code,
        percentage,
        grade: percentage !== null ? gradeFromPercent(percentage) : null,
        comments: entry.comments.join("; ") || null,
        is_absent: entry.absentCount === entry.total
      };
    })
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
};

const loadStudentCard = async (
  schoolId: string | number | bigint,
  studentId: bigint,
  term: { id: bigint; name: string; start_date: Date; end_date: Date }
) => {
  const student = await prisma.students.findFirst({
    where: {
      id: studentId,
      school_id: toBigInt(schoolId),
      deleted_at: null
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      other_names: true,
      student_id_number: true,
      student_section_enrollments: {
        where: { status: "active" },
        orderBy: { enrolled_at: "desc" },
        take: 1,
        select: {
          section: { select: { id: true, name: true, full_name: true } }
        }
      }
    }
  });

  if (!student) {
    throw new AppError("not_found", "Student not found", 404);
  }

  const results = await prisma.exam_results.findMany({
    where: {
      school_id: toBigInt(schoolId),
      student_id: studentId,
      published_at: { not: null },
      exam: {
        OR: [
          { term_id: term.id },
          {
            term_id: null,
            exam_date: { gte: term.start_date, lte: term.end_date }
          }
        ]
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

  const section = student.student_section_enrollments[0]?.section ?? null;

  return {
    student: {
      id: student.id.toString(),
      first_name: student.first_name,
      last_name: student.last_name,
      other_names: student.other_names,
      full_name: [student.first_name, student.other_names, student.last_name]
        .filter(Boolean)
        .join(" "),
      student_id_number: student.student_id_number,
      section: section
        ? { id: section.id.toString(), name: section.name, full_name: section.full_name }
        : null
    },
    subjects: buildSubjectRows(results)
  };
};

const loadPreparerName = async (userId?: string | number | bigint) => {
  if (!userId) return null;

  const user = await prisma.users.findFirst({
    where: { id: toBigInt(userId) },
    select: { name: true }
  });

  return user?.name ?? null;
};

export const getStudentReportCard = async (
  schoolId: string | number | bigint,
  studentId: string,
  termId: string | undefined,
  preparedBy?: string | number | bigint
) => {
  assertNumericId(studentId, "student id");

  const [school, term, preparerName] = await Promise.all([
    loadSchool(schoolId),
    resolveTerm(schoolId, termId),
    loadPreparerName(preparedBy)
  ]);

  const card = await loadStudentCard(schoolId, toBigInt(studentId), term);

  return {
    school,
    term: {
      id: term.id.toString(),
      name: term.name,
      start_date: term.start_date,
      end_date: term.end_date,
      academic_year: term.academic_year?.name ?? null
    },
    prepared_by: preparerName,
    issued_on: new Date(),
    ...card
  };
};

export const getSectionReportCards = async (
  schoolId: string | number | bigint,
  sectionId: string,
  termId: string | undefined,
  preparedBy?: string | number | bigint
) => {
  assertNumericId(sectionId, "section id");

  const [school, term, preparerName] = await Promise.all([
    loadSchool(schoolId),
    resolveTerm(schoolId, termId),
    loadPreparerName(preparedBy)
  ]);

  const section = await prisma.sections.findFirst({
    where: {
      id: toBigInt(sectionId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    },
    select: { id: true, name: true, full_name: true }
  });

  if (!section) {
    throw new AppError("not_found", "Section not found", 404);
  }

  const enrollments = await prisma.student_section_enrollments.findMany({
    where: {
      school_id: toBigInt(schoolId),
      section_id: section.id,
      status: "active"
    },
    select: { student_id: true }
  });

  const cards = [];
  for (const enrollment of enrollments) {
    cards.push(await loadStudentCard(schoolId, enrollment.student_id, term));
  }

  cards.sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));

  return {
    school,
    term: {
      id: term.id.toString(),
      name: term.name,
      start_date: term.start_date,
      end_date: term.end_date,
      academic_year: term.academic_year?.name ?? null
    },
    section: {
      id: section.id.toString(),
      name: section.name,
      full_name: section.full_name
    },
    prepared_by: preparerName,
    issued_on: new Date(),
    cards
  };
};

export const publishSectionReportCards = async (
  schoolId: string | number | bigint,
  sectionId: string,
  termId: string | undefined,
  publishedBy?: string | number | bigint
) => {
  assertNumericId(sectionId, "section id");

  const section = await prisma.sections.findFirst({
    where: {
      id: toBigInt(sectionId),
      school_id: toBigInt(schoolId),
      deleted_at: null
    },
    select: { id: true, name: true, full_name: true }
  });

  if (!section) {
    throw new AppError("not_found", "Section not found", 404);
  }

  const term = await resolveTerm(schoolId, termId);

  const exams = await prisma.exams.findMany({
    where: {
      school_id: toBigInt(schoolId),
      section_id: section.id,
      status: { not: "cancelled" },
      OR: [
        { term_id: term.id },
        {
          term_id: null,
          exam_date: { gte: term.start_date, lte: term.end_date }
        }
      ]
    },
    select: { id: true, name: true, published_at: true }
  });

  const published = [];
  const skipped = [];

  for (const exam of exams) {
    const resultCount = await prisma.exam_results.count({
      where: { exam_id: exam.id }
    });

    if (resultCount === 0 || exam.published_at) {
      skipped.push({
        id: exam.id.toString(),
        name: exam.name,
        reason: resultCount === 0 ? "no marks recorded" : "already published"
      });
      continue;
    }

    const publishedAt = new Date();
    await prisma.$transaction([
      prisma.exam_results.updateMany({
        where: { exam_id: exam.id },
        data: { published_at: publishedAt }
      }),
      prisma.exams.update({
        where: { id: exam.id },
        data: {
          status: "completed",
          published_at: publishedAt,
          published_by: publishedBy ? toBigInt(publishedBy) : null
        }
      })
    ]);

    published.push({
      id: exam.id.toString(),
      name: exam.name,
      results_published: resultCount
    });
  }

  if (published.length > 0) {
    try {
      const students = await prisma.student_section_enrollments.findMany({
        where: {
          section_id: section.id,
          status: "active",
          left_at: null
        },
        select: { student_id: true }
      });
      await createStudentNotifications(
        schoolId,
        students.map((student) => student.student_id),
        {
          title: "Report Cards Published",
          body: `${term.name} report card results are now available to view.`,
          type: "grade_published",
          metadata: {
            section_id: section.id.toString(),
            term_id: term.id.toString(),
            exam_ids: published.map((exam) => exam.id)
          }
        }
      );
    } catch {
      // Publication has completed; notification delivery is non-blocking.
    }
  }

  return {
    section: {
      id: section.id.toString(),
      name: section.name,
      full_name: section.full_name
    },
    term: {
      id: term.id.toString(),
      name: term.name,
      academic_year: term.academic_year?.name ?? null
    },
    published,
    skipped,
    published_exams: published.length,
    published_results: published.reduce((sum, item) => sum + item.results_published, 0)
  };
};
