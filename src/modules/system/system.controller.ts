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

  // Wallet & Withdrawal Management (Admin)
  topupUserBalance = async (req: Request, res: Response): Promise<void> => {
    try {
      const { amount, notes, reference_no } = req.body;
      const numAmount = Number(amount);
      if (!numAmount || numAmount <= 0) {
        sendError(res, "Nominal top-up harus lebih besar dari 0", 400);
        return;
      }
      const picId = getPicId(req);
      const result = await this.service.topupUserBalance(
        req.params.id,
        numAmount,
        notes,
        reference_no,
        picId,
      );
      sendSuccess(res, result, "Top-up saldo pengguna berhasil diproses", 200);
    } catch (err: any) {
      sendError(res, err.message || "Gagal memproses top-up saldo", 500);
    }
  };

  getWithdrawalRequests = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = req.query.status as string;
      const search = req.query.search as string;
      const data = await this.service.getWithdrawalRequests(status, search);
      sendSuccess(res, data, "Daftar permintaan penarikan dana berhasil diambil");
    } catch (err: any) {
      sendError(res, err.message || "Gagal mengambil daftar penarikan dana", 500);
    }
  };

  updateWithdrawalStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, admin_notes } = req.body;
      if (status !== "completed" && status !== "rejected") {
        sendError(res, "Status harus 'completed' atau 'rejected'", 400);
        return;
      }
      if (status === "rejected" && (!admin_notes || admin_notes.trim().length === 0)) {
        sendError(res, "Keterangan / alasan penolakan penarikan dana wajib diisi agar kurir mengetahui penyebabnya", 400);
        return;
      }
      const picId = getPicId(req);
      await this.service.updateWithdrawalStatus(req.params.id, status, admin_notes?.trim(), picId);
      sendSuccess(
        res,
        { id: req.params.id, status, admin_notes },
        status === "completed"
          ? "Penarikan dana berhasil disetujui & ditandai selesai"
          : "Penarikan dana berhasil ditolak dan saldo dikembalikan ke kurir",
      );
    } catch (err: any) {
      sendError(res, err.message || "Gagal memperbarui status penarikan dana", 500);
    }
  };

  getTopupRequests = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = req.query.status as string;
      const search = req.query.search as string;
      const data = await this.service.getTopupRequests(status, search);
      sendSuccess(res, data, "Daftar permintaan top-up saldo berhasil diambil");
    } catch (err: any) {
      sendError(res, err.message || "Gagal mengambil daftar permintaan top-up", 500);
    }
  };

  updateTopupStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, admin_notes } = req.body;
      if (status !== "completed" && status !== "rejected") {
        sendError(res, "Status harus 'completed' atau 'rejected'", 400);
        return;
      }
      if (status === "rejected" && (!admin_notes || admin_notes.trim().length === 0)) {
        sendError(res, "Keterangan / alasan penolakan top-up wajib diisi agar pelanggan mengetahui penyebabnya", 400);
        return;
      }
      const picId = getPicId(req);
      await this.service.updateTopupStatus(req.params.id, status, admin_notes?.trim(), picId);
      sendSuccess(
        res,
        { id: req.params.id, status, admin_notes },
        status === "completed"
          ? "Pengajuan top-up berhasil disetujui & saldo telah ditambahkan ke akun pelanggan"
          : "Pengajuan top-up berhasil ditolak",
      );
    } catch (err: any) {
      sendError(res, err.message || "Gagal memperbarui status pengajuan top-up", 500);
    }
  };
}
