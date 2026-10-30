import type { NextFunction, Request, Response } from "express";
import request from "supertest";

let currentRole = "school_admin";

jest.setTimeout(120000);

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

const FINANCE_ROUTES = [
  "/api/v1/finance/dashboard/summary",
  "/api/v1/finance/dashboard/collections/daily",
  "/api/v1/finance/dashboard/collections/monthly",
  "/api/v1/finance/dashboard/payment-methods",
  "/api/v1/finance/invoices",
  "/api/v1/finance/expenses",
  "/api/v1/finance/suppliers",
  "/api/v1/finance/inventory",
  "/api/v1/finance/payroll/runs",
  "/api/v1/finance/payroll/payslips",
  "/api/v1/finance/reports/collections",
  "/api/v1/finance/audit-logs"
];

const NON_FINANCE_ROLES = [
  "school_admin",
  "teacher",
  "staff",
  "parent",
  "student",
  "gate_keeper",
  "director_of_discipline",
  "patron",
  "matron"
];

describe("Finance routes are restricted to finance officers", () => {
  for (const role of NON_FINANCE_ROLES) {
    it(`rejects role "${role}" with 403 on every finance route`, async () => {
      currentRole = role;

      for (const path of FINANCE_ROUTES) {
        const res = await request(app).get(path);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("forbidden");
      }
    });
  }

  it("does not reject the finance_officer role with 403", async () => {
    currentRole = "finance_officer";

    for (const path of FINANCE_ROUTES) {
      const res = await request(app).get(path);
      expect(res.status).not.toBe(403);
    }
  });
});

describe("Fee routes are restricted to finance officers and school admins", () => {
  const FEE_ROUTES = [
    "/api/v1/fees/structures",
    "/api/v1/fees/assignments",
    "/api/v1/fees/transactions"
  ];

  for (const role of [
    "teacher",
    "staff",
    "parent",
    "student",
    "gate_keeper",
    "director_of_discipline",
    "patron",
    "matron",
  ]) {
    it(`rejects role "${role}" with 403 on fee routes`, async () => {
      currentRole = role;

      for (const path of FEE_ROUTES) {
        const res = await request(app).get(path);
        expect(res.status).toBe(403);
      }
    });
  }

  for (const role of ["finance_officer", "school_admin"]) {
    it(`allows role "${role}" past the fee route guard`, async () => {
      currentRole = role;

      for (const path of FEE_ROUTES) {
        const res = await request(app).get(path);
        expect(res.status).not.toBe(403);
      }
    });
  }
});
