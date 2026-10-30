import { Router } from "express";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { SchoolRole } from "../constants/roles";
import * as controller from "../controllers/school-support-ticket.controller";
import { createSchoolTicketSchema, schoolTicketIdSchema, schoolTicketMessageSchema, updateSchoolTicketSchema } from "../validators/school-support-ticket.validator";

export const schoolSupportTicketRoutes = Router();
schoolSupportTicketRoutes.use(verifyToken, requireRole(SchoolRole.SCHOOL_ADMIN, SchoolRole.GATE_KEEPER));
schoolSupportTicketRoutes.get("/", asyncWrapper(controller.list));
schoolSupportTicketRoutes.post("/", validate({ body: createSchoolTicketSchema }), asyncWrapper(controller.create));
schoolSupportTicketRoutes.get("/:id", validate({ params: schoolTicketIdSchema }), asyncWrapper(controller.get));
schoolSupportTicketRoutes.post("/:id/replies", validate({ params: schoolTicketIdSchema, body: schoolTicketMessageSchema }), asyncWrapper(controller.reply));
schoolSupportTicketRoutes.patch("/:id", validate({ params: schoolTicketIdSchema, body: updateSchoolTicketSchema }), asyncWrapper(controller.update));
