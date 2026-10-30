import { Router } from "express";
import * as controller from "../../controllers/attendance/sms-mapping.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { upsertAttendanceSmsMappingSchema } from "../../validators/attendance/sms-mapping.validator";

export const attendanceSmsMappingRoutes = Router();

attendanceSmsMappingRoutes.use(verifyToken, requireSchoolAccess);
attendanceSmsMappingRoutes.get("/", asyncWrapper(controller.listMappings));
attendanceSmsMappingRoutes.put(
  "/",
  validate(upsertAttendanceSmsMappingSchema),
  asyncWrapper(controller.upsertMapping)
);
