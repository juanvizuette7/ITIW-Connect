import { Router } from "express";
import { getMyProfile, updateClientProfile, updateProfessionalProfile } from "../controllers/profile.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const profileRouter = Router();

profileRouter.get("/me", authenticateJWT, asyncHandler(getMyProfile));
profileRouter.put("/client", authenticateJWT, authorizeRoles("CLIENTE"), asyncHandler(updateClientProfile));
profileRouter.put(
  "/professional",
  authenticateJWT,
  authorizeRoles("PROFESIONAL"),
  asyncHandler(updateProfessionalProfile),
);

export default profileRouter;
