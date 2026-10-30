import type { NextFunction, Request, Response } from "express";
import request from "supertest";

let currentRole = "school_admin";

jest.mock("../src/middleware/auth", () => ({
  verifyToken: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "1", school_id: "1", role: currentRole } as never;
    next();
  },
  verifyTokenOrPlatform: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "1", school_id: "1", role: currentRole } as never;
    next();
  },
  verifyPlatformToken: (_req: Request, _res: Response, next: NextFunction) => next()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../src/app") as typeof import("../src/app");

const NON_GRADING_ROLES = [
  "staff",
  "parent",
  "student",
  "gate_keeper",
  "director_of_discipline",
  "patron",
  "matron",
  "finance_officer"
];

describe("Only teachers and school admins may record marks", () => {
  for (const role of NON_GRADING_ROLES) {
    it(`rejects role "${role}" with 403 when recording marks`, async () => {
      currentRole = role;

      const bulk = await request(app)
        .post("/api/v1/exam-results/bulk")
        .send({ exam_id: "1", results: [{ student_id: "1", score: 50 }] });
      expect(bulk.status).toBe(403);
      expect(bulk.body.error.code).toBe("forbidden");

      const single = await request(app)
        .post("/api/v1/exam-results")
        .send({ exam_id: "1", student_id: "1", score: 50 });
      expect(single.status).toBe(403);

      const patch = await request(app)
        .patch("/api/v1/exam-results/1")
        .send({ score: 60 });
      expect(patch.status).toBe(403);

      const remove = await request(app).delete("/api/v1/exam-results/1");
      expect(remove.status).toBe(403);
    });

    it(`rejects role "${role}" with 403 when managing exams`, async () => {
      currentRole = role;

      const create = await request(app)
        .post("/api/v1/exams")
        .send({ name: "Term 1", subject_id: "1", section_id: "1", max_marks: 100 });
      expect(create.status).toBe(403);

      const patch = await request(app).patch("/api/v1/exams/1").send({ name: "Edited" });
      expect(patch.status).toBe(403);

      const remove = await request(app).delete("/api/v1/exams/1");
      expect(remove.status).toBe(403);
    });
  }

  for (const role of ["teacher", "school_admin"]) {
    it(`does not reject role "${role}" with 403 when recording marks`, async () => {
      currentRole = role;

      const res = await request(app)
        .post("/api/v1/exam-results/bulk")
        .send({ exam_id: "1", results: [{ student_id: "1", score: 50 }] });

      expect(res.status).not.toBe(403);
    });
  }
});

describe("Publishing is restricted to school admins", () => {
  for (const role of ["teacher", ...NON_GRADING_ROLES]) {
    it(`rejects role "${role}" with 403 on publish and unpublish`, async () => {
      currentRole = role;

      const publish = await request(app).post("/api/v1/exam-results/publish/1");
      expect(publish.status).toBe(403);
      expect(publish.body.error.code).toBe("forbidden");

      const unpublish = await request(app).post("/api/v1/exam-results/unpublish/1");
      expect(unpublish.status).toBe(403);
    });
  }

  it("does not reject the school_admin role with 403", async () => {
    currentRole = "school_admin";

    const publish = await request(app).post("/api/v1/exam-results/publish/1");
    expect(publish.status).not.toBe(403);
  });

  it("rejects a publish flag smuggled into the bulk payload", async () => {
    currentRole = "teacher";

    const res = await request(app)
      .post("/api/v1/exam-results/bulk")
      .send({
        exam_id: "1",
        results: [{ student_id: "1", score: 50 }],
        publish: true
      });

    // The validator strips unknown keys, so the request is never treated as a publish.
    expect(res.status).not.toBe(200);
    expect(res.body?.data?.published_at).toBeUndefined();
  });
});

describe("Report cards are restricted to school admins", () => {
  for (const role of ["teacher", ...NON_GRADING_ROLES]) {
    it(`rejects role "${role}" with 403`, async () => {
      currentRole = role;

      const student = await request(app).get("/api/v1/report-cards/student/1");
      expect(student.status).toBe(403);

      const section = await request(app).get("/api/v1/report-cards/section/1");
      expect(section.status).toBe(403);
    });
  }

  it("does not reject the school_admin role with 403", async () => {
    currentRole = "school_admin";

    const res = await request(app).get("/api/v1/report-cards/student/1");
    expect(res.status).not.toBe(403);
  });
});

describe("School logo upload is restricted to school admins", () => {
  for (const role of ["teacher", ...NON_GRADING_ROLES]) {
    it(`rejects role "${role}" with 403`, async () => {
      currentRole = role;

      const res = await request(app).patch("/api/v1/school/logo");
      expect(res.status).toBe(403);
    });
  }
});
