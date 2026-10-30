/**
 * @swagger
 * tags:
 *   - name: Terms
 *     description: Term management
 *
 * /terms:
 *   get:
 *     summary: List terms
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *   post:
 *     summary: Create term
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *
 * /terms/{id}:
 *   get:
 *     summary: Get term by id
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *   patch:
 *     summary: Update term
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 *   delete:
 *     summary: Delete term
 *     tags: [Terms]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { $ref: "#/components/responses/Success" }
 *       400: { $ref: "#/components/responses/BadRequest" }
 *       401: { $ref: "#/components/responses/Unauthorized" }
 *       403: { $ref: "#/components/responses/Forbidden" }
 *       404: { $ref: "#/components/responses/NotFound" }
 *       500: { $ref: "#/components/responses/ServerError" }
 */
import { Router } from "express";
import * as termController from "../controllers/term.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireRole, requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  createTermSchema,
  listTermsSchema,
  termIdParamSchema,
  updateTermSchema
} from "../validators/term.validator";

export const termRoutes = Router();

termRoutes.use(verifyToken, requireSchoolAccess);

termRoutes.get("/", validate(listTermsSchema), asyncWrapper(termController.listTerms));

termRoutes.post(
  "/",
  requireRole("school_admin", "director_of_studies"),
  validate(createTermSchema),
  asyncWrapper(termController.createTerm)
);

termRoutes.get(
  "/:id",
  validate({ params: termIdParamSchema }),
  asyncWrapper(termController.getTerm)
);

termRoutes.patch(
  "/:id",
  requireRole("school_admin", "director_of_studies"),
  validate(updateTermSchema),
  asyncWrapper(termController.updateTerm)
);

termRoutes.delete(
  "/:id",
  requireRole("school_admin", "director_of_studies"),
  validate({ params: termIdParamSchema }),
  asyncWrapper(termController.deleteTerm)
);
