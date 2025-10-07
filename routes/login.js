import { Router } from "express"
import { login, employeeLogin } from "../controllers/login/login.js"

const router = Router()

router.post("/auth", login)
router.post("/auth-employee", employeeLogin)


export default router