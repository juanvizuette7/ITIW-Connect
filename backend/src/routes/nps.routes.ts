import { Router } from "express";
import { submitNps } from "../controllers/nps.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const npsRouter = Router();

npsRouter.post("/:jobId", authenticateJWT, asyncHandler(submitNps));

export default npsRouter;
