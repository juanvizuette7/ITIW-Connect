import { Router } from "express";
import {
  confirmJobCompletion,
  createOrConfirmEscrowPayment,
  getJobDetail,
  listMyJobs,
} from "../controllers/job.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const jobRouter = Router();

jobRouter.post("/:jobId/pay", authenticateJWT, authorizeRoles("CLIENTE"), asyncHandler(createOrConfirmEscrowPayment));
jobRouter.post("/:jobId/confirm", authenticateJWT, authorizeRoles("CLIENTE"), asyncHandler(confirmJobCompletion));
jobRouter.get("/", authenticateJWT, asyncHandler(listMyJobs));
jobRouter.get("/:jobId", authenticateJWT, asyncHandler(getJobDetail));

export default jobRouter;
