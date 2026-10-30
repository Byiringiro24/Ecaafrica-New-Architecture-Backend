import type { NextFunction, Request, Response } from "express";
import request from "supertest";

// Bypass the real JWT/DB auth so these tests exercise the zod validators only.
// Every payload below is intentionally invalid, so a request never reaches a
// service and no database connection is required.
jest.mock("../src/middleware/auth", () => ({
  verifyToken: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "1", school_id: "1", role: "finance_officer" } as never;
    next();
  },
  verifyTokenOrPlatform: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "1", school_id: "1", role: "finance_officer" } as never;
    next();
  },
  verifyPlatformToken: (req: Request, _res: Response, next: NextFunction) => next()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../src/app") as typeof import("../src/app");

const expectValidationError = (res: request.Response) => {
  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
  expect(res.body.error.code).toBe("validation_error");
};

describe("Finance expense validation", () => {
  it("rejects an expense with no amount, category or description", async () => {
    const res = await request(app).post("/api/v1/finance/expenses").send({});
    expectValidationError(res);
  });

  it("rejects a negative amount", async () => {
    const res = await request(app).post("/api/v1/finance/expenses").send({
      expense_date: "2026-07-01",
      category: "Utilities",
      description: "Power bill",
      amount: -5000
    });
    expectValidationError(res);
  });

  it("rejects an empty description", async () => {
    const res = await request(app).post("/api/v1/finance/expenses").send({
      expense_date: "2026-07-01",
      category: "Utilities",
      description: "",
      amount: 5000
    });
    expectValidationError(res);
  });

  it("rejects an unknown status filter", async () => {
    const res = await request(app).get("/api/v1/finance/expenses?status=archived");
    expectValidationError(res);
  });

  it("rejects a non-numeric id", async () => {
    const res = await request(app).get("/api/v1/finance/expenses/abc");
    expectValidationError(res);
  });

  it("rejects a rejection with no reason", async () => {
    const res = await request(app).patch("/api/v1/finance/expenses/1/reject").send({});
    expectValidationError(res);
  });

  it("rejects an empty update body", async () => {
    const res = await request(app).patch("/api/v1/finance/expenses/1").send({});
    expectValidationError(res);
  });
});

describe("Finance invoice validation", () => {
  it("rejects an invoice with no items", async () => {
    const res = await request(app).post("/api/v1/finance/invoices").send({
      student_id: "1",
      due_date: "2026-08-01",
      items: []
    });
    expectValidationError(res);
  });

  it("rejects an invoice with no student", async () => {
    const res = await request(app)
      .post("/api/v1/finance/invoices")
      .send({ due_date: "2026-08-01", items: [{ label: "Tuition", amount: 100000 }] });
    expectValidationError(res);
  });

  it("rejects an invoice with no due date", async () => {
    const res = await request(app)
      .post("/api/v1/finance/invoices")
      .send({ student_id: "1", items: [{ label: "Tuition", amount: 100000 }] });
    expectValidationError(res);
  });

  it("rejects a line item with no label", async () => {
    const res = await request(app).post("/api/v1/finance/invoices").send({
      student_id: "1",
      due_date: "2026-08-01",
      items: [{ label: "", amount: 100000 }]
    });
    expectValidationError(res);
  });

  it("rejects a zero payment amount", async () => {
    const res = await request(app)
      .post("/api/v1/finance/invoices/1/payments")
      .send({ amount: 0 });
    expectValidationError(res);
  });

  it("rejects a payment with no amount", async () => {
    const res = await request(app).post("/api/v1/finance/invoices/1/payments").send({});
    expectValidationError(res);
  });

  it("rejects an unknown invoice status filter", async () => {
    const res = await request(app).get("/api/v1/finance/invoices?status=void");
    expectValidationError(res);
  });
});

describe("Finance supplier and inventory validation", () => {
  it("rejects a supplier with no name", async () => {
    const res = await request(app).post("/api/v1/finance/suppliers").send({});
    expectValidationError(res);
  });

  it("rejects a supplier with an invalid email", async () => {
    const res = await request(app)
      .post("/api/v1/finance/suppliers")
      .send({ name: "Office Mart", email: "not-an-email" });
    expectValidationError(res);
  });

  it("rejects an inventory item with no name or cost", async () => {
    const res = await request(app).post("/api/v1/finance/inventory").send({});
    expectValidationError(res);
  });

  it("rejects a negative quantity", async () => {
    const res = await request(app).post("/api/v1/finance/inventory").send({
      item_name: "A4 Paper",
      quantity: -5,
      unit_cost: 6500
    });
    expectValidationError(res);
  });

  it("rejects an unknown purchase status", async () => {
    const res = await request(app)
      .patch("/api/v1/finance/inventory/1/status")
      .send({ status: "delivered" });
    expectValidationError(res);
  });

  it("rejects a status change with no status", async () => {
    const res = await request(app).patch("/api/v1/finance/inventory/1/status").send({});
    expectValidationError(res);
  });
});

describe("Finance payroll validation", () => {
  it("rejects a payroll run with no month or year", async () => {
    const res = await request(app).post("/api/v1/finance/payroll/runs").send({});
    expectValidationError(res);
  });

  it("rejects an out-of-range month", async () => {
    const res = await request(app)
      .post("/api/v1/finance/payroll/runs")
      .send({ month: 13, year: 2026 });
    expectValidationError(res);
  });

  it("rejects a payslip with no staff or salary", async () => {
    const res = await request(app)
      .post("/api/v1/finance/payroll/runs/1/payslips")
      .send({});
    expectValidationError(res);
  });

  it("rejects a negative basic salary", async () => {
    const res = await request(app)
      .post("/api/v1/finance/payroll/runs/1/payslips")
      .send({ staff_id: "1", basic_salary: -1000 });
    expectValidationError(res);
  });

  it("rejects an empty payslip update", async () => {
    const res = await request(app).patch("/api/v1/finance/payroll/payslips/1").send({});
    expectValidationError(res);
  });

  it("rejects an unknown payroll status filter", async () => {
    const res = await request(app).get("/api/v1/finance/payroll/runs?status=closed");
    expectValidationError(res);
  });
});

describe("Finance report validation", () => {
  it("rejects a non-numeric defaulters limit", async () => {
    const res = await request(app).get("/api/v1/finance/reports/defaulters?limit=many");
    expectValidationError(res);
  });

  it("rejects a non-numeric payroll_run_id", async () => {
    const res = await request(app).get(
      "/api/v1/finance/reports/payroll-summary?payroll_run_id=abc"
    );
    expectValidationError(res);
  });

  it("rejects a non-numeric months value", async () => {
    const res = await request(app).get(
      "/api/v1/finance/dashboard/collections/monthly?months=abc"
    );
    expectValidationError(res);
  });
});
