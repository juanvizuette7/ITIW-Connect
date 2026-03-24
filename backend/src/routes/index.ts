import { Router } from "express";
import authRouter from "./auth.routes";
import categoryRouter from "./category.routes";
import jobRouter from "./job.routes";
import messageRouter from "./message.routes";
import profileRouter from "./profile.routes";
import requestRouter from "./request.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/categories", categoryRouter);
router.use("/requests", requestRouter);
router.use("/jobs", jobRouter);
router.use("/messages", messageRouter);

export default router;
