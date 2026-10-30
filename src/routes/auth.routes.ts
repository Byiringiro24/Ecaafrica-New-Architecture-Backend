/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and session endpoints
 *
 * /auth/login:
 *   post:
 *     summary: Login school user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Success }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       500: { description: Server error }
 *
 * /auth/platform/login:
 *   post:
 *     summary: Login platform user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Success }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       500: { description: Server error }
 *
 * /auth/logout:
 *   post:
 *     summary: Logout current session
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Success }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       500: { description: Server error }
 *
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Success }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       500: { description: Server error }
 *
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Success }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       500: { description: Server error }
 *
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Success }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       500: { description: Server error }
 *
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: Success }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       500: { description: Server error }
 */
import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { asyncWrapper } from "../helpers/asyncWrapper";
import { verifyToken } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema
} from "../validators/auth.validator";

export const authRoutes = Router();

authRoutes.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      service: "ecareafrica-auth",
      version: "v1",
      endpoints: [
        "POST /api/v1/auth/login",
        "POST /api/v1/auth/platform/login",
        "POST /api/v1/auth/logout",
        "POST /api/v1/auth/refresh",
        "POST /api/v1/auth/forgot-password",
        "POST /api/v1/auth/reset-password",
        "GET /api/v1/auth/me"
      ]
    }
  });
});

authRoutes.post(
  "/login",
  validate(loginSchema),
  asyncWrapper(authController.login)
);

authRoutes.post(
  "/platform/login",
  validate(loginSchema),
  asyncWrapper(authController.platformLogin)
);

authRoutes.post("/logout", asyncWrapper(authController.logout));

authRoutes.post(
  "/refresh",
  validate(refreshTokenSchema),
  asyncWrapper(authController.refresh)
);

authRoutes.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  asyncWrapper(authController.forgotPassword)
);

authRoutes.post(
  "/staff-onboarding",
  verifyToken,
  validate(forgotPasswordSchema),
  asyncWrapper(authController.staffOnboarding)
);

authRoutes.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncWrapper(authController.resetPassword)
);

authRoutes.get("/me", verifyToken, asyncWrapper(authController.me));
