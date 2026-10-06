import { CryptoUtil } from "../../utils/crypto.util";
import {
  SystemRepository,
  SystemUserEntity,
  RoleEntity,
  PermissionEntity,
  MenuEntity,
} from "./system.repository";

export class SystemService {
  private repo = new SystemRepository();

  // Users
  async getUsers(
    tab: "active" | "inactive" | "deleted" | "all",
    search?: string,
    roleCode?: string,
  ): Promise<SystemUserEntity[]> {
    return await this.repo.findUsers(tab, search, roleCode);
  }

  async getUserById(id: string): Promise<SystemUserEntity | null> {
    return await this.repo.findUserById(id);
  }

  async createUser(
    data: Partial<SystemUserEntity>,
    creatorPic: number | null = null,
  ): Promise<SystemUserEntity> {
    const insertId = await this.repo.createUser(data, creatorPic);
    const user = await this.repo.findUserById(insertId);
    return user!;
  }

  async updateUser(
    id: string,
    data: Partial<SystemUserEntity>,
    updatePic: number | null = null,
  ): Promise<SystemUserEntity | null> {
    await this.repo.updateUser(id, data, updatePic);
    return await this.repo.findUserById(id);
  }

  async softDeleteUser(
    id: string,
    deletePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.softDeleteUser(id, deletePic);
  }

  async restoreUser(
    id: string,
    updatePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.restoreUser(id, updatePic);
  }

  // Roles
  async getRoles(): Promise<RoleEntity[]> {
    return await this.repo.findRoles();
  }

  async createRole(
    data: Partial<RoleEntity>,
    creatorPic: number | null = null,
  ): Promise<boolean> {
    const id = data.id || `role-${Date.now()}`;
    return await this.repo.createRole({ ...data, id }, creatorPic);
  }

  async updateRole(
    id: string,
    data: Partial<RoleEntity>,
    updatePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.updateRole(id, data, updatePic);
  }

  async softDeleteRole(
    id: string,
    deletePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.softDeleteRole(id, deletePic);
  }

  // Permissions & Access Matrix
  async getPermissions(): Promise<PermissionEntity[]> {
    return await this.repo.findPermissions();
  }

  async createPermission(
    perm: Partial<PermissionEntity>,
    creatorPic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.createPermission(perm, creatorPic);
  }

  async updatePermission(
    id: string | number,
    perm: Partial<PermissionEntity>,
    updatePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.updatePermission(id, perm, updatePic);
  }

  async deletePermission(
    id: string | number,
    deletePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.deletePermission(id, deletePic);
  }

  async getRolePermissionsMatrix(): Promise<{
    roles: RoleEntity[];
    permissions: PermissionEntity[];
    matrix: Record<string, (string | number)[]>; // role_id -> array of permission_id
  }> {
    const roles = await this.repo.findRoles();
    const permissions = await this.repo.findPermissions();
    const rolePerms = await this.repo.findRolePermissions();

    const matrix: Record<string, (string | number)[]> = {};
    for (const r of roles) {
      const rawRoleId = Number(r.id_roles ?? (CryptoUtil.decryptId(r.id) ?? r.id));
      const encRoleId = CryptoUtil.encryptId(rawRoleId) || String(rawRoleId);

      const assignedPermIds: (string | number)[] = [];
      const assignedPermEncIds: (string | number)[] = [];

      for (const rp of rolePerms) {
        const rpRoleId = Number(rp.roles_id ?? (CryptoUtil.decryptId(rp.role_id) ?? rp.role_id));
        if (rpRoleId === rawRoleId) {
          const rawPermId = Number(rp.permissions_id ?? (CryptoUtil.decryptId(rp.permission_id) ?? rp.permission_id));
          const encPermId = CryptoUtil.encryptId(rawPermId) || String(rawPermId);
          assignedPermIds.push(rawPermId);
          assignedPermEncIds.push(encPermId);
        }
      }

      // Map by encrypted role ID, numeric role ID, and role code
      matrix[encRoleId] = assignedPermEncIds;
      matrix[String(rawRoleId)] = assignedPermIds;
      if (r.code) {
        matrix[r.code] = assignedPermEncIds;
      }
    }

    return { roles, permissions, matrix };
  }

  async updateRolePermissions(
    roleId: string,
    permissionIds: string[],
    updatePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.updateRolePermissions(
      roleId,
      permissionIds,
      updatePic,
    );
  }

  // Menus & Dynamic Sidebar
  async getMenus(): Promise<MenuEntity[]> {
    return await this.repo.findMenus();
  }

  async getSidebarMenusByRole(roleCode?: string): Promise<MenuEntity[]> {
    if (!roleCode || !roleCode.trim()) return [];
    return await this.repo.findSidebarMenusByRole(roleCode);
  }

  async createMenu(
    data: Partial<MenuEntity>,
    allowedRoleIds: string[] = [],
    creatorPic: number | null = null,
  ): Promise<boolean> {
    const id = data.id || `menu-${Date.now()}`;
    return await this.repo.createMenu(
      { ...data, id },
      allowedRoleIds,
      creatorPic,
    );
  }

  async updateMenu(
    id: string,
    data: Partial<MenuEntity>,
    allowedRoleIds?: string[],
    updatePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.updateMenu(id, data, allowedRoleIds, updatePic);
  }

  async reorderMenus(
    items: { id: string; order_index: number }[],
    updatePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.reorderMenus(items, updatePic);
  }

  async softDeleteMenu(
    id: string,
    deletePic: number | null = null,
  ): Promise<boolean> {
    return await this.repo.softDeleteMenu(id, deletePic);
  }

  // Wallet & Withdrawals (Admin)
  async topupUserBalance(
    userId: string,
    amount: number,
    notes?: string,
    referenceNo?: string,
    creatorPic: number | null = null,
  ): Promise<{ success: boolean; balance_before: number; balance_after: number }> {
    return await this.repo.topupUserBalance(userId, amount, notes, referenceNo, creatorPic);
  }

  async getWithdrawalRequests(status?: string, search?: string): Promise<any[]> {
    return await this.repo.getWithdrawalRequests(status, search);
  }

  async updateWithdrawalStatus(
    withdrawalId: string,
    status: "completed" | "rejected",
    adminNotes?: string,
    processedBy: number | null = null,
  ): Promise<boolean> {
    return await this.repo.updateWithdrawalStatus(withdrawalId, status, adminNotes, processedBy);
  }

  async getTopupRequests(status?: string, search?: string): Promise<any[]> {
    return await this.repo.getTopupRequests(status, search);
  }

  async updateTopupStatus(
    topupId: string,
    status: "completed" | "rejected",
    adminNotes?: string,
    processedBy: number | null = null,
  ): Promise<boolean> {
    return await this.repo.updateTopupStatus(topupId, status, adminNotes, processedBy);
  }
}
