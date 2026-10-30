import request from "supertest";
import { app } from "../src/app";
import * as authService from "../src/services/auth.service";

jest.mock("../src/services/auth.service");

const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe("Auth routes", () => {
  it("GET /api/v1/auth returns API metadata", async () => {
    const res = await request(app).get("/api/v1/auth");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      service: "ecareafrica-auth",
      version: "v1"
    });
  });

  it("GET /api/v1/health returns ok", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: "ok",
      service: "ecareafrica-backend"
    });
  });

  it("allows the active role header in CORS preflight requests", async () => {
    const res = await request(app)
      .options("/api/v1/students?limit=10000")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization,x-active-role");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-headers"]).toEqual(
      expect.stringContaining("X-Active-Role")
    );
  });

  it("POST /api/v1/auth/login returns tokens", async () => {
    mockedAuthService.loginSchoolUser.mockResolvedValue({
      user: { id: "user-1", email: "demo@ecare.test" },
      accessToken: "access-token",
      refreshToken: "refresh-token"
    } as any);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "demo@ecare.test", password: "Password@123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token"
    });
  });

  it("GET /api/v1/auth/me requires token", async () => {
    const res = await request(app).get("/api/v1/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("unauthorized");
  });
});
