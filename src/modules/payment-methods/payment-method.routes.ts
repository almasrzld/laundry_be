import { Router } from 'express';
import { PaymentMethodController } from './payment-method.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { resourcePermission } from '../../middleware/permission.middleware';

const router = Router();
const controller = new PaymentMethodController();
const perm = resourcePermission('metode-pembayaran');

router.get('/', optionalAuthMiddleware, controller.getPaymentMethods);
router.get('/:id', optionalAuthMiddleware, controller.getPaymentMethodById);
router.post('/', authMiddleware, perm.create, controller.createPaymentMethod);
router.put('/:id', authMiddleware, perm.update, controller.updatePaymentMethod);
router.delete('/:id', authMiddleware, perm.delete, controller.deletePaymentMethod);

export default router;
