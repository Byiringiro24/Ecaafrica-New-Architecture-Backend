import { computePayslip, PENSION_RATE, TAX_RATE } from "../src/services/finance/payroll.service";

describe("computePayslip", () => {
  it("derives gross, statutory deductions and net from the raw inputs", () => {
    const result = computePayslip({
      staff_id: "1",
      basic_salary: 350000,
      allowances: 63000,
      overtime: 25000,
      bonus: 40000,
      loan_recovery: 30000
    });

    const gross = 350000 + 63000 + 25000 + 40000;
    const tax = Math.round(gross * TAX_RATE);
    const pension = Math.round(350000 * PENSION_RATE);

    expect(result.gross_salary).toBe(gross.toFixed(2));
    expect(result.tax).toBe(tax.toFixed(2));
    expect(result.pension).toBe(pension.toFixed(2));
    expect(result.total_deductions).toBe((tax + pension + 30000).toFixed(2));
    expect(result.net_salary).toBe((gross - tax - pension - 30000).toFixed(2));
  });

  it("treats omitted optional components as zero", () => {
    const result = computePayslip({ staff_id: "1", basic_salary: 200000 });

    expect(result.gross_salary).toBe("200000.00");
    expect(result.allowances).toBe("0.00");
    expect(result.overtime).toBe("0.00");
    expect(result.bonus).toBe("0.00");
    expect(result.loan_recovery).toBe("0.00");
    expect(result.tax).toBe(Math.round(200000 * TAX_RATE).toFixed(2));
  });

  it("accepts string amounts as well as numbers", () => {
    const fromStrings = computePayslip({
      staff_id: "1",
      basic_salary: "300000",
      allowances: "50000"
    });
    const fromNumbers = computePayslip({
      staff_id: "1",
      basic_salary: 300000,
      allowances: 50000
    });

    expect(fromStrings).toEqual(fromNumbers);
  });

  it("rejects deductions that would make net pay negative", () => {
    expect(() =>
      computePayslip({
        staff_id: "1",
        basic_salary: 100000,
        loan_recovery: 500000
      })
    ).toThrow(/negative/i);
  });
});
