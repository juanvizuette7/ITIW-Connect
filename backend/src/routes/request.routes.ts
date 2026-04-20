import { Router } from "express";
import {
  acceptQuote,
  cancelClientRequest,
  createQuote,
  createServiceRequest,
  getAvailableRequests,
  getClientRequests,
  getProfessionalQuotes,
  getRequestDetail,
} from "../controllers/request.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const requestRouter = Router();

requestRouter.post("/", authenticateJWT, authorizeRoles("CLIENTE"), asyncHandler(createServiceRequest));
requestRouter.get("/available", authenticateJWT, authorizeRoles("PROFESIONAL"), asyncHandler(getAvailableRequests));
requestRouter.get("/my-quotes", authenticateJWT, authorizeRoles("PROFESIONAL"), asyncHandler(getProfessionalQuotes));
requestRouter.get("/", authenticateJWT, authorizeRoles("CLIENTE"), asyncHandler(getClientRequests));
requestRouter.put("/:id/cancel", authenticateJWT, authorizeRoles("CLIENTE"), asyncHandler(cancelClientRequest));
requestRouter.get("/:id", authenticateJWT, asyncHandler(getRequestDetail));
requestRouter.post(
  "/:id/quotes",
  authenticateJWT,
  authorizeRoles("PROFESIONAL"),
  asyncHandler(createQuote),
);
requestRouter.put(
  "/:id/quotes/:quoteId/accept",
  authenticateJWT,
  authorizeRoles("CLIENTE"),
  asyncHandler(acceptQuote),
);

export default requestRouter;
