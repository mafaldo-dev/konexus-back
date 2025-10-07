import { Router } from "express"
import { handleAllSuppliers, insertSupplier,updateSupplier, deleteSupplier  } from "../controllers/suppliers/supplier.js"
import { authMiddleware } from "../middlewares/middleware.js"

const router = Router()

router.post("/create", authMiddleware, insertSupplier)
router.get("/all", authMiddleware, handleAllSuppliers)
router.put("/:id", authMiddleware, updateSupplier)
router.delete("/:id", authMiddleware, deleteSupplier)

export default router