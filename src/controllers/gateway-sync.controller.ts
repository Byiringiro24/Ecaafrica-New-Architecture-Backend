import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import * as gatewaySyncService from "../services/gateway-sync.service";

export const heartbeat = async (req: Request, res: Response) => {
  const payload = req.body as {
    gateway_id: string;
    school_id?: string;
    device_count?: number;
    online?: boolean;
    last_seen_at?: string;
    firmware_version?: string;
    battery_level?: number;
    status?: string;
    queue_depth?: number;
  };

  const result = await gatewaySyncService.recordHeartbeat(payload);
  res.json(successResponse(result));
};

export const push = async (req: Request, res: Response) => {
  const payload = req.body as {
    gateway_id: string;
    school_id?: string;
    records: Array<{
      local_id: string;
      record_type: string;
      payload?: Record<string, unknown>;
      event_id?: string;
    }>;
  };

  const result = await gatewaySyncService.processIncomingRecords(payload);
  res.status(202).json(successResponse(result));
};

export const pull = async (req: Request, res: Response) => {
  const payload = req.body as {
    gateway_id: string;
    school_id?: string;
    since?: string;
    last_pull_at?: string;
    sync_cursor?: string;
  };

  const result = await gatewaySyncService.buildPullResponse(payload);
  res.json(successResponse(result));
};

export const commandResult = async (req: Request, res: Response) => {
  const payload = req.body as {
    gateway_id: string;
    school_id?: string;
    command_id: string;
    status: "completed" | "failed" | "rejected";
    result?: Record<string, unknown>;
    error_message?: string;
  };

  const result = await gatewaySyncService.recordCommandResult(payload);
  res.json(successResponse(result));
};
