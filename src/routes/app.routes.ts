import { Router } from "express";
import * as appController from "../controllers/app.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { validate } from "../middleware/validate";
import { verifyAppToken } from "../middleware/appAuth";
import {
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  studentIdParamSchema,
  dateRangeQuerySchema,
  leaveRequestSchema,
  studentLeaveParamSchema,
  paginationQuerySchema,
  notificationIdParamSchema,
  studentInvoiceParamSchema
} from "../validators/app.validator";

export const appRoutes = Router();

// ── Auth (no token required) ──
appRoutes.post("/auth/send-otp", validate(sendOtpSchema), asyncWrapper(appController.sendOtp));
appRoutes.post("/auth/verify-otp", validate(verifyOtpSchema), asyncWrapper(appController.verifyOtp));
appRoutes.post("/auth/refresh", validate(refreshTokenSchema), asyncWrapper(appController.refresh));

// ── Parent APIs (token required) ──
appRoutes.use("/parent", verifyAppToken);

appRoutes.get("/parent/profile", asyncWrapper(appController.getProfile));
appRoutes.get("/parent/children", asyncWrapper(appController.getChildren));

appRoutes.get(
  "/parent/children/:studentId/attendance",
  validate({ params: studentIdParamSchema, query: dateRangeQuerySchema }),
  asyncWrapper(appController.getStudentAttendance)
);

appRoutes.get(
  "/parent/children/:studentId/grades",
  validate({ params: studentIdParamSchema }),
  asyncWrapper(appController.getStudentGrades)
);

appRoutes.get(
  "/parent/children/:studentId/timetable",
  validate({ params: studentIdParamSchema }),
  asyncWrapper(appController.getStudentTimetable)
);

appRoutes.get(
  "/parent/children/:studentId/reports",
  validate({ params: studentIdParamSchema }),
  asyncWrapper(appController.getStudentReports)
);

appRoutes.post(
  "/parent/children/:studentId/leave",
  validate({ params: studentIdParamSchema, body: leaveRequestSchema }),
  asyncWrapper(appController.requestStudentLeave)
);

appRoutes.get(
  "/parent/children/:studentId/leave",
  validate({ params: studentIdParamSchema }),
  asyncWrapper(appController.getStudentLeaves)
);

appRoutes.patch(
  "/parent/children/:studentId/leave/:leaveId/cancel",
  validate({ params: studentLeaveParamSchema }),
  asyncWrapper(appController.cancelStudentLeave)
);

// ── Finance ─────────────────────────────────────────────────────────────────

appRoutes.get(
  "/parent/children/:studentId/fees",
  validate({ params: studentIdParamSchema }),
  asyncWrapper(appController.getStudentFeeSummary)
);

appRoutes.get(
  "/parent/children/:studentId/invoices",
  validate({ params: studentIdParamSchema }),
  asyncWrapper(appController.getStudentInvoices)
);

appRoutes.get(
  "/parent/children/:studentId/invoices/:invoiceId",
  validate({ params: studentInvoiceParamSchema }),
  asyncWrapper(appController.getStudentInvoiceById)
);

appRoutes.get(
  "/parent/children/:studentId/transactions",
  validate({ params: studentIdParamSchema }),
  asyncWrapper(appController.getStudentTransactions)
);

// ── Notifications ───────────────────────────────────────────────────────────

appRoutes.get(
  "/parent/notifications",
  validate({ query: paginationQuerySchema }),
  asyncWrapper(appController.getNotifications)
);

appRoutes.patch(
  "/parent/notifications/:notificationId/read",
  validate({ params: notificationIdParamSchema }),
  asyncWrapper(appController.markNotificationRead)
);

appRoutes.get(
  "/parent/notifications/unread-count",
  asyncWrapper(appController.getUnreadNotificationCount)
);
