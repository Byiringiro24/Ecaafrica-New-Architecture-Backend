/**
 * @swagger
 * tags:
 *   - name: Visitor Appointments
 *     description: Visitor appointment management
 *
 * /visitor-appointments:
 *   get:
 *     summary: List visitor appointments
 *     tags: [Visitor Appointments]
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
 *     summary: Create visitor appointment
 *     tags: [Visitor Appointments]
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
 * /visitor-appointments/{id}:
 *   get:
 *     summary: Get visitor appointment by id
 *     tags: [Visitor Appointments]
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
 *     summary: Update visitor appointment
 *     tags: [Visitor Appointments]
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
 *     summary: Delete visitor appointment
 *     tags: [Visitor Appointments]
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
 * /visitor-appointments/{id}/confirm:
 *   patch:
 *     summary: Confirm visitor appointment
 *     tags: [Visitor Appointments]
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
 * /visitor-appointments/{id}/cancel:
 *   patch:
 *     summary: Cancel visitor appointment
 *     tags: [Visitor Appointments]
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
 * /visitor-appointments/{id}/complete:
 *   patch:
 *     summary: Complete visitor appointment
 *     tags: [Visitor Appointments]
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
import * as appointmentController from "../controllers/visitor/appointment.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { requireSchoolAccess } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  appointmentIdParamSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema
} from "../validators/visitor/appointment.validator";

export const visitorAppointmentRoutes = Router();

visitorAppointmentRoutes.use(verifyToken, requireSchoolAccess);

visitorAppointmentRoutes.get(
  "/",
  validate(listAppointmentsSchema),
  asyncWrapper(appointmentController.listAppointments)
);

visitorAppointmentRoutes.post(
  "/",
  validate(createAppointmentSchema),
  asyncWrapper(appointmentController.createAppointment)
);

visitorAppointmentRoutes.get(
  "/:id",
  validate({ params: appointmentIdParamSchema }),
  asyncWrapper(appointmentController.getAppointment)
);

visitorAppointmentRoutes.patch(
  "/:id",
  validate(updateAppointmentSchema),
  asyncWrapper(appointmentController.updateAppointment)
);

visitorAppointmentRoutes.delete(
  "/:id",
  validate({ params: appointmentIdParamSchema }),
  asyncWrapper(appointmentController.deleteAppointment)
);

visitorAppointmentRoutes.patch(
  "/:id/confirm",
  validate({ params: appointmentIdParamSchema }),
  asyncWrapper(appointmentController.confirmAppointment)
);

visitorAppointmentRoutes.patch(
  "/:id/cancel",
  validate({ params: appointmentIdParamSchema }),
  asyncWrapper(appointmentController.cancelAppointment)
);

visitorAppointmentRoutes.patch(
  "/:id/complete",
  validate({ params: appointmentIdParamSchema }),
  asyncWrapper(appointmentController.completeAppointment)
);
