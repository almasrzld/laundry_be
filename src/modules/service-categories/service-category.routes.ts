import { Router } from 'express';
import { ServiceCategoryController } from './service-category.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { resourcePermission } from '../../middleware/permission.middleware';

const router = Router();
const controller = new ServiceCategoryController();
const perm = resourcePermission('kategori-layanan');

router.get('/', optionalAuthMiddleware, controller.getCategories);
router.get('/:id', optionalAuthMiddleware, controller.getCategoryById);
router.post('/', authMiddleware, perm.create, controller.createCategory);
router.put('/:id', authMiddleware, perm.update, controller.updateCategory);
router.delete('/:id', authMiddleware, perm.delete, controller.deleteCategory);

export default router;
