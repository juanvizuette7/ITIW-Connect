import { Router } from "express";
import { getPaymentHistory, getPaymentReceipt } from "../controllers/payment.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const paymentRouter = Router();

paymentRouter.get("/history", authenticateJWT, asyncHandler(getPaymentHistory));
paymentRouter.get("/:paymentId/receipt", authenticateJWT, asyncHandler(getPaymentReceipt));

export default paymentRouter;
