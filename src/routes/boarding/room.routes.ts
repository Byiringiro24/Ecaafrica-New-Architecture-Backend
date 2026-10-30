/**
 * @swagger
 * tags:
 *   - name: Boarding Rooms
 *     description: Dorm room management
 *
 * /boarding/rooms:
 *   get:
 *     summary: List dorm rooms
 *     tags: [Boarding Rooms]
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
 *     summary: Create dorm room
 *     tags: [Boarding Rooms]
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
 * /boarding/rooms/{id}:
 *   get:
 *     summary: Get dorm room by id
 *     tags: [Boarding Rooms]
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
 *     summary: Update dorm room
 *     tags: [Boarding Rooms]
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
 *     summary: Delete dorm room
 *     tags: [Boarding Rooms]
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
import * as roomController from "../../controllers/boarding/room.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyToken } from "../../middleware/auth";
import { requireSchoolAccess, requireBoardingRole, requireRole } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import {
  createDormRoomSchema,
  dormRoomIdParamSchema,
  listDormRoomsSchema,
  updateDormRoomSchema,
} from "../../validators/boarding/room.validator";

export const dormRoomRoutes = Router();

dormRoomRoutes.use(verifyToken, requireSchoolAccess);

dormRoomRoutes.get(
  "/",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate(listDormRoomsSchema),
  asyncWrapper(roomController.listDormRooms),
);

dormRoomRoutes.post(
  "/",
  requireBoardingRole,
  validate(createDormRoomSchema),
  asyncWrapper(roomController.createDormRoom),
);

dormRoomRoutes.get(
  "/:id",
  requireRole("school_admin", "director_of_discipline", "patron", "matron"),
  validate({ params: dormRoomIdParamSchema }),
  asyncWrapper(roomController.getDormRoom),
);

dormRoomRoutes.patch(
  "/:id",
  requireBoardingRole,
  validate(updateDormRoomSchema),
  asyncWrapper(roomController.updateDormRoom),
);

dormRoomRoutes.delete(
  "/:id",
  requireBoardingRole,
  validate({ params: dormRoomIdParamSchema }),
  asyncWrapper(roomController.deleteDormRoom),
);

