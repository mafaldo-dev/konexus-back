import { authMiddleware } from "../middlewares/middleware.js"
import { Router } from "express"

import { purchaseOrderBuy, getAllPurchaseOrders, updatePurchaseOrder, getPurchaseOrderById, deletePurchaseOrder } from "../controllers/purchase-orders/purchase.js"

const router =  Router()

router.post("/create", (req, res, next) => {
  console.log("🎯 ROTA /create ATINGIDA!", new Date().toISOString());
  console.log("📦 Body recebido:", req.body);
  next();
}, authMiddleware, purchaseOrderBuy)

router.get("/all", authMiddleware,getAllPurchaseOrders)
router.get("/order/:id", authMiddleware, getPurchaseOrderById)

router.put("/order/:id", authMiddleware, updatePurchaseOrder)

router.delete("/order/:id", authMiddleware, deletePurchaseOrder)


export default router