import request from "supertest";
import { app } from "../src/app";

describe("Fees routes", () => {
  it("GET /api/v1/fees/summary requires token", async () => {
    const res = await request(app).get("/api/v1/fees/summary");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("unauthorized");
  });
});
