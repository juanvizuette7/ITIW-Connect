import { Router } from "express";
import {
  deletePortfolioPhoto,
  listPortfolioPhotos,
  uploadPortfolioPhoto,
} from "../controllers/portfolio.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const portfolioRouter = Router();

portfolioRouter.post("/", authenticateJWT, authorizeRoles("PROFESIONAL"), asyncHandler(uploadPortfolioPhoto));
portfolioRouter.get("/:professionalId", asyncHandler(listPortfolioPhotos));
portfolioRouter.delete("/:photoId", authenticateJWT, authorizeRoles("PROFESIONAL"), asyncHandler(deletePortfolioPhoto));

export default portfolioRouter;
