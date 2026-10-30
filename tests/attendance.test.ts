import request from "supertest";
import { app } from "../src/app";

describe("Attendance routes", () => {
  it("GET /api/v1/attendance/sessions requires token", async () => {
    const res = await request(app).get("/api/v1/attendance/sessions");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("unauthorized");
  });
});
