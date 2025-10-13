import { authMiddleware } from "../middlewares/middleware.js"
import { Router } from "express"

import { purchaseOrderBuy, getAllPurchaseOrders, updatePurchaseOrder, getPurchaseOrderByNumber, deletePurchaseOrder } from "../controllers/purchase-orders/purchase.js"

const router =  Router()

router.post("/create", authMiddleware, purchaseOrderBuy)

router.get("/all", authMiddleware, getAllPurchaseOrders)
router.get("/:orderNumber", authMiddleware, getPurchaseOrderByNumber)

router.put("/:id", authMiddleware, updatePurchaseOrder)

router.delete("/:id", authMiddleware, deletePurchaseOrder)


export default router