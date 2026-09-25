import { Router } from 'express';
import { StorageShelfController } from './storage-shelf.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { resourcePermission } from '../../middleware/permission.middleware';

const router = Router();
const controller = new StorageShelfController();
const perm = resourcePermission('rak');

router.get('/', optionalAuthMiddleware, controller.getShelves);
router.get('/next-code', optionalAuthMiddleware, controller.getNextCode);
router.get('/:id', optionalAuthMiddleware, controller.getShelfById);
router.post('/', authMiddleware, perm.create, controller.createShelf);
router.put('/:id', authMiddleware, perm.update, controller.updateShelf);
router.delete('/:id', authMiddleware, perm.delete, controller.deleteShelf);

export default router;
