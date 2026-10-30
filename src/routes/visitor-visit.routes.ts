/**
 * @swagger
 * tags:
 *   - name: Visitor Visits
 *     description: Visitor visit management
 *
 * /visitor-visits:
 *   get:
 *     summary: List visitor visits
 *     tags: [Visitor Visits]
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
 *     summary: Create visitor visit
 *     tags: [Visitor Visits]
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
 * /visitor-visits/{id}:
 *   get:
 *     summary: Get visitor visit by id
 *     tags: [Visitor Visits]
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
 *     summary: Update visitor visit
 *     tags: [Visitor Visits]
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
 *     summary: Delete visitor visit
 *     tags: [Visitor Visits]
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
 *
 * /visitor-visits/{id}/check-out:
 *   patch:
 *     summary: Check out visitor visit
 *     tags: [Visitor Visits]
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
import * as visitController from "../controllers/visitor/visit.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  createVisitSchema,
  listVisitsSchema,
  updateVisitSchema,
  visitIdParamSchema
} from "../validators/visitor/visit.validator";

export const visitorVisitRoutes = Router();

visitorVisitRoutes.use(verifyToken, requireSchoolAccess);

visitorVisitRoutes.get(
  "/",
  validate(listVisitsSchema),
  asyncWrapper(visitController.listVisits)
);

visitorVisitRoutes.post(
  "/",
  validate(createVisitSchema),
  asyncWrapper(visitController.createVisit)
);

visitorVisitRoutes.get(
  "/:id",
  validate({ params: visitIdParamSchema }),
  asyncWrapper(visitController.getVisit)
);

visitorVisitRoutes.patch(
  "/:id",
  validate(updateVisitSchema),
  asyncWrapper(visitController.updateVisit)
);

visitorVisitRoutes.delete(
  "/:id",
  validate({ params: visitIdParamSchema }),
  asyncWrapper(visitController.deleteVisit)
);

visitorVisitRoutes.patch(
  "/:id/check-out",
  validate({ params: visitIdParamSchema }),
  asyncWrapper(visitController.checkOutVisit)
);
