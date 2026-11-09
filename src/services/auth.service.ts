import crypto from "crypto";
import jwt from "jsonwebtoken";
import { UserRole, UserStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../database/prisma";
import { env } from "../configs/env";
import { AppError } from "../middleware/errorHandler";
import { comparePassword, hashPassword } from "../utils/hash";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type TokenScope
} from "../utils/jwt";
import { logger } from "../utils/logger";
import { buildResetUrl, sendPasswordResetEmail, sendStaffOnboardingEmail } from "../utils/mailer";
import { AuditActorType } from "../constants/enums";
import { PlatformRole } from "../constants/roles";
import type { AuthUser } from "../types/auth";
import { logAction } from "./audit.service";

const parseDurationMs = (value: string) => {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(value.trim());
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase() as "s" | "m" | "h" | "d"];
  return amount * multiplier;
};

const REFRESH_TTL_MS = parseDurationMs(env.JWT_REFRESH_EXPIRES_IN);
// Reset links are deliberately long enough for staff who do not read email
// immediately, while remaining short-lived and single-use through sessions.
const RESET_TTL_MS = 24 * 60 * 60 * 1000;
const STAFF_ONBOARDING_TTL_MS = 24 * 60 * 60 * 1000;
const SCHOOL_SUSPENDED_MESSAGE =
  "School suspended. Check your email and contact the system administrator.";

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildTokenHash = (token: string, type: "refresh" | "reset") =>
  `${type}_${hashToken(token)}`;

const getDatabaseNow = async () => {
  const result = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS now`;
  return result[0]?.now ?? new Date();
};

const toBigInt = (value: string | number | bigint) => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value);
};

const mapPlatformRole = (role: string) =>
  role === "support" ? PlatformRole.PLATFORM_SUPPORT : PlatformRole.PLATFORM_ADMIN;

const formatRole = (role: {
  id: bigint;
  name: string;
  slug: string;
  permissions: unknown;
  is_system: boolean;
}) => ({
  id: role.id.toString(),
  name: role.name,
  slug: role.slug,
  permissions: role.permissions,
  is_system: role.is_system
});

const schoolSelect = {
  status: true,
  country: true,
  currency: true,
  name: true,
  province: true,
  district: true,
  sector: true,
  logo_url: true,
  website: true,
  principal_name: true,
  principal_phone: true,
  principal_email: true,
  school_phone: true,
  school_email: true
} as const;

const formatSchoolUser = (user: {
  id: bigint;
  uuid: string;
  school_id: bigint;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  school?: {
    status: string;
    country?: string | null;
    currency?: string | null;
    name: string;
    province?: string | null;
    district?: string | null;
    sector?: string | null;
    logo_url?: string | null;
    website?: string | null;
    principal_name?: string | null;
    principal_phone?: string | null;
    principal_email?: string | null;
    school_phone?: string | null;
    school_email?: string | null;
  } | null;
  user_roles?: { role: { id: bigint; name: string; slug: string; permissions: unknown; is_system: boolean } }[];
}) => ({
  id: user.id.toString(),
  uuid: user.uuid,
  school_id: user.school_id.toString(),
  school_name: user.school?.name ?? null,
  school_country: user.school?.country ?? null,
  school_currency: user.school?.currency ?? "RWF",
  school_province: user.school?.province ?? null,
  school_district: user.school?.district ?? null,
  school_sector: user.school?.sector ?? null,
  school_logo_url: user.school?.logo_url ?? null,
  school_website: user.school?.website ?? null,
  school_principal_name: user.school?.principal_name ?? null,
  school_principal_phone: user.school?.principal_phone ?? null,
  school_principal_email: user.school?.principal_email ?? null,
  school_phone: user.school?.school_phone ?? null,
  school_email: user.school?.school_email ?? null,
  school_status: user.school?.status ?? null,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  avatar_url: user.avatar_url,
  roles: user.user_roles?.map((userRole) => formatRole(userRole.role)) ?? []
});

const formatPlatformUser = (user: {
  id: bigint;
  uuid: string;
  name: string;
  email: string;
  role: string;
  status: string;
  access_scope: string;
  permissions: unknown;
}) => ({
  id: user.id.toString(),
  uuid: user.uuid,
  name: user.name,
  email: user.email,
  role: mapPlatformRole(user.role),
  status: user.status,
  access_scope: user.access_scope,
  permissions: user.permissions
});

const buildSchoolPayload = (user: {
  id: bigint;
  role: string;
  school_id: bigint;
  user_roles?: { role: { name: string; slug: string } }[];
}): AuthUser => {
  // Collect all role slugs from the user_roles join table as secondary roles.
  // These are embedded directly in the JWT so middleware never needs a DB call.
  const secondary_roles = (user.user_roles ?? [])
    .map((ur) => ur.role.slug)
    .filter((slug) => slug && slug !== user.role);

  return {
    id: user.id.toString(),
    role: user.role,
    secondary_roles: secondary_roles.length ? secondary_roles : undefined,
    school_id: user.school_id.toString(),
    auth_type: "school"
  };
};

const buildPlatformPayload = (user: { id: bigint; role: string }): AuthUser => ({
  id: user.id.toString(),
  role: mapPlatformRole(user.role),
  auth_type: "platform"
});

const createSession = async (input: {
  userId?: bigint;
  platformUserId?: bigint;
  schoolId?: bigint | null;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}) => {
  if (!input.userId && !input.platformUserId) {
    throw new AppError("bad_request", "Missing session owner", 400);
  }

  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const tokenHash = buildTokenHash(input.refreshToken, "refresh");

  return prisma.sessions.create({
    data: {
      user_id: input.userId ?? null,
      platform_user_id: input.platformUserId ?? null,
      school_id: input.schoolId ?? null,
      token_hash: tokenHash,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      expires_at: expiresAt
    }
  });
};

const rotateSession = async (sessionId: bigint, refreshToken: string) => {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const tokenHash = buildTokenHash(refreshToken, "refresh");

  await prisma.sessions.update({
    where: { id: sessionId },
    data: {
      token_hash: tokenHash,
      expires_at: expiresAt,
      revoked_at: null
    }
  });
};

type PasswordResetTokenResult = {
  token: string;
  recipientName: string;
};

export const issuePasswordResetToken = async (
  email: string,
  options: { revokeExisting?: boolean; ttlMs?: number } = {}
): Promise<PasswordResetTokenResult | null> => {
  const revokeExisting = options.revokeExisting ?? true;
  const ttlMs = options.ttlMs ?? RESET_TTL_MS;
  const issuedAt = await getDatabaseNow();
  const platformUser = await prisma.platform_users.findFirst({
    where: {
      email,
      deleted_at: null
    }
  });

  if (platformUser) {
    if (revokeExisting) {
      await prisma.sessions.updateMany({
        where: {
          platform_user_id: platformUser.id,
          token_hash: { startsWith: "reset_" },
          revoked_at: null
        },
        data: { revoked_at: new Date() }
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = buildTokenHash(token, "reset");
    const expiresAt = new Date(issuedAt.getTime() + ttlMs);

    await prisma.sessions.create({
      data: {
        platform_user_id: platformUser.id,
        token_hash: tokenHash,
        expires_at: expiresAt
      }
    });

    return {
      token,
      recipientName: platformUser.name ?? email
    };
  }

  let user = await prisma.users.findFirst({
    where: {
      email,
      deleted_at: null
    }
  });

  if (!user) {
    const school = await prisma.schools.findFirst({
      where: {
        deleted_at: null,
        OR: [{ school_email: email }, { principal_email: email }]
      },
      select: { id: true, name: true, principal_name: true }
    });

    if (!school) {
      return null;
    }

    const tempPassword = crypto.randomBytes(24).toString("hex");
    const passwordHash = await hashPassword(tempPassword);
    const displayName = school.principal_name ?? `${school.name} Admin`;

    user = await prisma.users.create({
      data: {
        uuid: uuidv4(),
        school_id: school.id,
        name: displayName,
        email,
        password_hash: passwordHash,
        role: UserRole.school_admin,
        status: UserStatus.pending
      }
    });
  }

  if (!user.email) {
    logger.warn({ userId: user.id.toString() }, "Missing email for reset");
    return null;
  }

  if (revokeExisting) {
    await prisma.sessions.updateMany({
      where: {
        user_id: user.id,
        token_hash: { startsWith: "reset_" },
        revoked_at: null
      },
      data: { revoked_at: new Date() }
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = buildTokenHash(token, "reset");
  const expiresAt = new Date(issuedAt.getTime() + ttlMs);

  await prisma.sessions.create({
    data: {
      user_id: user.id,
      school_id: user.school_id,
      token_hash: tokenHash,
      expires_at: expiresAt
    }
  });

  return {
    token,
    recipientName: user.name ?? user.email
  };
};

export const loginSchoolUser = async (
  email: string,
  password: string,
  schoolId?: string | number | bigint
) => {
  const schoolFilter = schoolId ? { school_id: toBigInt(schoolId) } : {};
  const user = await prisma.users.findFirst({
    where: {
      email,
      deleted_at: null,
      ...schoolFilter
    },
    include: {
      user_roles: {
        include: {
          role: true
        }
      },
      school: {
        select: schoolSelect
      }
    }
  });

  if (!user) {
    throw new AppError("invalid_credentials", "Invalid email or password", 401);
  }

  if (user.school?.status === "suspended") {
    throw new AppError("forbidden", SCHOOL_SUSPENDED_MESSAGE, 403);
  }

  const passwordValid = await comparePassword(user.password_hash, password);
  if (!passwordValid) {
    throw new AppError("invalid_credentials", "Invalid email or password", 401);
  }

  await prisma.users.update({
    where: { id: user.id },
    data: { last_login_at: new Date() }
  });

  const payload = buildSchoolPayload(user);
  const accessToken = signAccessToken(payload, { scope: "school" });
  const refreshToken = signRefreshToken(payload, { scope: "school" });

  await createSession({
    userId: user.id,
    schoolId: user.school_id,
    refreshToken
  });

  void logAction(user.id, AuditActorType.SCHOOL_USER, "login", "users", user.id, {
    schoolId: user.school_id,
    actorName: user.name,
    severity: "info"
  });

  return {
    user: formatSchoolUser(user),
    accessToken,
    refreshToken
  };
};

export const loginPlatformUser = async (email: string, password: string) => {
  const user = await prisma.platform_users.findFirst({
    where: {
      email,
      deleted_at: null
    }
  });

  if (!user) {
    throw new AppError("invalid_credentials", "Invalid email or password", 401);
  }

  const passwordValid = await comparePassword(user.password_hash, password);
  if (!passwordValid) {
    throw new AppError("invalid_credentials", "Invalid email or password", 401);
  }

  await prisma.platform_users.update({
    where: { id: user.id },
    data: { last_login_at: new Date() }
  });

  const payload = buildPlatformPayload(user);
  const accessToken = signAccessToken(payload, { scope: "platform" });
  const refreshToken = signRefreshToken(payload, { scope: "platform" });

  await createSession({
    platformUserId: user.id,
    refreshToken
  });

  void logAction(user.id, AuditActorType.PLATFORM_USER, "login", "platform_users", user.id, {
    actorName: user.name,
    severity: "info"
  });

  return {
    user: formatPlatformUser(user),
    accessToken,
    refreshToken
  };
};

export const refreshTokens = async (refreshToken: string) => {
  const decoded = jwt.decode(refreshToken);
  let scope: TokenScope =
    decoded && typeof decoded === "object" && decoded.auth_type === "platform"
      ? "platform"
      : "school";

  let payload: AuthUser;
  try {
    payload = verifyRefreshToken(refreshToken, { scope });
  } catch (err) {
    if (scope === "platform") {
      scope = "school";
      payload = verifyRefreshToken(refreshToken, { scope });
    } else {
      throw err;
    }
  }

  if (payload.token_type && payload.token_type !== "refresh") {
    throw new AppError("invalid_token", "Invalid refresh token", 401);
  }

  if (scope === "platform") {
    const tokenHash = buildTokenHash(refreshToken, "refresh");
    const session = await prisma.sessions.findFirst({
      where: {
        token_hash: tokenHash,
        platform_user_id: toBigInt(payload.id),
        revoked_at: null
      }
    });

    if (!session || session.expires_at < new Date()) {
      throw new AppError("invalid_token", "Refresh token expired", 401);
    }

    const platformUser = await prisma.platform_users.findUnique({
      where: { id: toBigInt(payload.id) }
    });

    if (!platformUser) {
      throw new AppError("not_found", "User not found", 404);
    }

    const nextPayload = buildPlatformPayload(platformUser);
    const accessToken = signAccessToken(nextPayload, { scope: "platform" });
    const nextRefreshToken = signRefreshToken(nextPayload, { scope: "platform" });

    await rotateSession(session.id, nextRefreshToken);

    return {
      user: formatPlatformUser(platformUser),
      accessToken,
      refreshToken: nextRefreshToken
    };
  }

  const tokenHash = buildTokenHash(refreshToken, "refresh");
  const session = await prisma.sessions.findFirst({
    where: {
      token_hash: tokenHash,
      user_id: toBigInt(payload.id),
      revoked_at: null
    }
  });

  if (!session || session.expires_at < new Date()) {
    throw new AppError("invalid_token", "Refresh token expired", 401);
  }

  if (!session.user_id) {
    throw new AppError("invalid_token", "Refresh token invalid", 401);
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user_id },
    include: {
      school: {
        select: schoolSelect
      },
      user_roles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError("not_found", "User not found", 404);
  }

  if (user.school?.status === "suspended") {
    throw new AppError("forbidden", SCHOOL_SUSPENDED_MESSAGE, 403);
  }

  const nextPayload = buildSchoolPayload(user);
  const accessToken = signAccessToken(nextPayload, { scope: "school" });
  const nextRefreshToken = signRefreshToken(nextPayload, { scope: "school" });

  await rotateSession(session.id, nextRefreshToken);

  return {
    user: formatSchoolUser(user),
    accessToken,
    refreshToken: nextRefreshToken
  };
};

export const forgotPassword = async (
  email: string,
  options: { includeResetUrl?: boolean } = {}
) => {
  const result = await issuePasswordResetToken(email);
  if (!result) {
    return null;
  }

  await sendPasswordResetEmail(email, result.token, result.recipientName);
  logger.info({ email }, "Password reset email sent");

  return options.includeResetUrl ? buildResetUrl(result.token) : null;
};

/** Send a password reset link for a specific school staff account. */
export const sendStaffPasswordReset = async (
  schoolId: string | number | bigint,
  userId: string | number | bigint,
  requestedBy: string | number | bigint,
) => {
  const user = await prisma.users.findFirst({
    where: {
      ...(String(userId).match(/^\d+$/)
        ? { id: toBigInt(userId) }
        : { uuid: String(userId) }),
      school_id: toBigInt(schoolId),
      deleted_at: null,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    throw new AppError("not_found", "Staff user not found", 404);
  }
  if (!user.email) {
    throw new AppError("bad_request", "This staff member has no email address", 400);
  }

  const result = await issuePasswordResetToken(user.email, { ttlMs: RESET_TTL_MS });
  if (!result) {
    throw new AppError("not_found", "Staff user not found", 404);
  }

  await sendPasswordResetEmail(user.email, result.token, user.name);
  void logAction(requestedBy, AuditActorType.SCHOOL_USER, "request_password_reset", "users", user.id, {
    schoolId,
    resourceName: user.name,
    newValues: { email: user.email, role: user.role },
    severity: "info",
  });

  return { email: user.email, expiresInHours: 24 };
};

export const sendStaffOnboarding = async (email: string) => {
  // Staff creation can be retried by the UI or API gateway while the email is
  // being sent. Keep earlier onboarding links valid so a retry cannot expire
  // the link that was already delivered to the staff member.
  const result = await issuePasswordResetToken(email, {
    revokeExisting: false,
    ttlMs: STAFF_ONBOARDING_TTL_MS
  });
  if (!result) {
    return null;
  }

  await sendStaffOnboardingEmail(email, result.recipientName, result.token);
  logger.info({ email }, "Staff onboarding email sent");
  return true;
};

export const resetPassword = async (token: string, newPassword: string) => {
  const tokenHash = buildTokenHash(token, "reset");
  // Compare against the database clock. The API host and PostgreSQL can have
  // different timezone/clock settings, which otherwise makes fresh tokens
  // appear expired immediately after they are issued.
  const sessions = await prisma.$queryRaw<Array<{
    id: bigint;
    user_id: bigint | null;
    platform_user_id: bigint | null;
  }>>`
    SELECT id, user_id, platform_user_id
    FROM sessions
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `;
  const session = sessions[0];

  if (!session) {
    throw new AppError("invalid_token", "Reset token expired", 400);
  }

  const password_hash = await hashPassword(newPassword);

  if (session.user_id) {
    await prisma.users.update({
      where: { id: session.user_id },
      data: { password_hash }
    });

    await prisma.sessions.updateMany({
      where: { user_id: session.user_id, revoked_at: null },
      data: { revoked_at: new Date() }
    });

    return;
  }

  if (session.platform_user_id) {
    await prisma.platform_users.update({
      where: { id: session.platform_user_id },
      data: { password_hash }
    });

    await prisma.sessions.updateMany({
      where: { platform_user_id: session.platform_user_id, revoked_at: null },
      data: { revoked_at: new Date() }
    });

    return;
  }

  throw new AppError("invalid_token", "Reset token invalid", 400);
};

export const logout = async (input: {
  sessionId?: string | number | bigint;
  refreshToken?: string;
}) => {
  if (input.sessionId) {
    await prisma.sessions.updateMany({
      where: { id: toBigInt(input.sessionId) },
      data: { revoked_at: new Date() }
    });
    return;
  }

  if (input.refreshToken) {
    const tokenHash = buildTokenHash(input.refreshToken, "refresh");
    await prisma.sessions.updateMany({
      where: { token_hash: tokenHash },
      data: { revoked_at: new Date() }
    });
    return;
  }

  throw new AppError("bad_request", "Missing sessionId or refreshToken", 400);
};

export const getCurrentUser = async (userId: string | number | bigint) => {
  const user = await prisma.users.findUnique({
    where: { id: toBigInt(userId) },
    include: {
      school: {
        select: schoolSelect
      },
      user_roles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError("not_found", "User not found", 404);
  }

  return formatSchoolUser(user);
};
