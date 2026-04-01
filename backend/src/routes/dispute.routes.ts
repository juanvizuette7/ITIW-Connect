import { Router } from "express";
import {
  getDisputeDetail,
  listMyDisputes,
  openDispute,
  resolveDispute,
} from "../controllers/dispute.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const disputeRouter = Router();

disputeRouter.use(authenticateJWT);
disputeRouter.post("/:jobId", asyncHandler(openDispute));
disputeRouter.get("/", asyncHandler(listMyDisputes));
disputeRouter.get("/:id", asyncHandler(getDisputeDetail));
disputeRouter.put("/:id/resolve", authorizeRoles("ADMIN"), asyncHandler(resolveDispute));

export default disputeRouter;

