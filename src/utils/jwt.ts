import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../configs/env";
import type { AuthUser } from "../types/auth";

export type TokenScope = "school" | "platform";
type TokenKind = "access" | "refresh";
type TokenOptions = {
  scope?: TokenScope;
};

// Keep token lifetimes configurable. The old hard-coded 15-minute access token
// ignored the deployment settings and caused long-running pages to log users
// out even when a longer refresh policy had been configured.
const ACCESS_TTL = env.JWT_EXPIRES_IN as SignOptions["expiresIn"];
const REFRESH_TTL = env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"];

const getAccessSecret = (scope: TokenScope) =>
  scope === "platform" ? env.PLATFORM_JWT_SECRET : env.JWT_SECRET;
const getRefreshSecret = (scope: TokenScope) =>
  scope === "platform" ? env.PLATFORM_JWT_REFRESH_SECRET : env.JWT_REFRESH_SECRET;

const buildPayload = (payload: AuthUser, scope: TokenScope, type: TokenKind) => ({
  ...payload,
  auth_type: scope,
  token_type: type
});

export const signAccessToken = (
  payload: AuthUser,
  options: TokenOptions = {}
) => {
  const scope = options.scope ?? "school";
  return jwt.sign(buildPayload(payload, scope, "access"), getAccessSecret(scope), {
    expiresIn: ACCESS_TTL
  });
};

export const signRefreshToken = (
  payload: AuthUser,
  options: TokenOptions = {}
) => {
  const scope = options.scope ?? "school";
  return jwt.sign(buildPayload(payload, scope, "refresh"), getRefreshSecret(scope), {
    expiresIn: REFRESH_TTL
  });
};

export const verifyAccessToken = (
  token: string,
  options: TokenOptions = {}
): AuthUser => {
  const scope = options.scope ?? "school";
  return jwt.verify(token, getAccessSecret(scope)) as AuthUser;
};

export const verifyRefreshToken = (
  token: string,
  options: TokenOptions = {}
): AuthUser => {
  const scope = options.scope ?? "school";
  return jwt.verify(token, getRefreshSecret(scope)) as AuthUser;
};
