import { Router } from 'express';
import { IconController } from './icon.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { resourcePermission } from '../../middleware/permission.middleware';

const router = Router();
const controller = new IconController();
const perm = resourcePermission('icon');

// GET /api/v1/icons (atau /api/v1/master/icons)
router.get('/', optionalAuthMiddleware, controller.getIcons);
router.get('/:id', optionalAuthMiddleware, controller.getIconById);
router.post('/', authMiddleware, perm.create, controller.createIcon);
router.put('/:id', authMiddleware, perm.update, controller.updateIcon);
router.delete('/:id', authMiddleware, perm.delete, controller.deleteIcon);

export default router;
