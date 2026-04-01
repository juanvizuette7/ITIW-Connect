import { Router } from "express";
import { getPaymentHistory } from "../controllers/payment.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const paymentRouter = Router();

paymentRouter.get("/history", authenticateJWT, asyncHandler(getPaymentHistory));

export default paymentRouter;
