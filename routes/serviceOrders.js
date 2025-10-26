import { Router } from 'express'
import { authMiddleware } from '../middlewares/middleware.js'
import { 
    createOrderService, 
    getAllOrderServices, 
    getOrderServiceByNumber, 
    updateOrderService, 
    deleteOrderService } 
from '../controllers/serviceOrders/os.js'


const router = Router()

router.post('/create', authMiddleware, createOrderService)

router.get('/all', authMiddleware, getAllOrderServices)
router.get('/:id', authMiddleware, getOrderServiceByNumber)

router.patch('/:id/os', authMiddleware, updateOrderService)

router.delete('/:id', authMiddleware, deleteOrderService)

export default router