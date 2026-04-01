import { Router } from "express";
import {
  createNotification,
  getUnreadNotificationsCount,
  listMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../controllers/notification.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const notificationRouter = Router();

notificationRouter.use(authenticateJWT);
notificationRouter.post("/", asyncHandler(createNotification));
notificationRouter.get("/", asyncHandler(listMyNotifications));
notificationRouter.put("/read-all", asyncHandler(markAllNotificationsAsRead));
notificationRouter.get("/unread-count", asyncHandler(getUnreadNotificationsCount));
notificationRouter.put("/:id/read", asyncHandler(markNotificationAsRead));

export default notificationRouter;

