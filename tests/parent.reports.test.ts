import type { Prisma } from "@prisma/client";

type MockPrisma = {
  students: { findUnique: jest.Mock };
  student_parent_links: { findFirst: jest.Mock };
  schools: { findFirst: jest.Mock };
  student_section_enrollments: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  exam_results: { findMany: jest.Mock };
  terms: { findMany: jest.Mock };
};

const tx: MockPrisma = {
  students: { findUnique: jest.fn() },
  student_parent_links: { findFirst: jest.fn() },
  schools: { findFirst: jest.fn() },
  student_section_enrollments: { findFirst: jest.fn(), findMany: jest.fn() },
  exam_results: { findMany: jest.fn() },
  terms: { findMany: jest.fn() }
};

jest.mock("../src/database/prisma", () => ({
  prisma: tx
}));

jest.mock("../src/services/report-card.service", () => ({
  buildSubjectRows: jest.fn()
}));

const service = require("../src/services/app.service") as {
  getStudentReports: (
    parentId: string | number | bigint,
    studentId: string | number | bigint
  ) => Promise<{
    reports: Array<{
      overall_average: number | null;
      class_position: number | null;
      class_size: number;
    }>;
  }>;
};

const buildSubjectRowsMock = require("../src/services/report-card.service")
  .buildSubjectRows as jest.Mock;

const decimal = (value: number) => value as unknown as Prisma.Decimal;

beforeEach(() => {
  Object.values(tx).forEach((model) =>
    Object.values(model).forEach((fn) => (fn as jest.Mock).mockReset())
  );

  buildSubjectRowsMock.mockReset();
  buildSubjectRowsMock.mockImplementation((results: unknown[]) =>
    results.map((r, i) => ({
      subject_id: `${i + 1}`,
      subject_name: `Subject ${i + 1}`,
      subject_code: `S${i + 1}`,
      percentage: 80,
      grade: "A",
      comments: null,
      is_absent: false
    }))
  );

  tx.students.findUnique.mockResolvedValue({
    id: 3n,
    school_id: 1n,
    first_name: "Ethan",
    last_name: "Mugisha"
  });

  tx.student_parent_links.findFirst.mockResolvedValue({ id: 1n });

  tx.schools.findFirst.mockResolvedValue({
    id: 1n,
    name: "Test School",
    logo_url: null
  });

  tx.student_section_enrollments.findFirst.mockResolvedValue({
    section: { id: 5n, name: "A", full_name: "Grade 5 • Section A" }
  });

  tx.student_section_enrollments.findMany.mockResolvedValue([
    { student_id: 3n },
    { student_id: 4n },
    { student_id: 5n }
  ]);

  // First call: terms the student has published results in (term rows).
  // Second call: results for the card itself.
  tx.exam_results.findMany
    .mockResolvedValueOnce([{ exam: { term_id: 10n } }])
    .mockResolvedValueOnce([
      {
        student_id: 3n,
        marks_obtained: decimal(85),
        is_absent: false,
        exam: { term_id: 10n, max_marks: decimal(100) }
      },
      {
        student_id: 4n,
        marks_obtained: decimal(70),
        is_absent: false,
        exam: { term_id: 10n, max_marks: decimal(100) }
      },
      {
        student_id: 5n,
        marks_obtained: decimal(60),
        is_absent: false,
        exam: { term_id: 10n, max_marks: decimal(100) }
      }
    ])
    .mockResolvedValueOnce([
      {
        marks_obtained: decimal(85),
        is_absent: false,
        remarks: "Good",
        exam: { max_marks: decimal(100), subject: { id: 7n, name: "Math", code: "M" } }
      }
    ]);

  tx.terms.findMany.mockResolvedValue([
    {
      id: 10n,
      name: "Term 2",
      start_date: new Date("2026-01-01"),
      end_date: new Date("2026-04-30"),
      is_current: true,
      academic_year: { name: "2026" }
    }
  ]);
});

describe("getStudentReports", () => {
  it("returns published reports only, with ranking", async () => {
    const result = await service.getStudentReports(1, 3);

    expect(result.reports).toHaveLength(1);
    const card = result.reports[0];
    expect(card.overall_average).toBe(80);
    expect(card.class_size).toBe(3);
    // Student 3 (85%) outranks 4 (70%) and 5 (60%) -> position 1.
    expect(card.class_position).toBe(1);
  });

  it("rejects a parent not linked to the student", async () => {
    tx.student_parent_links.findFirst.mockResolvedValue(null);

    await expect(service.getStudentReports(1, 99)).rejects.toMatchObject({
      statusCode: 403,
      code: "forbidden"
    });
  });

  it("returns an empty reports array when nothing is published", async () => {
    tx.exam_results.findMany
      .mockReset()
      .mockResolvedValueOnce([]);

    const result = await service.getStudentReports(1, 3);
    expect(result.reports).toEqual([]);
  });
});
