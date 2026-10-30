/// <reference path="./types/express.d.ts" />
import cors from "cors";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import { env } from "./configs/env";
import { errorResponse } from "./helpers/response";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { authRoutes } from "./routes/auth.routes";
import { academicYearRoutes } from "./routes/academic-year.routes";
import { classRoutes } from "./routes/class.routes";
import { levelRoutes } from "./routes/level.routes";
import { holidayRoutes } from "./routes/holiday.routes";
import { platformRoutes } from "./routes/platform";
import { parentRoutes } from "./routes/parent.routes";
import { roleRoutes } from "./routes/role.routes";
import { sectionRoutes } from "./routes/section.routes";
import { studentRoutes } from "./routes/student.routes";
import { subjectRoutes } from "./routes/subject.routes";
import { teacherSectionSubjectRoutes } from "./routes/teacher-section-subject.routes";
import { termRoutes } from "./routes/term.routes";
import { biometricRoutes } from "./routes/biometric.routes";
import { attendanceSessionRoutes } from "./routes/attendance/session.routes";
import { attendanceRecordRoutes } from "./routes/attendance/record.routes";
import { attendanceSmsMappingRoutes } from "./routes/attendance/sms-mapping.routes";
import { gateLogRoutes } from "./routes/gate/log.routes";
import { offlineSyncRoutes } from "./routes/offline-sync.routes";
import { boardingRoutes } from "./routes/boarding";
import { feesRoutes } from "./routes/fees";
import { financeRoutes } from "./routes/finance";
import { examRoutes } from "./routes/exam.routes";
import { examConfigurationRoutes } from "./routes/exam-configuration.routes";
import { examModificationRequestRoutes } from "./routes/exam-modification-request.routes";
import { examResultRoutes } from "./routes/exam-result.routes";
import { reportCardRoutes } from "./routes/report-card.routes";
import { visitorRoutes } from "./routes/visitor.routes";
import { visitorAppointmentRoutes } from "./routes/visitor-appointment.routes";
import { visitorVisitRoutes } from "./routes/visitor-visit.routes";
import { deviceRoutes } from "./routes/device.routes";
import { gatewayRoutes } from "./routes/gateway.routes";
import { tabletRoutes } from "./routes/tablet.routes";
import { staffRoutes } from "./routes/staff";
import { salaryRecordRoutes } from "./routes/salary-record.routes";
import { timetablePeriodRoutes } from "./routes/timetable-period.routes";
import { timetableSlotRoutes } from "./routes/timetable-slot.routes";
import { userRoutes } from "./routes/user.routes";
import { notificationRoutes } from "./routes/notification";
import { auditLogRoutes } from "./routes/audit-log.routes";
import { featureFlagRoutes } from "./routes/feature-flag.routes";
import { systemSettingsRoutes } from "./routes/system-settings.routes";
import { schoolRoutes } from "./routes/school.routes";
import { restCountriesRoutes } from "./routes/external/restcountries.routes";
import { appRoutes } from "./routes/app.routes";
import { setupSwagger } from "./docs/swagger";
import { demoRequestRoutes } from "./routes/demo-request.routes";
import { schoolSupportTicketRoutes } from "./routes/school-support-ticket.routes";
import { dosWorkItemRoutes } from "./routes/dos-work-item.routes";
import { combinationRoutes } from "./routes/combination.routes";

const app = express();

app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value
);

app.use(requestLogger);
app.use(helmet());
// Gzip all responses > 1KB — typically 5–10× smaller JSON payloads at zero logic cost
app.use(compression({ threshold: 1024 }));

const corsOrigins =
  env.CORS_ORIGIN === "*"
    ? "*"
    : env.CORS_ORIGIN.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

// Log CORS configuration on startup
console.log("🔐 CORS Configuration:", {
  origin: corsOrigins,
  environment: env.NODE_ENV,
  trustProxy: env.TRUST_PROXY
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Log the incoming origin for debugging
      console.log(`📥 CORS Request from origin: ${origin || 'no-origin'}`);
      
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Allow all origins if configured
      if (corsOrigins === "*") {
        return callback(null, true);
      }

      // Check if origin is in the allowed list
      if (Array.isArray(corsOrigins) && corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reject the request
      console.warn(`❌ CORS Blocked: ${origin} not in allowed origins:`, corsOrigins);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "X-Active-Role"
    ],
    exposedHeaders: ["X-Total-Count"],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  })
);

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

// Prevent browsers and CDN proxies from caching API responses.
// Each request must always hit the server to get fresh attendance/dashboard data.
// This eliminates the "different data on different devices" problem caused by
// a browser serving a stale cached response to GET /attendance/records etc.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.json({ limit: "1mb" }));
// Uploaded assets (school logos, photos) are rendered by the frontend on a
// different origin, so helmet's default same-origin CORP would block them.
app.use(
  "/uploads",
  (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.resolve(__dirname, "..", "uploads"))
);

setupSwagger(app);

const docsDir = path.resolve(__dirname, "..", "docs");

// Health check endpoint - useful for CORS testing
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    timezone: env.TZ,
    environment: env.NODE_ENV,
    corsOrigin: env.CORS_ORIGIN,
    trustProxy: env.TRUST_PROXY
  });
});

// ── Kubernetes/Nginx/LB health probes — never behind auth, never behind /api/* ──
// /healthz — process alive (no DB hit). Use for liveness probes.
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

// /readyz — DB + Redis reachable. Use for readiness probes (don't send traffic
// until the backend can actually serve it). Fails fast — 2s DB timeout.
app.get("/readyz", async (_req, res) => {
  const checks: Record<string, boolean> = {};
  try {
    const { prisma: db } = await import("./database/prisma");
    await db.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch {
    checks.db = false;
  }
  const allOk = Object.values(checks).every(Boolean);
  res.status(allOk ? 200 : 503).json({ ok: allOk, checks });
});

app.get("/api/v1/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      service: "ecareafrica-backend",
      version: "v1",
      timestamp: new Date().toISOString(),
      timezone: env.TZ,
      environment: env.NODE_ENV
    }
  });
});

app.get("/api/doc/test", (_req, res) => {
  res.sendFile(path.join(docsDir, "education-care-africa-api-tester.html"));
});

app.get("/api/doc/swagger", (_req, res) => {
  res.type("application/yaml");
  res.sendFile(path.join(docsDir, "education-care-africa-swagger.yaml"));
});

// Routes will be registered here.
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/platform", platformRoutes);

// ── Public tablet bridge endpoints — no auth required (UUID is the identifier) ───

// GET /api/v1/tablet-bridge/tablet-info/:uuid
// Returns the tablet name and location so the tablet can display them on startup.
// Public — the tablet has no school auth token at boot time.
app.get("/api/v1/tablet-bridge/tablet-info/:uuid", async (req: import("express").Request, res: import("express").Response) => {
  try {
    const { prisma: db } = await import("./database/prisma");
    const tablet = await (db as any).tablets.findFirst({
      where: { uuid: req.params.uuid, deleted_at: null },
      select: { uuid: true, name: true, location: true },
    });
    if (!tablet) {
      return res.status(404).json({ success: false, error: "Tablet not found" });
    }
    return res.json({
      success: true,
      uuid: (tablet as any).uuid,
      name: (tablet as any).name ?? null,
      location: (tablet as any).location ?? null,
    });
  } catch {
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

app.get("/api/v1/tablet-bridge/dev-password/:uuid", async (req: import("express").Request, res: import("express").Response) => {
  try {
    const { prisma: db } = await import("./database/prisma");
    const tablet = await (db as any).tablets.findFirst({
      where: { uuid: req.params.uuid, deleted_at: null },
    });
    if (!tablet || !(tablet as any).dev_password) {
      return res.json({ hasPassword: false });
    }
    return res.json({
      hasPassword: true,
      password: (tablet as any).dev_password,
      setAt: (tablet as any).dev_password_set_at,
    });
  } catch {
    return res.json({ hasPassword: false });
  }
});
app.get("/api/v1/tablet-bridge/device-assignments/:uuid", async (req: import("express").Request, res: import("express").Response") => {
  try {
    const { prisma: db } = await import("./database/prisma");
    const tablet = await (db as any).tablets.findFirst({
      where: { uuid: req.params.uuid, deleted_at: null },
      select: { id: true, school_id: true, name: true, location: true },
    });
    if (!tablet) {
      return res.status(404).json({ success: false, error: "Tablet not found" });
    }

    const devices = await (db as any).devices.findMany({
      where: {
        school_id: tablet.school_id,
        tablet_id: tablet.id,
        is_active: true,
      },
      select: {
        id: true,
        device_uid: true,
        name: true,
        tablet_ip: true,
        location: true,
        is_active: true,
        tablet_id: true,
      },
      orderBy: { name: "asc" },
    });

    return res.json({
      success: true,
      tablet: {
        id: tablet.id,
        name: tablet.name,
        location: tablet.location,
      },
      devices: devices.map((device: any) => ({
        id: device.id,
        name: device.name,
        device_uid: device.device_uid,
        tablet_ip: device.tablet_ip,
        location: device.location,
        is_active: device.is_active,
        tablet_id: device.tablet_id,
      })),
    });
  } catch {
    return res.status(500).json({ success: false, error: "Server error" });
  }
});app.use("/api/v1/users", userRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/academic-years", academicYearRoutes);
app.use("/api/v1/terms", termRoutes);
app.use("/api/v1/levels", levelRoutes);
app.use("/api/v1/classes", classRoutes);
app.use("/api/v1/sections", sectionRoutes);
app.use("/api/v1/subjects", subjectRoutes);
app.use("/api/v1/combinations", combinationRoutes);
app.use("/api/v1/teacher-section-subjects", teacherSectionSubjectRoutes);
app.use("/api/v1/timetable-periods", timetablePeriodRoutes);
app.use("/api/v1/timetable-slots", timetableSlotRoutes);
app.use("/api/v1/holidays", holidayRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/parents", parentRoutes);
app.use("/api/v1/biometric-enrollments", biometricRoutes);
app.use("/api/v1/attendance/sessions", attendanceSessionRoutes);
app.use("/api/v1/attendance/records", attendanceRecordRoutes);
app.use("/api/v1/attendance/sms-settings", attendanceSmsMappingRoutes);
app.use("/api/v1/gate/logs", gateLogRoutes);
app.use("/api/v1/boarding", boardingRoutes);
app.use("/api/v1/offline-sync", offlineSyncRoutes);
app.use("/api/v1/fees", feesRoutes);
app.use("/api/v1/finance", financeRoutes);
app.use("/api/v1/exams", examRoutes);
app.use("/api/v1/exam-configuration", examConfigurationRoutes);
app.use("/api/v1/exam-modification-requests", examModificationRequestRoutes);
app.use("/api/v1/exam-results", examResultRoutes);
app.use("/api/v1/report-cards", reportCardRoutes);
app.use("/api/v1/visitors", visitorRoutes);
app.use("/api/v1/visitor-appointments", visitorAppointmentRoutes);
app.use("/api/v1/visitor-visits", visitorVisitRoutes);
app.use("/api/v1/gateway", gatewayRoutes);
app.use("/api/v1/devices", deviceRoutes);
app.use("/api/v1/tablets", tabletRoutes);
app.use("/api/v1/staff", staffRoutes);
app.use("/api/v1/salary-records", salaryRecordRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/audit-logs", auditLogRoutes);
app.use("/api/v1/feature-flags", featureFlagRoutes);
app.use("/api/v1/system-settings", systemSettingsRoutes);
app.use("/api/v1/school", schoolRoutes);
app.use("/api/v1/external/restcountries", restCountriesRoutes);
app.use("/api/v1/app", appRoutes);
app.use("/api/v1/demo-requests", demoRequestRoutes);
app.use("/api/v1/support-tickets", schoolSupportTicketRoutes);
app.use("/api/v1/dos/work-items", dosWorkItemRoutes);

app.use((req, res) => {
  res.status(404).json(errorResponse("not_found", "Not found"));
});

app.use(errorHandler);

export { app };
