import { Router } from "express";
import { listCategories } from "../controllers/category.controller";
import { asyncHandler } from "../utils/asyncHandler";

const categoryRouter = Router();

categoryRouter.get("/", asyncHandler(listCategories));

export default categoryRouter;
