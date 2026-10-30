/**
 * @swagger
 * tags:
 *   - name: Levels
 *     description: School level management
 */
import { Router } from "express";
import * as levelController from "../controllers/level.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  createLevelSchema,
  levelIdParamSchema,
  listLevelsSchema,
  updateLevelSchema
} from "../validators/level.validator";

export const levelRoutes = Router();

levelRoutes.use(verifyToken, requireSchoolAccess);

levelRoutes.get("/", validate(listLevelsSchema), asyncWrapper(levelController.listLevels));
levelRoutes.post("/", validate(createLevelSchema), asyncWrapper(levelController.createLevel));
levelRoutes.get("/:id", validate({ params: levelIdParamSchema }), asyncWrapper(levelController.getLevel));
levelRoutes.patch("/:id", validate(updateLevelSchema), asyncWrapper(levelController.updateLevel));
levelRoutes.delete("/:id", validate({ params: levelIdParamSchema }), asyncWrapper(levelController.deleteLevel));
