import { Router } from "express";
import { z } from "zod";
import * as hardwareController from "../../controllers/platform/hardware.controller";
import { asyncWrapper } from "../../helpers/asyncWrapper";
import { verifyPlatformToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/roleGuard";
import { validate } from "../../middleware/validate";
import { PlatformRole } from "../../constants/roles";

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

const platformTabletSchema = {
  body: z.object({
    school_id: z.union([z.string().regex(/^\d+$/), z.number()]),
    name: z.string().min(1).max(100),
    ip: z.string().min(3).max(50),
    port: z.number().int().min(1).max(65535).optional().default(5000),
    location: z.string().max(100).optional(),
    notes: z.string().optional(),
  }),
};

const platformTabletUpdateSchema = {
  params: idParamSchema,
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    ip: z.string().min(3).max(50).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    location: z.string().max(100).optional(),
    notes: z.string().optional(),
    is_active: z.boolean().optional(),
    school_id: z.union([z.string().regex(/^\d+$/), z.number()]).optional(), // allow school reassignment
  }),
};

const platformDeviceSchema = {
  body: z.object({
    school_id: z.union([z.string().regex(/^\d+$/), z.number()]),
    device_uid: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    type: z.enum(["tablet", "kiosk", "web"]).optional(),
    location: z.string().max(100).optional(),
    mode: z.enum(["gate", "boarding", "classroom"]).optional(),
    tablet_ip: z.string().max(50).optional(),
    tablet_port: z.number().int().min(1).max(65535).optional(),
    tablet_id: z.union([z.string().regex(/^\d+$/), z.number()]).nullable().optional(),
    license_number: z.number().int().optional(),
    device_serial: z.string().max(100).optional(),
    product_code: z.string().max(50).optional(),
    product_name: z.string().max(100).optional(),
    api_url: z.string().max(255).optional(),
    firmware_version: z.string().max(20).optional(),
  }),
};

const platformDeviceUpdateSchema = {
  params: idParamSchema,
  body: platformDeviceSchema.body
    .omit({ device_uid: true })
    .extend({ school_id: z.union([z.string().regex(/^\d+$/), z.number()]).optional() })
    .partial(),
};

export const hardwareRoutes = Router();

hardwareRoutes.use(verifyPlatformToken, requireRole(PlatformRole.PLATFORM_ADMIN));

hardwareRoutes.get("/tablets", asyncWrapper(hardwareController.listTablets));
hardwareRoutes.post("/tablets", validate(platformTabletSchema), asyncWrapper(hardwareController.createTablet));
// ── /tablets/dev-password/all MUST come before /tablets/:id ──────────────────
// Express matches routes in registration order. If /:id is first, Express treats
// the literal "dev-password" as the :id param and this endpoint is never reached.
hardwareRoutes.patch("/tablets/dev-password/all", asyncWrapper(hardwareController.setAllTabletsDevPassword));
hardwareRoutes.patch("/tablets/:id", validate(platformTabletUpdateSchema), asyncWrapper(hardwareController.updateTablet));
hardwareRoutes.delete("/tablets/:id", validate({ params: idParamSchema }), asyncWrapper(hardwareController.deleteTablet));
// Live ping — checks if the tablet bridge is reachable over WireGuard VPN right now
hardwareRoutes.get("/tablets/:id/ping", validate({ params: idParamSchema }), asyncWrapper(hardwareController.pingTablet));
// Set developer password remotely — tablet polls and applies it. Send null to remove.
hardwareRoutes.patch("/tablets/:id/dev-password", validate({ params: idParamSchema }), asyncWrapper(hardwareController.setTabletDevPassword));

hardwareRoutes.get("/devices", asyncWrapper(hardwareController.listDevices));
hardwareRoutes.post("/devices", validate(platformDeviceSchema), asyncWrapper(hardwareController.createDevice));
hardwareRoutes.patch("/devices/:id", validate(platformDeviceUpdateSchema), asyncWrapper(hardwareController.updateDevice));
hardwareRoutes.delete("/devices/:id", validate({ params: idParamSchema }), asyncWrapper(hardwareController.deleteDevice));

// ── WireGuard VPN Management (super admin — no SSH required) ──────────────────
import * as vpnController from "../../controllers/platform/wireguard.controller";

// Get server VPN status, public key, peer list, next available IP
hardwareRoutes.get("/vpn/status", asyncWrapper(vpnController.getVpnStatus));

// Get just the server public key (lightweight — no peer dump)
hardwareRoutes.get("/vpn/pubkey", asyncWrapper(vpnController.getVpnPublicKey));

// Ping any VPN IP from the server (ICMP — same as running ping in the server terminal)
hardwareRoutes.post("/vpn/ping", asyncWrapper(vpnController.pingVpnPeer));

// Fix peer — replace wrong key with correct key for a given VPN IP
hardwareRoutes.post("/vpn/fix-peer", asyncWrapper(vpnController.fixVpnPeer));

// Add a tablet as a WireGuard peer (live, no restart)
hardwareRoutes.post("/vpn/peers", asyncWrapper(vpnController.addVpnPeer));

// Update a peer's VPN IP (remove + re-add atomically)
hardwareRoutes.patch("/vpn/peers/:publicKey", asyncWrapper(vpnController.updateVpnPeer));

// Remove a peer by public key (URL-encoded)
hardwareRoutes.delete("/vpn/peers/:publicKey", asyncWrapper(vpnController.removeVpnPeer));

// Start the WireGuard interface if down
hardwareRoutes.post("/vpn/ensure-up", asyncWrapper(vpnController.ensureVpnUp));

// Build the WireGuard .conf content the tablet needs to import
hardwareRoutes.post("/vpn/build-config", asyncWrapper(vpnController.buildTabletConfig));
