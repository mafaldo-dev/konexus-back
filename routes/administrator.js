import { Router } from "express";
import { authMiddleware } from "../middlewares/middleware.js";
import { 
  createCompanyWithAdmin, 
  getCompany, 
  updateCompany 
} from "../controllers/administrator/administrator.js";
import { uploadLogo, deleteLogo } from "../controllers/administrator/uploadController.js";
import upload from "../config/multer.js"

const router = Router();

// Rotas existentes
router.post("/create-company", createCompanyWithAdmin);
router.get('/companie/:companyId', authMiddleware, getCompany);

router.patch('/companie/:companyId', authMiddleware, upload.single('logo'),updateCompany);

// ✅ Novas rotas de upload
router.post('/upload-logo', authMiddleware, uploadLogo);
router.delete('/logo/:filename', authMiddleware, deleteLogo);

export default router;