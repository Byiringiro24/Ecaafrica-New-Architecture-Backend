import { Router } from "express";
import * as controller from "../controllers/dos-work-item.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireDirectorOfStudies, requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { createDosWorkItemSchema, dosWorkItemIdParamSchema, listDosWorkItemsSchema, updateDosWorkItemSchema } from "../validators/dos-work-item.validator";

export const dosWorkItemRoutes = Router();
dosWorkItemRoutes.use(verifyToken, requireSchoolAccess, requireDirectorOfStudies);
dosWorkItemRoutes.get("/summary", asyncWrapper(controller.summary));
dosWorkItemRoutes.get("/", validate(listDosWorkItemsSchema), asyncWrapper(controller.list));
dosWorkItemRoutes.post("/", validate({ body: createDosWorkItemSchema }), asyncWrapper(controller.create));
dosWorkItemRoutes.get("/:id", validate({ params: dosWorkItemIdParamSchema }), asyncWrapper(controller.get));
dosWorkItemRoutes.patch("/:id", validate({ params: dosWorkItemIdParamSchema, body: updateDosWorkItemSchema }), asyncWrapper(controller.update));
dosWorkItemRoutes.delete("/:id", validate({ params: dosWorkItemIdParamSchema }), asyncWrapper(controller.remove));
