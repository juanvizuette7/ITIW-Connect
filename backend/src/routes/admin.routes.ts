import { Router } from "express";
import {
  approveProfessional,
  deactivateProfessional,
  getAdminNps,
  getAdminStats,
  listAdminProfessionals,
  rejectProfessional,
} from "../controllers/admin.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const adminRouter = Router();

adminRouter.use(authenticateJWT, authorizeRoles("ADMIN"));

adminRouter.get("/professionals", asyncHandler(listAdminProfessionals));
adminRouter.put("/professionals/:id/approve", asyncHandler(approveProfessional));
adminRouter.put("/professionals/:id/reject", asyncHandler(rejectProfessional));
adminRouter.put("/professionals/:id/deactivate", asyncHandler(deactivateProfessional));
adminRouter.get("/stats", asyncHandler(getAdminStats));
adminRouter.get("/nps", asyncHandler(getAdminNps));

export default adminRouter;
