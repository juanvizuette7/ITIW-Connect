import { Router } from "express";
import { completeOnboarding, getOnboardingStatus } from "../controllers/onboarding.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const onboardingRouter = Router();

onboardingRouter.use(authenticateJWT, authorizeRoles("PROFESIONAL"));
onboardingRouter.get("/status", asyncHandler(getOnboardingStatus));
onboardingRouter.put("/complete", asyncHandler(completeOnboarding));

export default onboardingRouter;
