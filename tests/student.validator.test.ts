import { studentImportRowSchema } from "../src/validators/student.validator";

describe("studentImportRowSchema", () => {
  it("rejects invalid date strings", () => {
    const result = studentImportRowSchema.safeParse({
      first_name: "Gatete",
      last_name: "Ntirenganya",
      date_of_birth: "Invalid Date"
    });

    expect(result.success).toBe(false);
  });

  it("normalizes valid date strings to Date objects", () => {
    const result = studentImportRowSchema.safeParse({
      first_name: "Gatete",
      last_name: "Ntirenganya",
      date_of_birth: "2022-01-04"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date_of_birth).toBeInstanceOf(Date);
    }
  });
});