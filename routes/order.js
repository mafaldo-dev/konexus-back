import { Router } from 'express';
import {
  createOrderSale,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  getCustomers,
  getOrderForEdit,
  updateOrder,
  getLastOrderNumber,
  cancelOrder
} from '../controllers/orders/orders.js';
import { authMiddleware } from '../middlewares/middleware.js';

const router = Router();

// Rotas existentes
router.post('/create', authMiddleware, createOrderSale);

router.get('/all', authMiddleware, getAllOrders);
router.get('/last-number', authMiddleware, getLastOrderNumber);

// ✅ CORREÇÃO: Colocar rotas específicas ANTES das rotas com parâmetros
router.get('/edit/:id', authMiddleware, getOrderForEdit);     // Esta vem PRIMEIRO
router.get('/customers/list', authMiddleware, getCustomers);

// Rotas com parâmetros vêm DEPOIS
router.get('/:id', authMiddleware, getOrderById);             // Esta vem DEPOIS

router.put('/:id', authMiddleware, updateOrder);
router.put('/:id/status', authMiddleware, updateOrderStatus);

router.patch('/:id/cancel', authMiddleware, cancelOrder);

router.delete('/:id', authMiddleware, deleteOrder);

export default router;