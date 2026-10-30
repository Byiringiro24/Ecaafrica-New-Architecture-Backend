import request from "supertest";
import { app } from "../src/app";

/**
 * Every finance route sits behind verifyToken. These assert the guard is
 * actually mounted on each router, so a new sub-router cannot be added
 * without authentication by accident.
 */
const GUARDED_ROUTES: [string, string][] = [
  ["get", "/api/v1/finance/dashboard/summary"],
  ["get", "/api/v1/finance/dashboard/collections/daily"],
  ["get", "/api/v1/finance/dashboard/collections/monthly"],
  ["get", "/api/v1/finance/dashboard/payment-methods"],
  ["get", "/api/v1/finance/reports/collections"],
  ["get", "/api/v1/finance/reports/defaulters"],
  ["get", "/api/v1/finance/reports/expenses-by-category"],
  ["get", "/api/v1/finance/reports/payroll-summary"],
  ["get", "/api/v1/finance/reports/inventory-valuation"],
  ["get", "/api/v1/finance/invoices"],
  ["post", "/api/v1/finance/invoices"],
  ["get", "/api/v1/finance/invoices/1"],
  ["patch", "/api/v1/finance/invoices/1"],
  ["patch", "/api/v1/finance/invoices/1/issue"],
  ["post", "/api/v1/finance/invoices/1/payments"],
  ["patch", "/api/v1/finance/invoices/1/cancel"],
  ["patch", "/api/v1/finance/invoices/1/refund"],
  ["post", "/api/v1/finance/invoices/1/document"],
  ["delete", "/api/v1/finance/invoices/1"],
  ["get", "/api/v1/finance/expenses"],
  ["get", "/api/v1/finance/expenses/categories"],
  ["post", "/api/v1/finance/expenses"],
  ["get", "/api/v1/finance/expenses/1"],
  ["patch", "/api/v1/finance/expenses/1"],
  ["patch", "/api/v1/finance/expenses/1/approve"],
  ["patch", "/api/v1/finance/expenses/1/reject"],
  ["patch", "/api/v1/finance/expenses/1/mark-paid"],
  ["post", "/api/v1/finance/expenses/1/document"],
  ["delete", "/api/v1/finance/expenses/1"],
  ["get", "/api/v1/finance/suppliers"],
  ["post", "/api/v1/finance/suppliers"],
  ["get", "/api/v1/finance/suppliers/1"],
  ["patch", "/api/v1/finance/suppliers/1"],
  ["delete", "/api/v1/finance/suppliers/1"],
  ["get", "/api/v1/finance/inventory"],
  ["post", "/api/v1/finance/inventory"],
  ["get", "/api/v1/finance/inventory/1"],
  ["patch", "/api/v1/finance/inventory/1"],
  ["patch", "/api/v1/finance/inventory/1/status"],
  ["post", "/api/v1/finance/inventory/1/invoice"],
  ["delete", "/api/v1/finance/inventory/1"],
  ["get", "/api/v1/finance/payroll/runs"],
  ["post", "/api/v1/finance/payroll/runs"],
  ["get", "/api/v1/finance/payroll/runs/1"],
  ["patch", "/api/v1/finance/payroll/runs/1/submit"],
  ["patch", "/api/v1/finance/payroll/runs/1/approve"],
  ["patch", "/api/v1/finance/payroll/runs/1/mark-paid"],
  ["post", "/api/v1/finance/payroll/runs/1/payslips"],
  ["delete", "/api/v1/finance/payroll/runs/1"],
  ["get", "/api/v1/finance/payroll/payslips"],
  ["get", "/api/v1/finance/payroll/payslips/1"],
  ["patch", "/api/v1/finance/payroll/payslips/1"],
  ["patch", "/api/v1/finance/payroll/payslips/1/mark-paid"],
  ["delete", "/api/v1/finance/payroll/payslips/1"],
  ["get", "/api/v1/finance/audit-logs"],
  ["get", "/api/v1/finance/audit-logs/modules"]
];

describe("Finance routes require authentication", () => {
  it.each(GUARDED_ROUTES)("%s %s returns 401 without a token", async (method, path) => {
    const res = await (request(app) as any)[method](path);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("rejects a malformed authorization header", async () => {
    const res = await request(app)
      .get("/api/v1/finance/dashboard/summary")
      .set("Authorization", "NotBearer abc");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });
});
