import type { Request, Response } from "express";
import { successResponse } from "../helpers/response";
import * as authService from "../services/auth.service";
import { AppError } from "../middleware/errorHandler";
import { env } from "../configs/env";

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.loginSchoolUser(email, password);

  res.json(
    successResponse({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })
  );
};

export const platformLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.loginPlatformUser(email, password);

  res.json(
    successResponse({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })
  );
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshTokens(refreshToken);

  res.json(
    successResponse({
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })
  );
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  const resetUrl = await authService.forgotPassword(email, {
    includeResetUrl: env.NODE_ENV !== "production"
  });

  res.json(
    successResponse({
      message: "If the account exists, a reset link was sent.",
      ...(resetUrl ? { resetUrl } : {})
    })
  );
};

export const staffOnboarding = async (req: Request, res: Response) => {
  const { email } = req.body;
  await authService.sendStaffOnboarding(email);

  res.json(successResponse({ message: "Staff password setup email sent." }));
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token, newPassword);

  res.json(successResponse({ message: "Password reset successful." }));
};

export const logout = async (req: Request, res: Response) => {
  const { sessionId, refreshToken } = req.body ?? {};
  await authService.logout({ sessionId, refreshToken });

  res.json(successResponse({ message: "Logged out" }));
};

export const me = async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new AppError("unauthorized", "Missing user context", 401);
  }

  const user = await authService.getCurrentUser(req.user.id);
  res.json(successResponse(user));
};
