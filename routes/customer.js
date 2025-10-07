import { Router } from "express"
import { authMiddleware } from "../middlewares/middleware.js"
import { deleteCustomer, handleAllCustomers, insertCustomer, updateCustomerById } from "../controllers/customer/customer.js"

const route = Router()

route.post("/create", authMiddleware, insertCustomer)
route.get("/all", authMiddleware, handleAllCustomers)
route.put("/:id", authMiddleware, updateCustomerById)
route.delete("/:id", authMiddleware, deleteCustomer)

export default route