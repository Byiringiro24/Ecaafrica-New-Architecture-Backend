import request from "supertest";
import { app } from "../src/app";

describe("Gateway sync routes", () => {
  it("POST /api/v1/gateway/heartbeat requires token", async () => {
    const res = await request(app)
      .post("/api/v1/gateway/heartbeat")
      .send({
        gateway_id: "gw-school-001",
        device_count: 1,
        online: true
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("POST /api/v1/gateway/pull requires token", async () => {
    const res = await request(app)
      .post("/api/v1/gateway/pull")
      .send({
        gateway_id: "gw-school-001",
        since: "2026-01-01T00:00:00.000Z"
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("unauthorized");
  });
});
