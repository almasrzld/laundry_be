import { Router } from 'express';
import { OrderStatusController } from './order-status.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { resourcePermission } from '../../middleware/permission.middleware';

const router = Router();
const controller = new OrderStatusController();
const perm = resourcePermission('status-cucian');

router.get('/', optionalAuthMiddleware, controller.getOrderStatuses);
router.get('/:id', optionalAuthMiddleware, controller.getOrderStatusById);
router.post('/', authMiddleware, perm.create, controller.createOrderStatus);
router.put('/:id', authMiddleware, perm.update, controller.updateOrderStatus);
router.delete('/:id', authMiddleware, perm.delete, controller.deleteOrderStatus);

export default router;
