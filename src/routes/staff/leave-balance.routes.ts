/**
 * @swagger
 * tags:
 *   - name: Staff Leave Balances
 *     description: Staff leave balance management
 *
 * /staff/leave-balances:
 *   get:
 *     summary: List leave balances
 *     tags: [Staff Leave Balances]
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
 *     summary: Create leave balance
 *     tags: [Staff Leave Balances]
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
 * /staff/leave-balances/{id}:
 *   get:
 *     summary: Get leave balance by id
 *     tags: [Staff Leave Balances]
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
 *     summary: Update leave balance
 *     tags: [Staff Leave Balances]
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
 *
 * /staff/leave-balances/{id}/deduct:
 *   patch:
 *     summary: Deduct leave balance
 *     tags: [Staff Leave Balances]
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
 *
 * /staff/leave-balances/{id}/delete:
 *   delete:
 *     summary: Delete leave balance
 *     tags: [Staff Leave Balances]
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
import * as leaveBalanceController from "../../controllers/staff/leave-balance.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { validate } from "../../middleware/validate";
import {
  createLeaveBalanceSchema,
  deductLeaveBalanceSchema,
  leaveBalanceIdParamSchema,
  listLeaveBalancesSchema,
  updateLeaveBalanceSchema
} from "../../validators/staff/leave-balance.validator";

export const staffLeaveBalanceRoutes = Router();

staffLeaveBalanceRoutes.get(
  "/",
  validate(listLeaveBalancesSchema),
  asyncWrapper(leaveBalanceController.listLeaveBalances)
);

staffLeaveBalanceRoutes.post(
  "/",
  validate(createLeaveBalanceSchema),
  asyncWrapper(leaveBalanceController.createLeaveBalance)
);

staffLeaveBalanceRoutes.get(
  "/:id",
  validate({ params: leaveBalanceIdParamSchema }),
  asyncWrapper(leaveBalanceController.getLeaveBalance)
);

staffLeaveBalanceRoutes.patch(
  "/:id",
  validate(updateLeaveBalanceSchema),
  asyncWrapper(leaveBalanceController.updateLeaveBalance)
);

staffLeaveBalanceRoutes.patch(
  "/:id/deduct",
  validate(deductLeaveBalanceSchema),
  asyncWrapper(leaveBalanceController.deductLeaveBalance)
);

staffLeaveBalanceRoutes.delete(
  "/:id",
  validate({ params: leaveBalanceIdParamSchema }),
  asyncWrapper(leaveBalanceController.deleteLeaveBalance)
);
