import { Prisma } from "@prisma/client";
import { getErrorPayload } from "../src/middleware/errorHandler";

const uniqueError = (target: string[]) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
    meta: { target }
  });

describe("database conflict error mapping", () => {
  it("does not label attendance record conflicts as staff email conflicts", () => {
    expect(getErrorPayload(uniqueError(["session_id", "student_id"]))).toMatchObject({
      statusCode: 409,
      code: "conflict",
      message: "An attendance record already exists for this student in this session"
    });
  });

  it("keeps the staff email message scoped to the users email constraint", () => {
    expect(getErrorPayload(uniqueError(["school_id", "email"]))).toMatchObject({
      statusCode: 409,
      code: "conflict",
      message: "A user with this email already exists in this school"
    });
  });

  it("uses a neutral message for unknown unique constraints", () => {
    expect(getErrorPayload(uniqueError(["some_other_field"]))).toMatchObject({
      statusCode: 409,
      code: "conflict",
      message: "A record with these details already exists"
    });
  });
});
