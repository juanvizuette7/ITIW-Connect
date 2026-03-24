import { Router } from "express";
import { getMessages, sendMessage } from "../controllers/message.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const messageRouter = Router();

messageRouter.post("/:requestId", authenticateJWT, asyncHandler(sendMessage));
messageRouter.get("/:requestId", authenticateJWT, asyncHandler(getMessages));

export default messageRouter;
