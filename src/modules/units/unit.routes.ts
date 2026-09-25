import { Router } from 'express';
import { UnitController } from './unit.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { resourcePermission } from '../../middleware/permission.middleware';

const router = Router();
const controller = new UnitController();
const perm = resourcePermission('satuan');

router.get('/', optionalAuthMiddleware, controller.getUnits);
router.get('/:id', optionalAuthMiddleware, controller.getUnitById);
router.post('/', authMiddleware, perm.create, controller.createUnit);
router.put('/:id', authMiddleware, perm.update, controller.updateUnit);
router.delete('/:id', authMiddleware, perm.delete, controller.deleteUnit);

export default router;
