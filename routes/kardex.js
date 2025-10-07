// routes/kardex.js
import { Router } from 'express';
import {
  getKardexByProduct,
  getKardexByOrder,
  createKardexMovement
} from '../controllers/kardex/kardex.js';
import { authMiddleware } from '../middlewares/middleware.js';

const router = Router();

// Rotas do Kardex
router.post('/create', authMiddleware, createKardexMovement);
router.get('/products/:productId', authMiddleware, getKardexByProduct); // ✅ CORRIGIDO
router.get('/orders/:orderId', authMiddleware, getKardexByOrder); // ✅ CORRIGIDO

export default router;