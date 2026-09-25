import { Router } from 'express';
import { OrderController } from './order.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const controller = new OrderController();

router.get('/', optionalAuthMiddleware, controller.getOrders);
router.get('/:id', optionalAuthMiddleware, controller.getOrderById);
router.post('/', authMiddleware, controller.createOrder);
router.post('/create', authMiddleware, controller.createOrder);
router.put('/:id', authMiddleware, controller.updateOrder);
router.patch('/:id', authMiddleware, controller.updateOrder);
router.patch('/:id/status', authMiddleware, controller.updateStatus);
router.put('/:id/status', authMiddleware, controller.updateStatus);

export default router;
