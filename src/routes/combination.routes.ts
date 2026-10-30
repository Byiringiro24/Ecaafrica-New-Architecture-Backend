import { Router } from "express";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import * as controller from "../controllers/combination.controller";
import { combinationIdParamSchema, createCombinationSchema, listCombinationsSchema, updateCombinationSchema } from "../validators/combination.validator";

export const combinationRoutes = Router();
combinationRoutes.use(verifyToken, requireSchoolAccess);
combinationRoutes.get("/", validate(listCombinationsSchema), asyncWrapper(controller.list));
combinationRoutes.post("/", validate(createCombinationSchema), asyncWrapper(controller.create));
combinationRoutes.patch("/:id", validate(updateCombinationSchema), asyncWrapper(controller.update));
combinationRoutes.delete("/:id", validate({ params: combinationIdParamSchema }), asyncWrapper(controller.remove));
