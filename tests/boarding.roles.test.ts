import type { NextFunction, Request, Response } from "express";
import request from "supertest";

let currentRole = "teacher";

jest.mock("../src/middleware/auth", () => ({
  verifyToken: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "1", school_id: "1", role: currentRole } as never;
    next();
  },
  verifyTokenOrPlatform: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
  verifyPlatformToken: (_req: Request, _res: Response, next: NextFunction) =>
    next(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../src/app") as typeof import("../src/app");

const boardingOperationalReadRoutes = [
  "/api/v1/boarding/dormitories",
  "/api/v1/boarding/rooms",
  "/api/v1/boarding/assignments",
  "/api/v1/boarding/roll-calls",
  "/api/v1/boarding/absence-alerts",
];

describe("boarding role boundaries", () => {
  afterEach(() => {
    currentRole = "teacher";
  });

  it.each([
    "teacher",
    "staff",
    "gate_keeper",
    "parent",
    "student",
    "finance_officer",
  ])("rejects %s from boarding operational reads", async (role) => {
    currentRole = role;

    for (const route of boardingOperationalReadRoutes) {
      const response = await request(app).get(route);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("forbidden");
    }
  });

  it("allows the gate keeper to read leave details but not operate boarding", async () => {
    currentRole = "gate_keeper";
    const response = await request(app).get(
      "/api/v1/boarding/student-leaves/not-a-number",
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("bad_request");
  });

  it.each(["school_admin", "director_of_discipline", "patron", "matron"])(
    "allows %s through the boarding read guard",
    async (role) => {
      currentRole = role;

      // Invalid query input is deliberately used so the test stops after
      // authorization and does not require a database record.
      const response = await request(app).get(
        "/api/v1/boarding/dormitories?limit=not-a-number",
      );
      expect(response.status).not.toBe(403);
    },
  );

  it.each(["teacher", "staff", "gate_keeper", "patron", "matron"])(
    "rejects %s from creating supervisors",
    async (role) => {
      currentRole = role;
      const response = await request(app)
        .post("/api/v1/boarding/supervisors")
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("forbidden");
    },
  );

  it("allows the DOD to reach supervisor validation", async () => {
    currentRole = "director_of_discipline";
    const response = await request(app)
      .post("/api/v1/boarding/supervisors")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_error");
  });

  it.each(["teacher", "staff", "gate_keeper", "patron", "matron"])(
    "rejects %s from approving leave",
    async (role) => {
      currentRole = role;
      const response = await request(app).patch(
        "/api/v1/boarding/student-leaves/1/approve",
      );

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("forbidden");
    },
  );
});
