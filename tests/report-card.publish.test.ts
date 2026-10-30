type MockPrisma = {
  sections: { findFirst: jest.Mock };
  terms: { findFirst: jest.Mock };
  exams: { findMany: jest.Mock; update: jest.Mock };
  exam_results: { count: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};

const tx: MockPrisma = {
  sections: { findFirst: jest.fn() },
  terms: { findFirst: jest.fn() },
  exams: { findMany: jest.fn(), update: jest.fn() },
  exam_results: { count: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn()
};

jest.mock("../src/database/prisma", () => ({
  prisma: tx
}));

const service = require("../src/services/report-card.service") as {
  publishSectionReportCards: (
    schoolId: string | number | bigint,
    sectionId: string,
    termId: string | undefined,
    publishedBy?: string | number | bigint
  ) => Promise<{
    published_exams: number;
    published_results: number;
    published: Array<{ id: string; name: string; results_published: number }>;
    skipped: Array<{ id: string; name: string; reason: string }>;
  }>;
};

beforeEach(() => {
  Object.values(tx).forEach((model) =>
    Object.values(model)
      .filter((fn) => typeof fn === "function" && typeof (fn as jest.Mock).mockReset === "function")
      .forEach((fn) => (fn as jest.Mock).mockReset())
  );

  tx.sections.findFirst.mockResolvedValue({
    id: 5n,
    name: "A",
    full_name: "Grade 5 • Section A"
  });

  tx.terms.findFirst.mockResolvedValue({
    id: 10n,
    name: "Term 2",
    start_date: new Date("2026-01-01"),
    end_date: new Date("2026-04-30"),
    academic_year: { name: "2026" }
  });

  tx.exams.findMany.mockResolvedValue([
    { id: 1n, name: "Math Exam", published_at: null },
    { id: 2n, name: "English Exam", published_at: null },
    { id: 3n, name: "Already Done", published_at: new Date("2026-07-01") }
  ]);

  tx.exam_results.count.mockResolvedValue(10);

  tx.$transaction.mockImplementation(
    (args: Array<{ then?: unknown }>) => Promise.resolve(args)
  );
});

describe("publishSectionReportCards", () => {
  it("publishes every exam with marks for the section and term", async () => {
    const result = await service.publishSectionReportCards(1, "5", "10", 9);

    expect(result.published_exams).toBe(2);
    expect(result.published_results).toBe(20);
    expect(result.published.map((item) => item.id)).toEqual(["1", "2"]);
    expect(result.skipped.map((item) => item.id)).toEqual(["3"]);
    expect(result.skipped[0].reason).toBe("already published");
    expect(tx.exam_results.count).toHaveBeenCalledTimes(3);
    expect(tx.$transaction).toHaveBeenCalledTimes(2);
  });

  it("skips exams with no recorded marks", async () => {
    tx.exam_results.count.mockResolvedValue(0);

    const result = await service.publishSectionReportCards(1, "5", "10");

    expect(result.published_exams).toBe(0);
    expect(tx.$transaction).not.toHaveBeenCalled();
    expect(result.skipped[0].reason).toBe("no marks recorded");
  });

  it("rejects an unknown section", async () => {
    tx.sections.findFirst.mockResolvedValue(null);

    await expect(service.publishSectionReportCards(1, "99", "10")).rejects.toMatchObject({
      statusCode: 404,
      code: "not_found"
    });
  });
});
