import { Router } from "express";
import { authMiddleware } from "../middlewares/middleware.js";
import { createEmployeeAccess, deleteEmployee, handleAllEmployees, updateEmployeeById, updateEmployeeStatus, getEmployeeStatus } from "../controllers/employee/employee.js";
import { employeeLogin } from "../controllers/login/login.js"

const router = Router()

router.post("/auth-employee", employeeLogin)
router.post("/create", authMiddleware, createEmployeeAccess)
router.get("/all", authMiddleware, handleAllEmployees)
router.put("/:id", authMiddleware, updateEmployeeById)
router.delete("/:id", authMiddleware, deleteEmployee)

router.put('/:id/status', authMiddleware , updateEmployeeStatus);

router.get('/:id/status', authMiddleware, getEmployeeStatus);

export default router