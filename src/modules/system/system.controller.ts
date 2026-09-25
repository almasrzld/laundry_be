import { Request, Response } from "express";
import { SystemService } from "./system.service";
import { sendSuccess, sendError } from "../../utils/response.util";
import { CryptoUtil } from "../../utils/crypto.util";
import { UserCodeUtil } from "../../utils/user-code.util";

const getPicId = (req: Request): number | null => {
  return UserCodeUtil.resolveUserCode((req as any).user);
};

export class SystemController {
  private service = new SystemService();

  // Users
  getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const tabParam = (req.query.tab || req.query.status) as string;
      const tab = (["active", "inactive", "deleted", "all"].includes(tabParam)
        ? tabParam
        : "active") as "active" | "inactive" | "deleted" | "all";
      const search = req.query.search as string;
      const role = req.query.role as string;
      const users = await this.service.getUsers(tab, search, role);
      sendSuccess(res, users, `Data pengguna (${tab}) berhasil diambil`);
    } catch (err: any) {
      sendError(res, err.message || "Gagal mengambil data pengguna", 500);
    }
  };

  getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.service.getUserById(req.params.id);
      if (!user) {
        sendError(res, "Pengguna tidak ditemukan", 404);
        return;
      }
      sendSuccess(res, user, "Detail pengguna berhasil diambil");
    } catch (err: any) {
      sendError(res, err.message || "Gagal mengambil detail pengguna", 500);
    }
  };

  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      if (!picId) {
        sendError(res, "Sesi login tidak terdeteksi. Silakan login terlebih dahulu.", 401);
        return;
      }
      const user = await this.service.createUser(req.body, picId);
      sendSuccess(res, user, "Pengguna baru berhasil ditambahkan", 201);
    } catch (err: any) {
      sendError(res, err.message || "Gagal menambahkan pengguna", 500);
    }
  };

  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      const user = await this.service.updateUser(req.params.id, req.body, picId);
      sendSuccess(res, user, "Data pengguna berhasil diperbarui");
    } catch (err: any) {
      sendError(res, err.message || "Gagal memperbarui pengguna", 500);
    }
  };

  softDeleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      await this.service.softDeleteUser(req.params.id, picId);
      sendSuccess(
        res,
        { id: req.params.id },
        "Pengguna berhasil dinonaktifkan (User Keluar)",
      );
    } catch (err: any) {
      sendError(res, err.message || "Gagal menonaktifkan pengguna", 500);
    }
  };

  restoreUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      await this.service.restoreUser(req.params.id, picId);
      sendSuccess(
        res,
        { id: req.params.id },
        "Pengguna berhasil dipulihkan (Kembali ke User Aktif)",
      );
    } catch (err: any) {
      sendError(res, err.message || "Gagal memulihkan pengguna", 500);
    }
  };

  // Roles
  getRoles = async (req: Request, res: Response): Promise<void> => {
    try {
      const roles = await this.service.getRoles();
      sendSuccess(res, roles, "Daftar role berhasil diambil");
    } catch (err: any) {
      sendError(res, err.message || "Gagal mengambil data role", 500);
    }
  };

  createRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      if (!picId) {
        sendError(res, "Sesi login tidak terdeteksi. Silakan login terlebih dahulu.", 401);
        return;
      }
      await this.service.createRole(req.body, picId);
      sendSuccess(res, req.body, "Role baru berhasil ditambahkan", 201);
    } catch (err: any) {
      sendError(res, err.message || "Gagal menambahkan role", 500);
    }
  };

  updateRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      await this.service.updateRole(req.params.id, req.body, picId);
      sendSuccess(res, req.body, "Data role berhasil diperbarui");
    } catch (err: any) {
      sendError(res, err.message || "Gagal memperbarui role", 500);
    }
  };

  softDeleteRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      await this.service.softDeleteRole(req.params.id, picId);
      sendSuccess(res, { id: req.params.id }, "Role berhasil dihapus");
    } catch (err: any) {
      sendError(res, err.message || "Gagal menghapus role", 500);
    }
  };

  // Permissions & Access Matrix
  getPermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const perms = await this.service.getPermissions();
      sendSuccess(res, perms, "Daftar hak akses berhasil diambil");
    } catch (err: any) {
      sendError(res, err.message || "Gagal mengambil hak akses", 500);
    }
  };

  createPermission = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      if (!picId) {
        sendError(res, "Sesi login tidak terdeteksi. Silakan login terlebih dahulu.", 401);
        return;
      }
      await this.service.createPermission(req.body, picId);
      sendSuccess(res, null, "Data akses berhasil ditambahkan", 201);
    } catch (err: any) {
      sendError(res, err.message || "Gagal menambahkan data akses", 400);
    }
  };

  updatePermission = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      await this.service.updatePermission(req.params.id, req.body, picId);
      sendSuccess(res, null, "Data akses berhasil diperbarui");
    } catch (err: any) {
      sendError(res, err.message || "Gagal memperbarui data akses", 400);
    }
  };

  deletePermission = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      await this.service.deletePermission(req.params.id, picId);
      sendSuccess(res, null, "Data akses berhasil dihapus");
    } catch (err: any) {
      sendError(res, err.message || "Gagal menghapus data akses", 400);
    }
  };

  getRolePermissionsMatrix = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const matrix = await this.service.getRolePermissionsMatrix();
      sendSuccess(res, matrix, "Matriks hak akses role berhasil diambil");
    } catch (err: any) {
      sendError(res, err.message || "Gagal mengambil matriks hak akses", 500);
    }
  };

  updateRolePermissions = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { permission_ids } = req.body;
      const picId = getPicId(req);
      await this.service.updateRolePermissions(
        req.params.id,
        permission_ids || [],
        picId,
      );
      sendSuccess(
        res,
        { role_id: req.params.id, permission_ids },
        "Hak akses role berhasil disimpan",
      );
    } catch (err: any) {
      sendError(res, err.message || "Gagal memperbarui hak akses role", 500);
    }
  };

  // Menus & Dynamic Sidebar
  getMenus = async (req: Request, res: Response): Promise<void> => {
    try {
      const menus = await this.service.getMenus();
      sendSuccess(res, menus, "Daftar seluruh menu berhasil diambil");
    } catch (err: any) {
      sendError(res, err.message || "Gagal mengambil daftar menu", 500);
    }
  };

  getSidebarMenus = async (req: Request, res: Response): Promise<void> => {
    try {
      const role = (req.query.role as string) || (req as any).user?.role_code || (req as any).user?.role || "";
      if (!role) {
        sendSuccess(res, [], "Role tidak ditentukan");
        return;
      }
      const menus = await this.service.getSidebarMenusByRole(role);
      sendSuccess(
        res,
        menus,
        `Daftar sidebar dinamis untuk role [${role}] berhasil diambil`,
      );
    } catch (err: any) {
      sendError(res, err.message || "Gagal mengambil menu sidebar", 500);
    }
  };

  createMenu = async (req: Request, res: Response): Promise<void> => {
    try {
      const { allowed_roles, ...menuData } = req.body;
      const picId = getPicId(req);
      if (!picId) {
        sendError(res, "Sesi login tidak terdeteksi. Silakan login terlebih dahulu.", 401);
        return;
      }
      await this.service.createMenu(menuData, allowed_roles, picId);
      sendSuccess(res, req.body, "Menu baru berhasil ditambahkan", 201);
    } catch (err: any) {
      sendError(res, err.message || "Gagal menambahkan menu", 500);
    }
  };

  updateMenu = async (req: Request, res: Response): Promise<void> => {
    try {
      const { allowed_roles, ...menuData } = req.body;
      const picId = getPicId(req);
      await this.service.updateMenu(req.params.id, menuData, allowed_roles, picId);
      sendSuccess(res, req.body, "Data menu berhasil diperbarui");
    } catch (err: any) {
      sendError(res, err.message || "Gagal memperbarui menu", 500);
    }
  };

  reorderMenus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { items } = req.body;
      const picId = getPicId(req);
      await this.service.reorderMenus(items, picId);
      sendSuccess(res, items, "Urutan menu sidebar berhasil disimpan");
    } catch (err: any) {
      sendError(res, err.message || "Gagal menyimpan urutan menu", 500);
    }
  };

  softDeleteMenu = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      await this.service.softDeleteMenu(req.params.id, picId);
      sendSuccess(res, { id: req.params.id }, "Menu berhasil dihapus");
    } catch (err: any) {
      sendError(res, err.message || "Gagal menghapus menu", 500);
    }
  };
}
