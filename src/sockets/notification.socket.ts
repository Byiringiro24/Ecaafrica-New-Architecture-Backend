import type { Socket } from "socket.io";
import type { AuthUser } from "../types/auth";
import { getSocketServer } from "../configs/socket";
import { verifyAccessToken } from "../utils/jwt";
import { logger } from "../utils/logger";

type JoinSchoolPayload = {
  token?: string;
  schoolId?: string | number | bigint;
};

type JoinUserPayload = {
  token?: string;
  userId?: string | number | bigint;
};

type JoinAck = (response: { success: boolean; message?: string; room?: string }) => void;

const SCHOOL_ROOM_PREFIX = "school";
const USER_ROOM_PREFIX = "user";

const getSchoolRoom = (schoolId: string | number | bigint) =>
  `${SCHOOL_ROOM_PREFIX}:${schoolId}`;

const getUserRoom = (userId: string | number | bigint) =>
  `${USER_ROOM_PREFIX}:${userId}`;

const normalizeId = (value?: string | number | bigint | null) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === "string" ? value : value.toString();
};

const getTokenFromSocket = (socket: Socket, payload?: { token?: string }) => {
  if (payload?.token && typeof payload.token === "string") {
    return payload.token;
  }

  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string") {
    return authToken;
  }

  const header = socket.handshake.headers?.authorization;
  if (typeof header === "string") {
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token) {
      return token;
    }
  }

  return undefined;
};

const validateSchoolToken = (token: string) => {
  const decoded = verifyAccessToken(token, { scope: "school" });

  if (decoded.token_type && decoded.token_type !== "access") {
    throw new Error("Invalid token type");
  }

  if (decoded.auth_type && decoded.auth_type !== "school") {
    throw new Error("School access required");
  }

  return decoded;
};

export const registerNotificationSocket = (socket: Socket) => {
  socket.on("join_school_room", (payload: JoinSchoolPayload, ack?: JoinAck) => {
    const token = getTokenFromSocket(socket, payload);
    if (!token) {
      ack?.({ success: false, message: "Missing access token" });
      return;
    }

    let decoded: AuthUser;
    try {
      decoded = validateSchoolToken(token);
    } catch (err) {
      ack?.({ success: false, message: "Invalid access token" });
      return;
    }

    const tokenSchoolId = normalizeId(decoded.school_id);
    const requestedSchoolId = normalizeId(payload?.schoolId);

    if (requestedSchoolId && tokenSchoolId && requestedSchoolId !== tokenSchoolId) {
      ack?.({ success: false, message: "School mismatch" });
      return;
    }

    const schoolId = tokenSchoolId ?? requestedSchoolId;
    if (!schoolId) {
      ack?.({ success: false, message: "Missing school id" });
      return;
    }

    socket.data.user = decoded;
    socket.data.schoolId = schoolId;
    socket.data.userId = normalizeId(decoded.id);

    const room = getSchoolRoom(schoolId);
    socket.join(room);

    ack?.({ success: true, room });
  });

  socket.on("join_user_room", (payload: JoinUserPayload, ack?: JoinAck) => {
    const token = getTokenFromSocket(socket, payload);

    if (token) {
      try {
        const decoded = validateSchoolToken(token);
        socket.data.user = decoded;
        socket.data.schoolId = normalizeId(decoded.school_id);
        socket.data.userId = normalizeId(decoded.id);
      } catch (err) {
        ack?.({ success: false, message: "Invalid access token" });
        return;
      }
    }

    const requestedUserId = normalizeId(payload?.userId);
    const userId = requestedUserId ?? normalizeId(socket.data.userId);

    if (!userId) {
      ack?.({ success: false, message: "Missing user id" });
      return;
    }

    if (requestedUserId && socket.data.userId && requestedUserId !== normalizeId(socket.data.userId)) {
      ack?.({ success: false, message: "User mismatch" });
      return;
    }

    const room = getUserRoom(userId);
    socket.join(room);

    ack?.({ success: true, room });
  });
};

const emitToRoom = (room: string, event: string, payload: unknown) => {
  const io = getSocketServer();
  if (!io) {
    logger.debug({ event, room }, "Socket.IO not initialized");
    return;
  }

  io.to(room).emit(event, payload);
};

export const emitNewNotification = (userId: string | number | bigint, payload: unknown) => {
  emitToRoom(getUserRoom(userId), "new_notification", payload);
};

export const emitAbsenceAlert = (schoolId: string | number | bigint, payload: unknown) => {
  emitToRoom(getSchoolRoom(schoolId), "absence_alert", payload);
};

export const emitGateEvent = (schoolId: string | number | bigint, payload: unknown) => {
  emitToRoom(getSchoolRoom(schoolId), "gate_event", payload);
};

export const emitRollCallUpdate = (
  schoolId: string | number | bigint,
  payload: unknown
) => {
  emitToRoom(getSchoolRoom(schoolId), "roll_call_update", payload);
};
