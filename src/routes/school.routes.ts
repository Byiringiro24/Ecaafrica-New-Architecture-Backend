import { Router } from "express";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess, requireRole } from "../middleware/roleGuard";
import { uploadSchoolLogo } from "../configs/multer";
import * as schoolController from "../controllers/school.controller";

export const schoolRoutes = Router();

schoolRoutes.use(verifyToken, requireSchoolAccess, requireRole("school_admin"));

schoolRoutes.get("/profile", asyncWrapper(schoolController.getCurrentSchoolProfile));
schoolRoutes.get("/subscription", asyncWrapper(schoolController.getCurrentSchoolSubscription));
schoolRoutes.patch(
  "/subscription",
  requireRole("school_admin"),
  asyncWrapper(schoolController.updateCurrentSchoolSubscription)
);

schoolRoutes.patch(
  "/logo",
  requireRole("school_admin"),
  uploadSchoolLogo.single("logo"),
  asyncWrapper(schoolController.updateCurrentSchoolLogo)
);
