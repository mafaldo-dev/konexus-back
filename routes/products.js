// routes/products.js - ADICIONE ESTA ROTA
import { Router } from 'express';
import { 
  insertProduct, 
  handleAllProducts, 
  updateProduct, 
  deleteProduct,
  updateProductStock, // ✅ IMPORTE ESTA FUNÇÃO
  getProductById 
} from '../controllers/products/products.js';
import { authMiddleware } from '../middlewares/middleware.js';

const router = Router();

router.post('/create', authMiddleware, insertProduct);
router.get('/all', authMiddleware, handleAllProducts);
router.get('/:id', authMiddleware, getProductById);
router.put('/:id', authMiddleware, updateProduct);
router.put('/:id/stock', authMiddleware, updateProductStock); // ✅ NOVA ROTA
router.delete('/:id', authMiddleware, deleteProduct);

export default router;