import { Router } from "express";
import { authMiddleware } from "../middlewares/middleware.js";
import { createCompanyWithAdmin } from "../controllers/administrator/administrator.js";

const router = Router()

router.post("/", createCompanyWithAdmin)

export default router