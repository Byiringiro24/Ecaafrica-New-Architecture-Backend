/**
 * WireGuard VPN Management — Platform (Super Admin) Controller
 *
 * All endpoints here are platform-admin only.
 * They let the super admin manage VPN peers from the web UI instead of SSH.
 */

import type { Request, Response } from "express";
import { successResponse } from "../../helpers/response";
import { AppError } from "../../middleware/errorHandler";
import * as wg from "../../services/wireguard.service";

/**
 * GET /platform/hardware/vpn/status
 * Returns server public key, interface state, peer list, next available IP.
 */
export const getVpnStatus = async (_req: Request, res: Response) => {
  const status = await wg.getServerStatus();
  res.json(successResponse(status));
};

/**
 * POST /platform/hardware/vpn/ping
 * Ping a VPN IP from the server — exactly like running `ping -c 4 10.0.0.3`
 * in the server terminal. Super admin can verify any tablet's VPN reachability.
 * Body: { target: "10.0.0.3", count?: 4 }
 */
export const pingVpnPeer = async (req: Request, res: Response) => {
  const target = String(req.body?.target ?? "").trim();
  const count  = Math.min(Math.max(1, Number(req.body?.count ?? 4)), 10);

  if (!target) throw new AppError("bad_request", "target IP is required", 400);

  const result = await wg.pingVpnIp(target, count);
  res.json(successResponse(result));
};
export const getVpnPublicKey = async (_req: Request, res: Response) => {
  const status = await wg.getServerStatus();
  res.json(successResponse({
    serverPublicKey: status.serverPublicKey,
    found: !!status.serverPublicKey,
  }));
};

/**
 * POST /platform/hardware/vpn/fix-peer
 * Replace a wrong peer key with the correct one for a given VPN IP.
 * Use when the tablet's active key doesn't match what's registered on the server.
 * Body: { oldPublicKey?: string, newPublicKey: string, vpnIp: string }
 */
export const fixVpnPeer = async (req: Request, res: Response) => {
  const { oldPublicKey, newPublicKey, vpnIp } = req.body as {
    oldPublicKey?: string;
    newPublicKey?: string;
    vpnIp?: string;
  };
  if (!newPublicKey) throw new AppError("bad_request", "newPublicKey is required", 400);
  if (!vpnIp)        throw new AppError("bad_request", "vpnIp is required", 400);

  // Remove old peer if it exists and is different
  if (oldPublicKey && oldPublicKey !== newPublicKey) {
    await wg.removePeer(oldPublicKey).catch(() => null);
  }
  const result = await wg.addPeer({ publicKey: newPublicKey, vpnIp });
  res.json(successResponse({ ...result, fixed: true }));
};

/**
 * POST /platform/hardware/vpn/peers
 * Add a new tablet peer to WireGuard.
 * Body: { publicKey, vpnIp, comment? }
 */
export const addVpnPeer = async (req: Request, res: Response) => {
  const { publicKey, vpnIp, comment } = req.body as {
    publicKey?: string;
    vpnIp?: string;
    comment?: string;
  };

  if (!publicKey) throw new AppError("bad_request", "publicKey is required", 400);
  if (!vpnIp) throw new AppError("bad_request", "vpnIp is required", 400);

  const result = await wg.addPeer({ publicKey, vpnIp, comment });
  res.status(201).json(successResponse(result));
};

/**
 * PATCH /platform/hardware/vpn/peers/:publicKey
 * Update the allowed-ips for an existing peer (changes its VPN IP).
 * Body: { vpnIp: "10.0.0.5" }
 */
export const updateVpnPeer = async (req: Request, res: Response) => {
  const publicKey = decodeURIComponent(req.params.publicKey ?? "");
  const vpnIp = String(req.body?.vpnIp ?? "").trim();
  if (!publicKey) throw new AppError("bad_request", "publicKey is required", 400);
  if (!vpnIp)    throw new AppError("bad_request", "vpnIp is required", 400);

  // Remove old peer and re-add with new IP (wg has no "update" — remove+add is atomic enough)
  await wg.removePeer(publicKey);
  await wg.addPeer({ publicKey, vpnIp, comment: req.body?.comment });
  res.json(successResponse({ publicKey, vpnIp, updated: true }));
};

/**
 * DELETE /platform/hardware/vpn/peers/:publicKey
 * Remove a peer (base64 public key, URL-encoded).
 */
export const removeVpnPeer = async (req: Request, res: Response) => {
  const publicKey = decodeURIComponent(req.params.publicKey ?? "");
  if (!publicKey) throw new AppError("bad_request", "publicKey is required", 400);

  await wg.removePeer(publicKey);
  res.json(successResponse({ removed: true }));
};

/**
 * POST /platform/hardware/vpn/ensure-up
 * Start the WireGuard interface if it is not running.
 */
export const ensureVpnUp = async (_req: Request, res: Response) => {
  const result = await wg.ensureInterfaceUp();
  res.json(successResponse(result));
};

/**
 * POST /platform/hardware/vpn/build-config
 * Given a tablet private key + assigned VPN IP, build the .conf content
 * the tablet should import into WireGuard for Windows.
 * Body: { tabletPrivateKey, tabletVpnIp }
 */
export const buildTabletConfig = async (req: Request, res: Response) => {
  const { tabletPrivateKey, tabletVpnIp } = req.body as {
    tabletPrivateKey?: string;
    tabletVpnIp?: string;
  };

  if (!tabletPrivateKey) throw new AppError("bad_request", "tabletPrivateKey is required", 400);
  if (!tabletVpnIp) throw new AppError("bad_request", "tabletVpnIp is required", 400);

  const status = await wg.getServerStatus();
  if (!status.serverPublicKey) {
    throw new AppError("server_error", "Server WireGuard public key not found. Run wg genkey on the server first.", 500);
  }

  const config = wg.buildTabletConfig({
    tabletPrivateKey,
    tabletVpnIp,
    serverPublicKey: status.serverPublicKey,
    serverEndpoint: status.serverEndpoint,
  });

  res.json(successResponse({ config, vpnIp: tabletVpnIp }));
};
