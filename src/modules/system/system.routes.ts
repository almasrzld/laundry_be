import { Router } from 'express';
import { SystemController } from './system.controller';

const router = Router();
const controller = new SystemController();

// User Management (4 tabs support: User Aktif, User Keluar, Role, Akses)
router.get('/users', controller.getUsers);
router.get('/users/:id', controller.getUserById);
router.post('/users', controller.createUser);
router.put('/users/:id', controller.updateUser);
router.delete('/users/:id', controller.softDeleteUser);
router.post('/users/:id/restore', controller.restoreUser);
router.post('/users/:id/topup', controller.topupUserBalance);

// Withdrawals Management (Admin)
router.get('/withdrawals', controller.getWithdrawalRequests);
router.put('/withdrawals/:id/status', controller.updateWithdrawalStatus);

// Topup Requests Management (Admin)
router.get('/topups', controller.getTopupRequests);
router.put('/topups/:id/status', controller.updateTopupStatus);
router.patch('/topups/:id/status', controller.updateTopupStatus);

// Roles
router.get('/roles', controller.getRoles);
router.post('/roles', controller.createRole);
router.put('/roles/:id', controller.updateRole);
router.delete('/roles/:id', controller.softDeleteRole);

// Permissions & Access Matrix
router.get('/permissions', controller.getPermissions);
router.post('/permissions', controller.createPermission);
router.put('/permissions/:id', controller.updatePermission);
router.delete('/permissions/:id', controller.deletePermission);
router.get('/matrix', controller.getRolePermissionsMatrix);
router.put('/roles/:id/permissions', controller.updateRolePermissions);

// Menus & Dynamic Sidebar (2 tabs support: Daftar Menu, Sidebar Management)
router.get('/menus', controller.getMenus);
router.get('/menus/sidebar', controller.getSidebarMenus);
router.post('/menus', controller.createMenu);
router.put('/menus/reorder', controller.reorderMenus);
router.put('/menus/:id', controller.updateMenu);
router.delete('/menus/:id', controller.softDeleteMenu);

export default router;
