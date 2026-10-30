import { Router } from "express";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyPlatformToken } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import { PlatformRole } from "../constants/roles";
import { validate } from "../middleware/validate";
import { createDemoRequestSchema, updateDemoRequestSchema } from "../validators/demo-request.validator";
import * as controller from "../controllers/demo-request.controller";

export const demoRequestRoutes = Router();
demoRequestRoutes.post("/", validate(createDemoRequestSchema), asyncWrapper(controller.create));
demoRequestRoutes.use(verifyPlatformToken, requireRole(PlatformRole.PLATFORM_ADMIN));
demoRequestRoutes.get("/", asyncWrapper(controller.list));
demoRequestRoutes.patch("/:id", validate(updateDemoRequestSchema), asyncWrapper(controller.update));
demoRequestRoutes.delete("/:id", asyncWrapper(controller.remove));
