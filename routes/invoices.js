import { Router } from "express";
import { authMiddleware } from "../middlewares/middleware.js"
import { createInvoice, getInvoicesByOrder } from "../controllers/invoices/invoices.js";
const router = Router()

router.post("/create", authMiddleware, createInvoice)

router.get("/in/:order_id", getInvoicesByOrder);

export default router