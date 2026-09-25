import { Router } from 'express';
import { PerfumeController } from './perfume.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { resourcePermission } from '../../middleware/permission.middleware';

const router = Router();
const controller = new PerfumeController();
const perm = resourcePermission('parfum');

router.get('/', optionalAuthMiddleware, controller.getPerfumes);
router.get('/:id', optionalAuthMiddleware, controller.getPerfumeById);
router.post('/', authMiddleware, perm.create, controller.createPerfume);
router.put('/:id', authMiddleware, perm.update, controller.updatePerfume);
router.delete('/:id', authMiddleware, perm.delete, controller.deletePerfume);

export default router;
