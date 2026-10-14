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
router.post('/:id/rating', authMiddleware, controller.submitRating);
router.post('/:id/review', authMiddleware, controller.submitRating);
router.post('/:id/apply-promo', authMiddleware, controller.applyPromo);
router.post('/:id/remove-promo', authMiddleware, controller.removePromo);

export default router;
