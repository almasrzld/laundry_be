import { Router } from 'express';
import { PromoController } from './promo.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';

const router = Router();
const controller = new PromoController();

router.get('/', authMiddleware, requirePermission('promo.index'), controller.getPromos);
router.get('/generate-code', authMiddleware, requirePermission('promo.index'), controller.generateCode);
router.get('/:id', authMiddleware, requirePermission('promo.index'), controller.getPromoById);
router.post('/', authMiddleware, requirePermission('promo.create'), controller.createPromo);
router.put('/:id', authMiddleware, requirePermission('promo.edit'), controller.updatePromo);
router.delete('/:id', authMiddleware, requirePermission('promo.delete'), controller.deletePromo);

export default router;
