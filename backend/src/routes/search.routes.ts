import { Router } from "express";
import { searchProfessionals } from "../controllers/search.controller";
import { asyncHandler } from "../utils/asyncHandler";

const searchRouter = Router();

searchRouter.get("/", asyncHandler(searchProfessionals));

export default searchRouter;

