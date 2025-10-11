import { Router } from "express";

import { createCompanyWhitAdmin } from "../controllers/administrator/administrator.js";

const router = Router()

router.post("/create-company", createCompanyWhitAdmin)

export default router