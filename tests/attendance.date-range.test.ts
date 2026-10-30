import { utcDateRange, utcDayRange } from "../src/utils/date-range";

describe("attendance date ranges", () => {
  it("includes the complete selected calendar day", () => {
    const { start, end } = utcDayRange("2026-08-23");

    expect(start.toISOString()).toBe("2026-08-23T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("includes the end date when a report range has the same start and end", () => {
    const { start, end } = utcDateRange("2026-08-23", "2026-08-23");

    expect(start.toISOString()).toBe("2026-08-23T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("rejects invalid calendar dates instead of normalising them", () => {
    const { start, end } = utcDayRange("2026-02-31");

    expect(Number.isNaN(start.getTime())).toBe(true);
    expect(Number.isNaN(end.getTime())).toBe(true);
  });
});
