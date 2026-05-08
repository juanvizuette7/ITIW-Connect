import { Router } from "express";
import {
  forgotPassword,
  getGoogleOauthStatus,
  login,
  register,
  resendOtp,
  resetPassword,
  verifyOtp,
} from "../controllers/auth.controller";
import { authRateLimiter, loginRateLimiter } from "../middlewares/rate-limit.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  getPassportGoogleAuthMiddleware,
  isGoogleOauthConfigured,
  runGoogleAuthCallback,
} from "../config/passport";
import { env } from "../config/env";

const authRouter = Router();
authRouter.use(authRateLimiter);

authRouter.post("/register", asyncHandler(register));
authRouter.post("/login", loginRateLimiter, asyncHandler(login));
authRouter.post("/verify-otp", asyncHandler(verifyOtp));
authRouter.post("/resend-otp", asyncHandler(resendOtp));
authRouter.post("/forgot-password", asyncHandler(forgotPassword));
authRouter.post("/reset-password", asyncHandler(resetPassword));
authRouter.get("/google/status", asyncHandler(getGoogleOauthStatus));
authRouter.get("/google", (req, res, next) => {
  if (!isGoogleOauthConfigured()) {
    return res.status(503).json({ message: "OAuth en configuracion." });
  }
  return getPassportGoogleAuthMiddleware()(req, res, next);
});
authRouter.get("/google/callback", (req, res, next) => {
  if (!isGoogleOauthConfigured()) {
    return res.redirect(`${env.frontendUrl}/auth/login?oauthError=configuracion`);
  }
  return runGoogleAuthCallback(req, res, next);
});

export default authRouter;
