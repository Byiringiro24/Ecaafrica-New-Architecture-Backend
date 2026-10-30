import { Router } from "express";
import * as gatewaySyncController from "../controllers/gateway-sync.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  gatewayHeartbeatSchema,
  gatewayPushSchema,
  gatewayPullSchema,
  gatewayCommandResultSchema
} from "../validators/gateway.validator";

export const gatewayRoutes = Router();

gatewayRoutes.use(verifyToken);

gatewayRoutes.post(
  "/heartbeat",
  validate(gatewayHeartbeatSchema),
  asyncWrapper(gatewaySyncController.heartbeat)
);

gatewayRoutes.post(
  "/push",
  validate(gatewayPushSchema),
  asyncWrapper(gatewaySyncController.push)
);

gatewayRoutes.post(
  "/pull",
  validate(gatewayPullSchema),
  asyncWrapper(gatewaySyncController.pull)
);

gatewayRoutes.post(
  "/command-result",
  validate(gatewayCommandResultSchema),
  asyncWrapper(gatewaySyncController.commandResult)
);
