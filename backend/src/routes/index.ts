import { Router } from "express";
import authRouter from "./auth.routes";
import adminRouter from "./admin.routes";
import aiRouter from "./ai.routes";
import categoryRouter from "./category.routes";
import disputeRouter from "./dispute.routes";
import jobRouter from "./job.routes";
import messageRouter from "./message.routes";
import notificationRouter from "./notification.routes";
import npsRouter from "./nps.routes";
import onboardingRouter from "./onboarding.routes";
import paymentRouter from "./payment.routes";
import portfolioRouter from "./portfolio.routes";
import profileRouter from "./profile.routes";
import reviewRouter from "./review.routes";
import requestRouter from "./request.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/ai", aiRouter);
router.use("/profile", profileRouter);
router.use("/categories", categoryRouter);
router.use("/requests", requestRouter);
router.use("/jobs", jobRouter);
router.use("/messages", messageRouter);
router.use("/reviews", reviewRouter);
router.use("/payments", paymentRouter);
router.use("/notifications", notificationRouter);
router.use("/disputes", disputeRouter);
router.use("/portfolio", portfolioRouter);
router.use("/onboarding", onboardingRouter);
router.use("/nps", npsRouter);

export default router;
