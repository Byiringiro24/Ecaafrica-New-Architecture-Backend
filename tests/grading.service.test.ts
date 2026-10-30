import type { Prisma } from "@prisma/client";

type MockTx = {
  exams: { findFirst: jest.Mock; update: jest.Mock };
  students: { findFirst: jest.Mock };
  grading_roles: { findMany: jest.Mock };
  exam_results: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
  };
  teacher_section_subjects: { findFirst: jest.Mock };
};

const tx: MockTx = {
  exams: { findFirst: jest.fn(), update: jest.fn() },
  students: { findFirst: jest.fn() },
  grading_roles: { findMany: jest.fn() },
  exam_results: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn()
  },
  teacher_section_subjects: { findFirst: jest.fn() }
};

jest.mock("../src/database/prisma", () => ({
  prisma: {
    ...tx,
    $transaction: (fn: (client: unknown) => unknown) => fn(tx)
  }
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const service = require("../src/services/exam-result.service") as typeof import("../src/services/exam-result.service");

const decimal = (value: number) => value as unknown as Prisma.Decimal;

const buildExam = (overrides: Record<string, unknown> = {}) => ({
  id: 10n,
  school_id: 1n,
  section_id: 5n,
  subject_id: 7n,
  max_marks: decimal(100),
  pass_mark: decimal(50),
  published_at: null,
  ...overrides
});

const buildResult = (overrides: Record<string, unknown> = {}) => ({
  id: 99n,
  school_id: 1n,
  exam_id: 10n,
  student_id: 3n,
  marks_obtained: decimal(80),
  grade: "A",
  grade_label: null,
  is_absent: false,
  remarks: "Good work",
  entered_by: 2n,
  entered_at: new Date(),
  published_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

const TEACHER = { id: "2", role: "teacher" };
const ADMIN = { id: "9", role: "school_admin" };

beforeEach(() => {
  Object.values(tx).forEach((model) =>
    Object.values(model).forEach((fn) => (fn as jest.Mock).mockReset())
  );

  tx.exams.findFirst.mockResolvedValue(buildExam());
  tx.grading_roles.findMany.mockResolvedValue([]);
  tx.students.findFirst.mockResolvedValue({ id: 3n, school_id: 1n });
  tx.exam_results.findUnique.mockResolvedValue(null);
  tx.exam_results.findFirst.mockResolvedValue(buildResult());
  tx.exam_results.create.mockResolvedValue(buildResult());
  tx.exam_results.update.mockResolvedValue(buildResult());
  tx.exam_results.delete.mockResolvedValue(buildResult());
  tx.exam_results.updateMany.mockResolvedValue({ count: 3 });
  tx.exam_results.count.mockResolvedValue(3);
  tx.exams.update.mockResolvedValue(
    buildExam({ status: "completed", published_at: new Date(), published_by: 9n })
  );
  tx.teacher_section_subjects.findFirst.mockResolvedValue({ id: 1n });
});

describe("teacher may only grade their assigned class and subject", () => {
  it("rejects a teacher with no matching assignment", async () => {
    tx.teacher_section_subjects.findFirst.mockResolvedValue(null);

    await expect(
      service.bulkRecordResults(1, 10, [{ student_id: 3, score: 80 }], 2, TEACHER)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "forbidden"
    });
  });

  it("allows a teacher whose assignment matches the exam", async () => {
    await expect(
      service.bulkRecordResults(1, 10, [{ student_id: 3, score: 80 }], 2, TEACHER)
    ).resolves.toHaveLength(1);

    expect(tx.teacher_section_subjects.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teacher_id: 2n,
          section_id: 5n,
          subject_id: 7n,
          deleted_at: null
        })
      })
    );
  });

  it("does not run the assignment check for a school admin", async () => {
    await service.bulkRecordResults(1, 10, [{ student_id: 3, score: 80 }], 9, ADMIN);

    expect(tx.teacher_section_subjects.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a teacher when the exam has no class assigned", async () => {
    tx.exams.findFirst.mockResolvedValue(buildExam({ section_id: null }));

    await expect(
      service.bulkRecordResults(1, 10, [{ student_id: 3, score: 80 }], 2, TEACHER)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("marks are locked once published", () => {
  const publishedExam = buildExam({ published_at: new Date("2026-07-01") });

  it("blocks bulk recording with 409", async () => {
    tx.exams.findFirst.mockResolvedValue(publishedExam);

    await expect(
      service.bulkRecordResults(1, 10, [{ student_id: 3, score: 80 }], 2, TEACHER)
    ).rejects.toMatchObject({ statusCode: 409, code: "conflict" });
  });

  it("blocks a single result with 409", async () => {
    tx.exams.findFirst.mockResolvedValue(publishedExam);

    await expect(
      service.recordResult(1, { exam_id: 10, student_id: 3, score: 80 }, TEACHER)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("blocks an update with 409", async () => {
    tx.exams.findFirst.mockResolvedValue(publishedExam);

    await expect(
      service.updateResult(1, "99", { score: 90 }, 2, TEACHER)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("blocks a delete with 409", async () => {
    tx.exams.findFirst.mockResolvedValue(publishedExam);

    await expect(service.deleteResult(1, "99", TEACHER)).rejects.toMatchObject({
      statusCode: 409
    });
  });

  it("blocks an admin too — they must unpublish first", async () => {
    tx.exams.findFirst.mockResolvedValue(publishedExam);

    await expect(
      service.bulkRecordResults(1, 10, [{ student_id: 3, score: 80 }], 9, ADMIN)
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("publishing", () => {
  it("stamps published_at on every result and completes the exam", async () => {
    const result = await service.publishExamResults(1, "10", 9);

    expect(tx.exam_results.updateMany).toHaveBeenCalledWith({
      where: { exam_id: 10n },
      data: { published_at: expect.any(Date) }
    });
    expect(tx.exams.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: expect.objectContaining({
        status: "completed",
        published_by: 9n,
        published_at: expect.any(Date)
      })
    });
    expect(result.published_count).toBe(3);
  });

  it("refuses to publish an exam with no recorded marks", async () => {
    tx.exam_results.count.mockResolvedValue(0);

    await expect(service.publishExamResults(1, "10", 9)).rejects.toMatchObject({
      statusCode: 400
    });
    expect(tx.exam_results.updateMany).not.toHaveBeenCalled();
  });

  it("clears published_at on unpublish so teachers can edit again", async () => {
    tx.exams.findFirst.mockResolvedValue(
      buildExam({ published_at: new Date("2026-07-01") })
    );
    tx.exams.update.mockResolvedValue(
      buildExam({ status: "ongoing", published_at: null, published_by: null })
    );

    await service.unpublishExamResults(1, "10");

    expect(tx.exam_results.updateMany).toHaveBeenCalledWith({
      where: { exam_id: 10n },
      data: { published_at: null }
    });
    expect(tx.exams.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: { status: "ongoing", published_at: null, published_by: null }
    });
  });

  it("refuses to unpublish an exam that was never published", async () => {
    await expect(service.unpublishExamResults(1, "10")).rejects.toMatchObject({
      statusCode: 400
    });
  });
});
