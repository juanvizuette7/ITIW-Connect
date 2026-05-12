import { Router } from "express";
import { retrainAi } from "../controllers/ai.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const aiRouter = Router();

aiRouter.get("/retrain", authenticateJWT, authorizeRoles("ADMIN"), asyncHandler(retrainAi));

export default aiRouter;
