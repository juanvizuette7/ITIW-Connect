import { Router } from "express";
import {
  listProfessionalReviews,
  reviewClient,
  reviewProfessional,
} from "../controllers/review.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const reviewRouter = Router();

reviewRouter.post(
  "/:jobId/professional",
  authenticateJWT,
  authorizeRoles("CLIENTE"),
  asyncHandler(reviewProfessional),
);
reviewRouter.post(
  "/:jobId/client",
  authenticateJWT,
  authorizeRoles("PROFESIONAL"),
  asyncHandler(reviewClient),
);
reviewRouter.get("/professional/:professionalId", asyncHandler(listProfessionalReviews));

export default reviewRouter;
