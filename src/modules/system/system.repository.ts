import bcrypt from "bcryptjs";
import { query } from "../../config/database";
import { CryptoUtil } from "../../utils/crypto.util";
import { UserCodeUtil } from "../../utils/user-code.util";

export interface RoleEntity {
  id_roles: number | string;
  name_roles: string;
  code: string;
  user_count?: number;
  created_at?: Date | string;
  creator?: number;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
  // legacy alias helpers
  id?: number | string;
  name?: string;
}

export interface PermissionEntity {
  id_permissions: number | string;
  name_permissions: string;
  code: string;
  module: string;
  created_at?: Date | string;
  creator?: number;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
  // legacy alias helpers
  id?: number | string;
  name?: string;
}

export interface MenuEntity {
  id_menus: number | string;
  key?: string;
  name_menus: string;
  path: string;
  nama_akses?: string;
  icon: string;
  menus_id?: number | string | null;
  parent_title?: string | null;
  order_index: number;
  is_active: boolean | number;
  is_sidebar: boolean | number;
  submenus?: MenuEntity[];
  allowed_roles?: string[];
  created_at?: Date | string;
  creator?: number;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
  // legacy alias helpers
  id?: number | string;
  title?: string;
  name?: string;
  parent_id?: number | string | null;
}

export interface SystemUserEntity {
  id_users: number | string;
  name_users: string;
  email: string;
  phone: string;
  password?: string;
  role_code: string;
  role_name?: string;
  status: string;
  avatar_url?: string | null;
  member_tier?: string;
  laundry_pay_balance?: number;
  reward_points?: number;
  user_code?: string;
  created_at?: Date | string;
  creator?: number;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
  // legacy alias helpers
  id?: number | string;
  name?: string;
}

export class SystemRepository {
  // ================= USERS (User Aktif & User Keluar) =================
  async findUsers(
    tab: "active" | "inactive" | "deleted" | "all" = "active",
    search?: string,
    roleCode?: string,
  ): Promise<SystemUserEntity[]> {
    let whereConditions: string[] = [];
    let params: any[] = [];

    if (tab === "active") {
      whereConditions.push("u.deleted_at IS NULL AND u.status = ?");
      params.push("active");
    } else if (tab === "inactive" || tab === "deleted") {
      whereConditions.push("(u.deleted_at IS NOT NULL OR u.status = ?)");
      params.push("inactive");
    }

    if (search) {
      whereConditions.push(
        "(u.name_users LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)",
      );
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (roleCode && roleCode !== "all") {
      whereConditions.push("u.role_code = ?");
      params.push(roleCode);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const sql = `
      SELECT 
        u.id_users, u.name_users, u.email, u.phone, u.role_code, u.status, u.avatar_url, u.member_tier, 
        u.laundry_pay_balance, u.reward_points, u.created_at, u.creator, 
        u.updated_at, u.update_pic, u.deleted_at, u.delete_pic,
        r.name_roles
      FROM users u
      LEFT JOIN roles r ON u.role_code = r.code
      ${whereClause}
      ORDER BY u.created_at DESC
    `;

    const users = await query<SystemUserEntity & { name_roles?: string }>(sql, params);
    const roles = await this.findRoles();

    // Query all users to compute per-role sequence accurately
    const allUsersSql = `
      SELECT id_users, role_code, created_at
      FROM users
      ORDER BY created_at ASC, id_users ASC
    `;
    const allChronologicalUsers = await query<{
      id_users: string | number;
      role_code: string;
      created_at: any;
    }>(allUsersSql);

    const roleSequenceMap = new Map<string, number>();
    const roleCounters = new Map<string, number>();

    for (const item of allChronologicalUsers) {
      const rKey = (item.role_code || "customer").toLowerCase().trim();
      const currentCount = (roleCounters.get(rKey) || 0) + 1;
      roleCounters.set(rKey, currentCount);
      roleSequenceMap.set(String(item.id_users), currentCount);
    }

    return users.map((u) => {
      const rawId = u.id_users;
      const seq = roleSequenceMap.get(String(rawId)) || 1;
      return {
        ...u,
        id: CryptoUtil.encryptId(Number(rawId)) ?? String(rawId),
        name: u.name_users,
        role_name: (u as any).name_roles || u.role_name,
        user_code: UserCodeUtil.generate(u, roles, seq),
      };
    });
  }

  async findUserById(id: string | number): Promise<SystemUserEntity | null> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const sql = `
      SELECT 
        u.id_users, u.name_users, u.email, u.phone, u.role_code, u.status, u.avatar_url, u.member_tier, 
        u.laundry_pay_balance, u.reward_points, u.created_at, u.creator, 
        u.updated_at, u.update_pic, u.deleted_at, u.delete_pic,
        r.name_roles
      FROM users u
      LEFT JOIN roles r ON u.role_code = r.code
      WHERE u.id_users = ?
      LIMIT 1
    `;
    const rows = await query<SystemUserEntity & { name_roles?: string }>(sql, [numericId]);
    if (rows.length === 0) return null;
    const user = rows[0];
    const roles = await this.findRoles();

    const countSql = `
      SELECT COUNT(*)
      FROM users
      WHERE role_code = ? 
        AND (created_at < ? OR (created_at = ? AND id_users <= ?))
    `;
    const countRes = await query<any>(countSql, [
      user.role_code,
      user.created_at,
      user.created_at,
      user.id_users,
    ]);
    const seq = Number(Object.values(countRes[0] || {})[0] || 1);

    return {
      ...user,
      id: CryptoUtil.encryptId(Number(user.id_users)) ?? String(user.id_users),
      name: user.name_users,
      role_name: (user as any).name_roles || user.role_name,
      user_code: UserCodeUtil.generate(user, roles, seq),
    };
  }

  private async validateUserUnique(
    email?: string | null,
    phone?: string | null,
    excludeId?: number | string | null,
  ): Promise<void> {
    const numericId = excludeId
      ? (CryptoUtil.decryptId(excludeId) ?? Number(excludeId))
      : null;

    // 1. Check Email Uniqueness
    if (email && email.trim()) {
      const targetEmail = email.trim().toLowerCase();
      const emailSql = numericId
        ? "SELECT id_users FROM users WHERE LOWER(email) = LOWER(?) AND id_users != ? AND deleted_at IS NULL LIMIT 1"
        : "SELECT id_users FROM users WHERE LOWER(email) = LOWER(?) AND deleted_at IS NULL LIMIT 1";
      const params = numericId ? [targetEmail, numericId] : [targetEmail];
      const dupEmail = await query<any>(emailSql, params);
      if (dupEmail.length > 0) {
        throw new Error("Email sudah terdaftar");
      }
    }

    // 2. Check Phone Uniqueness
    if (phone && phone.trim()) {
      const normalize = (p: string) => {
        let d = (p || "").replace(/\D/g, "");
        if (d.startsWith("62")) d = d.slice(2);
        while (d.startsWith("0")) d = d.slice(1);
        return d;
      };

      const targetNorm = normalize(phone);
      if (targetNorm) {
        const phoneSql = numericId
          ? "SELECT id_users, phone FROM users WHERE id_users != ? AND deleted_at IS NULL"
          : "SELECT id_users, phone FROM users WHERE deleted_at IS NULL";
        const params = numericId ? [numericId] : [];
        const allUsers = await query<any>(phoneSql, params);
        const isDupPhone = allUsers.some(
          (u) => normalize(u.phone) === targetNorm,
        );
        if (isDupPhone) {
          throw new Error("Nomor HP sudah terdaftar");
        }
      }
    }
  }

  async createUser(
    user: Partial<SystemUserEntity>,
    creatorPic: number | null = null,
  ): Promise<number> {
    await this.validateUserUnique(user.email, user.phone, null);

    const passwordHash =
      user.password && user.password.trim()
        ? bcrypt.hashSync(user.password.trim(), 10)
        : bcrypt.hashSync("password123", 10);

    const userName = user.name_users || (user as any).name || "";
    const creatorVal = creatorPic ?? (user as any)?.creator ?? 0;
    const sql = `
      INSERT INTO users (name_users, email, phone, password, role_code, status, member_tier, laundry_pay_balance, reward_points, created_at, creator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      userName,
      user.email,
      user.phone,
      passwordHash,
      user.role_code || "customer",
      user.status || "active",
      user.member_tier || "Member",
      user.laundry_pay_balance ?? 0,
      user.reward_points ?? 0,
      creatorVal,
    ]);
    return res.insertId;
  }

  async updateUser(
    id: string | number,
    user: Partial<SystemUserEntity>,
    updatePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    await this.validateUserUnique(user.email, user.phone, numericId);

    const userName = user.name_users ?? (user as any).name;
    const updates: string[] = [
      "name_users = ?",
      "email = ?",
      "phone = ?",
      "role_code = ?",
      "status = ?",
      "updated_at = NOW()",
    ];
    const params: any[] = [
      userName,
      user.email,
      user.phone,
      user.role_code,
      user.status || "active",
    ];

    if (user.password && user.password.trim()) {
      updates.push("password = ?");
      params.push(bcrypt.hashSync(user.password.trim(), 10));
    }

    if (updatePic !== undefined && updatePic !== null) {
      updates.push("update_pic = ?");
      params.push(updatePic);
    }

    params.push(numericId);
    const sql = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id_users = ?
    `;
    await query(sql, params);
    return true;
  }

  async softDeleteUser(
    id: string | number,
    deletePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const sql = `
      UPDATE users 
      SET deleted_at = NOW(), delete_pic = ?, status = 'inactive'
      WHERE id_users = ?
    `;
    await query(sql, [deletePic, numericId]);
    return true;
  }

  async restoreUser(
    id: string | number,
    updatePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const sql = `
      UPDATE users 
      SET deleted_at = NULL, delete_pic = NULL, status = 'active', updated_at = NOW(), update_pic = ?
      WHERE id_users = ?
    `;
    await query(sql, [updatePic, numericId]);
    return true;
  }

  // ================= ROLES =================
  async findRoles(): Promise<RoleEntity[]> {
    const sql = `
      SELECT 
        r.id_roles, r.name_roles, r.code, r.created_at, r.creator, 
        r.updated_at, r.update_pic, r.deleted_at, r.delete_pic,
        COUNT(u.id_users)
      FROM roles r
      LEFT JOIN users u ON u.role_code = r.code AND u.deleted_at IS NULL
      WHERE r.deleted_at IS NULL
      GROUP BY r.id_roles, r.name_roles, r.code, r.created_at, r.creator, r.updated_at, r.update_pic, r.deleted_at, r.delete_pic
      ORDER BY r.created_at ASC
    `;
    const rows = await query<any>(sql);
    return rows.map((r) => ({
      ...r,
      user_count: Number(r['COUNT(u.id_users)'] ?? Object.values(r)[9] ?? 0),
      id: CryptoUtil.encryptId(Number(r.id_roles)) ?? String(r.id_roles),
      name: r.name_roles,
    }));
  }

  async createRole(
    role: Partial<RoleEntity & { permission_ids?: (string | number)[] }>,
    creatorPic: number | null = null,
  ): Promise<boolean> {
    const roleName = role.name_roles || (role as any).name || "";
    const code =
      role.code?.trim() ||
      roleName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_") ||
      "role";
    const creatorVal = creatorPic ?? (role as any)?.creator ?? 0;
    const sql = `
      INSERT INTO roles (name_roles, code, created_at, creator)
      VALUES (?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [roleName, code, creatorVal]);
    const insertId = res?.insertId;

    if (insertId && role.permission_ids && role.permission_ids.length > 0) {
      for (const permId of role.permission_ids) {
        const numericPermId = CryptoUtil.decryptId(permId) ?? permId;
        await query(
          "INSERT INTO role_permissions (roles_id, permissions_id, created_at, creator) VALUES (?, ?, NOW(), ?)",
          [insertId, numericPermId, creatorVal],
        );
      }
    }
    return true;
  }

  async updateRole(
    id: string | number,
    role: Partial<RoleEntity & { permission_ids?: (string | number)[] }>,
    updatePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const roleName = role.name_roles ?? (role as any).name ?? null;
    const sql = `
      UPDATE roles 
      SET name_roles = COALESCE(?, name_roles), 
          updated_at = NOW(), 
          update_pic = ?
      WHERE id_roles = ?
    `;
    await query(sql, [roleName, updatePic, numericId]);

    if (role.permission_ids !== undefined) {
      await this.updateRolePermissions(
        numericId,
        role.permission_ids,
        updatePic,
      );
    }
    return true;
  }

  async softDeleteRole(
    id: string | number,
    deletePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const sql = `
      UPDATE roles 
      SET deleted_at = NOW(), delete_pic = ?
      WHERE id_roles = ?
    `;
    await query(sql, [deletePic, numericId]);
    return true;
  }

  // ================= PERMISSIONS & ACCESS MATRIX =================
  async findPermissions(): Promise<PermissionEntity[]> {
    const sql = `
      SELECT id_permissions, name_permissions, code, module, created_at, creator, updated_at, update_pic, deleted_at, delete_pic
      FROM permissions
      WHERE deleted_at IS NULL
      ORDER BY module ASC, code ASC
    `;
    const rows = await query<PermissionEntity>(sql);
    return rows.map((p) => ({
      ...p,
      id: CryptoUtil.encryptId(Number(p.id_permissions)) ?? String(p.id_permissions),
      name: p.name_permissions,
    }));
  }

  async createPermission(
    perm: Partial<PermissionEntity>,
    creatorPic: number | null = null,
  ): Promise<boolean> {
    const code = perm.code?.trim();
    if (!code) throw new Error("Nama akses / kode tidak boleh kosong");
    const dup = await query<PermissionEntity>(
      "SELECT id_permissions FROM permissions WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL LIMIT 1",
      [code],
    );
    if (dup.length > 0) throw new Error("Nama akses / kode sudah digunakan");

    const permName = perm.name_permissions || (perm as any).name || code;
    const creatorVal = creatorPic ?? (perm as any)?.creator ?? 0;
    const sql = `
      INSERT INTO permissions (name_permissions, code, module, created_at, creator)
      VALUES (?, ?, ?, NOW(), ?)
    `;
    await query(sql, [
      permName.trim(),
      code,
      perm.module?.trim() || "General",
      creatorVal,
    ]);
    return true;
  }

  async updatePermission(
    id: string | number,
    perm: Partial<PermissionEntity>,
    updatePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const code = perm.code?.trim();
    if (!code) throw new Error("Nama akses / kode tidak boleh kosong");
    const dup = await query<PermissionEntity>(
      "SELECT id_permissions FROM permissions WHERE LOWER(code) = LOWER(?) AND id_permissions != ? AND deleted_at IS NULL LIMIT 1",
      [code, numericId],
    );
    if (dup.length > 0) throw new Error("Nama akses / kode sudah digunakan");

    const permName = perm.name_permissions || (perm as any).name || code;
    const sql = `
      UPDATE permissions
      SET name_permissions = ?, code = ?, module = ?, updated_at = NOW(), update_pic = ?
      WHERE id_permissions = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      permName.trim(),
      code,
      perm.module?.trim() || "General",
      updatePic,
      numericId,
    ]);
    return true;
  }

  async deletePermission(
    id: string | number,
    deletePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const sql = `
      UPDATE permissions
      SET deleted_at = NOW(), delete_pic = ?
      WHERE id_permissions = ?
    `;
    await query(sql, [deletePic, numericId]);
    return true;
  }

  async findRolePermissions(): Promise<
    {
      role_id: number | string;
      roles_id: number | string;
      permission_id: number | string;
      permissions_id: number | string;
      permission_code: string;
    }[]
  > {
    const sql = `
      SELECT rp.roles_id, rp.permissions_id, p.code
      FROM role_permissions rp
      JOIN permissions p ON rp.permissions_id = p.id_permissions
      WHERE rp.deleted_at IS NULL AND p.deleted_at IS NULL
    `;
    const rows = await query<{
      roles_id: number | string;
      permissions_id: number | string;
      code: string;
    }>(sql);
    return rows.map((r) => ({
      ...r,
      permission_code: r.code,
      role_id: CryptoUtil.encryptId(Number(r.roles_id)) ?? String(r.roles_id),
      permission_id: CryptoUtil.encryptId(Number(r.permissions_id)) ?? String(r.permissions_id),
    }));
  }

  async updateRolePermissions(
    roleId: string | number,
    permissionIds: (string | number)[],
    updatePic: number | null = null,
  ): Promise<boolean> {
    let numericRoleId: number | null = CryptoUtil.decryptId(roleId);
    if (!numericRoleId) {
      // Lookup role by code if not integer
      const roles = await query<RoleEntity>(
        "SELECT id_roles FROM roles WHERE code = ? OR id_roles = ? LIMIT 1",
        [roleId, roleId],
      );
      if (roles.length > 0) {
        numericRoleId =
          typeof roles[0].id_roles === "number"
            ? roles[0].id_roles
            : parseInt(String(roles[0].id_roles || (roles[0] as any).id), 10);
      }
    }

    if (!numericRoleId) return false;

    await query("DELETE FROM role_permissions WHERE roles_id = ?", [
      numericRoleId,
    ]);
    if (permissionIds.length > 0) {
      for (const permId of permissionIds) {
        const numericPermId = CryptoUtil.decryptId(permId) ?? permId;
        await query(
          "INSERT INTO role_permissions (roles_id, permissions_id, created_at, creator) VALUES (?, ?, NOW(), ?)",
          [numericRoleId, numericPermId, updatePic ?? 0],
        );
      }
    }
    return true;
  }

  // ================= MENUS & DYNAMIC SIDEBAR =================
  async findMenus(): Promise<MenuEntity[]> {
    const sql = `
      SELECT 
        m.id_menus, m.\`key\`, m.name_menus, m.path, m.nama_akses, m.icon, 
        m.menus_id, m.order_index, 
        m.is_active, m.is_sidebar, 
        m.created_at, m.creator, m.updated_at, m.update_pic, m.deleted_at, m.delete_pic
      FROM menus m
      WHERE m.deleted_at IS NULL
      ORDER BY m.order_index ASC
    `;
    const menus = await query<MenuEntity>(sql);

    // Fetch attached role access mapping
    const roleMenuSql = `
      SELECT rm.id_role_menus, rm.roles_id, rm.menus_id, rm.can_view, r.code 
      FROM role_menus rm
      JOIN roles r ON rm.roles_id = r.id_roles
      WHERE rm.can_view = 1 AND rm.deleted_at IS NULL AND r.deleted_at IS NULL
    `;
    const roleMenus = await query<{ id_role_menus: number; roles_id: number; menus_id: number; can_view: number; code: string }>(
      roleMenuSql,
    );

    const menuMap = new Map(menus.map((m) => [Number(m.id_menus), m.name_menus]));

    for (const m of menus) {
      m.id = CryptoUtil.encryptId(Number(m.id_menus)) ?? String(m.id_menus);
      m.title = m.name_menus;
      m.name = m.name_menus;
      m.parent_id = m.menus_id ? (CryptoUtil.encryptId(Number(m.menus_id)) ?? String(m.menus_id)) : null;
      m.parent_title = m.menus_id ? (menuMap.get(Number(m.menus_id)) ?? null) : null;
      m.allowed_roles = roleMenus
        .filter((rm) => Number(rm.menus_id) === Number(m.id_menus))
        .map((rm) => rm.code);
    }

    return menus;
  }

  async findSidebarMenusByRole(roleCode?: string): Promise<MenuEntity[]> {
    if (!roleCode || !roleCode.trim()) return [];
    const normalizedRole = roleCode.toLowerCase().trim();

    // Lookup role record
    const roleRes = await query<{
      id_roles: number | string;
      code: string;
      name_roles: string;
    }>(
      "SELECT id_roles, code, name_roles FROM roles WHERE LOWER(code) = LOWER(?) OR LOWER(name_roles) = LOWER(?) LIMIT 1",
      [normalizedRole, normalizedRole],
    );

    if (roleRes.length === 0) {
      return [];
    }

    const role = roleRes[0];
    const roleId =
      typeof role.id_roles === "number" ? role.id_roles : parseInt(String(role.id_roles), 10);

    const sql = `
      SELECT DISTINCT m.id_menus, m.\`key\`, m.name_menus, m.path, m.nama_akses, m.icon, m.menus_id, m.order_index, m.is_active, m.is_sidebar
      FROM menus m
      WHERE m.is_active = 1 
        AND m.is_sidebar = 1 
        AND m.deleted_at IS NULL
        AND (
          -- 1. Strictly matched with nama_akses written in Menu List matching active role permissions
          EXISTS (
            SELECT 1 FROM role_permissions rp
            JOIN permissions p ON rp.permissions_id = p.id_permissions
            WHERE rp.roles_id = ?
              AND rp.deleted_at IS NULL
              AND p.deleted_at IS NULL
              AND m.nama_akses IS NOT NULL 
              AND m.nama_akses != ''
              AND (
                LOWER(p.code) = LOWER(m.nama_akses)
                OR FIND_IN_SET(LOWER(p.code), LOWER(REPLACE(m.nama_akses, ' ', ''))) > 0
              )
          )
          OR
          -- 2. Is a parent menu and has at least one accessible child submenu matching its nama_akses
          EXISTS (
            SELECT 1 FROM menus sub
            WHERE sub.menus_id = m.id_menus
              AND sub.is_active = 1
              AND sub.is_sidebar = 1
              AND sub.deleted_at IS NULL
              AND EXISTS (
                SELECT 1 FROM role_permissions rp
                JOIN permissions p ON rp.permissions_id = p.id_permissions
                WHERE rp.roles_id = ?
                  AND rp.deleted_at IS NULL
                  AND p.deleted_at IS NULL
                  AND sub.nama_akses IS NOT NULL 
                  AND sub.nama_akses != ''
                  AND (
                    LOWER(p.code) = LOWER(sub.nama_akses)
                    OR FIND_IN_SET(LOWER(p.code), LOWER(REPLACE(sub.nama_akses, ' ', ''))) > 0
                  )
              )
          )
        )
      ORDER BY m.order_index ASC
    `;

    const items = await query<MenuEntity>(sql, [roleId, roleId]);
    const formatted = items.map((m) => ({
      ...m,
      id: CryptoUtil.encryptId(Number(m.id_menus)) ?? String(m.id_menus),
      title: m.name_menus,
      name: m.name_menus,
      parent_id: m.menus_id ? (CryptoUtil.encryptId(Number(m.menus_id)) ?? String(m.menus_id)) : null,
    }));
    return this.buildMenuHierarchy(formatted);
  }

  private buildMenuHierarchy(items: MenuEntity[]): MenuEntity[] {
    const rootMenus: MenuEntity[] = [];
    const childMenus: MenuEntity[] = [];

    for (const item of items) {
      const parent = item.menus_id ?? item.parent_id;
      if (!parent) {
        rootMenus.push({ ...item, submenus: [] });
      } else {
        childMenus.push(item);
      }
    }

    for (const root of rootMenus) {
      root.submenus = childMenus.filter(
        (c) => Number(c.menus_id ?? c.parent_id) === Number(root.id_menus ?? root.id),
      );
    }

    return rootMenus;
  }

  private async checkMenuUniqueness(
    menu: Partial<MenuEntity>,
    excludeId?: string | number,
  ): Promise<void> {
    const numericExcludeId = excludeId
      ? (CryptoUtil.decryptId(excludeId) ?? excludeId)
      : null;
    const key = (menu.key || (menu as any).code || "").trim();
    const title = (menu.name_menus || menu.title || (menu as any).name || "").trim();
    const path = (menu.path || (menu as any).route || "").trim();
    const namaAkses = (
      menu.nama_akses ||
      (menu as any).permission_name ||
      ""
    ).trim();

    // 1. Check Key (Must be Unique)
    if (key) {
      const keySql = numericExcludeId
        ? "SELECT id_menus FROM menus WHERE LOWER(`key`) = LOWER(?) AND id_menus != ? AND deleted_at IS NULL LIMIT 1"
        : "SELECT id_menus FROM menus WHERE LOWER(`key`) = LOWER(?) AND deleted_at IS NULL LIMIT 1";
      const params = numericExcludeId ? [key, numericExcludeId] : [key];
      const dupKey = await query<MenuEntity>(keySql, params);
      if (dupKey.length > 0) {
        throw new Error("Key sudah digunakan");
      }
    }

    // 2. Check Nama Menu / Title (Must be Unique)
    if (title) {
      const titleSql = numericExcludeId
        ? "SELECT id_menus FROM menus WHERE LOWER(name_menus) = LOWER(?) AND id_menus != ? AND deleted_at IS NULL LIMIT 1"
        : "SELECT id_menus FROM menus WHERE LOWER(name_menus) = LOWER(?) AND deleted_at IS NULL LIMIT 1";
      const params = numericExcludeId ? [title, numericExcludeId] : [title];
      const dupTitle = await query<MenuEntity>(titleSql, params);
      if (dupTitle.length > 0) {
        throw new Error("Nama menu sudah terdaftar");
      }
    }

    // 3. Check Route / Path (Must be Unique, kecuali '#')
    if (path && path !== "#") {
      const pathSql = numericExcludeId
        ? "SELECT id_menus FROM menus WHERE LOWER(path) = LOWER(?) AND path != '#' AND id_menus != ? AND deleted_at IS NULL LIMIT 1"
        : "SELECT id_menus FROM menus WHERE LOWER(path) = LOWER(?) AND path != '#' AND deleted_at IS NULL LIMIT 1";
      const params = numericExcludeId ? [path, numericExcludeId] : [path];
      const dupPath = await query<MenuEntity>(pathSql, params);
      if (dupPath.length > 0) {
        throw new Error("Route sudah digunakan");
      }
    }

    // 4. Check Nama Akses (Must be Unique if provided)
    if (namaAkses) {
      const aksesSql = numericExcludeId
        ? "SELECT id_menus FROM menus WHERE LOWER(nama_akses) = LOWER(?) AND id_menus != ? AND deleted_at IS NULL LIMIT 1"
        : "SELECT id_menus FROM menus WHERE LOWER(nama_akses) = LOWER(?) AND deleted_at IS NULL LIMIT 1";
      const params = numericExcludeId
        ? [namaAkses, numericExcludeId]
        : [namaAkses];
      const dupAkses = await query<MenuEntity>(aksesSql, params);
      if (dupAkses.length > 0) {
        throw new Error("Nama akses sudah digunakan");
      }
    }
  }

  async createMenu(
    menu: Partial<MenuEntity>,
    allowedRoles: string[] = [],
    creatorPic: number | null = null,
  ): Promise<any> {
    await this.checkMenuUniqueness(menu);

    const key = (menu.key || (menu as any).code || "").trim() || null;
    const title = (menu.name_menus || menu.title || (menu as any).name || "").trim();
    const path = (menu.path || (menu as any).route || "").trim();
    const namaAkses =
      (menu.nama_akses || (menu as any).permission_name || "").trim() || null;
    const icon = (menu.icon || "").trim() || null;
    const rawParentId = menu.menus_id ?? menu.parent_id;
    const parentId = rawParentId
      ? (CryptoUtil.decryptId(rawParentId) ?? rawParentId)
      : null;
    const creatorVal = creatorPic ?? (menu as any)?.creator ?? 0;

    const sql = `
      INSERT INTO menus (\`key\`, name_menus, path, nama_akses, icon, menus_id, order_index, is_active, is_sidebar, created_at, creator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      key,
      title,
      path,
      namaAkses,
      icon,
      parentId,
      menu.order_index ?? 0,
      menu.is_active !== undefined ? (menu.is_active ? 1 : 0) : 1,
      menu.is_sidebar !== undefined ? (menu.is_sidebar ? 1 : 0) : 1,
      creatorVal,
    ]);

    const newMenuId = res?.insertId;

    if (newMenuId && allowedRoles.length > 0) {
      // Resolve role codes or role IDs
      for (const r of allowedRoles) {
        let roleId = CryptoUtil.decryptId(r);
        if (!roleId) {
          const roleRows = await query<RoleEntity>(
            "SELECT id_roles FROM roles WHERE code = ? LIMIT 1",
            [r],
          );
          if (roleRows.length > 0) roleId = Number(roleRows[0].id_roles || (roleRows[0] as any).id);
        }
        if (roleId) {
          await query(
            "INSERT INTO role_menus (roles_id, menus_id, can_view, created_at, creator) VALUES (?, ?, 1, NOW(), ?)",
            [roleId, newMenuId, creatorVal],
          );
        }
      }
    }
    return {
      id: CryptoUtil.encryptId(newMenuId) ?? String(newMenuId),
      id_menus: newMenuId,
      key,
      title,
      name_menus: title,
      path,
      nama_akses: namaAkses,
      icon,
      parent_id: parentId ? (CryptoUtil.encryptId(parentId) ?? String(parentId)) : null,
      menus_id: parentId,
    };
  }

  async updateMenu(
    id: string | number,
    menu: Partial<MenuEntity>,
    allowedRoles?: string[],
    updatePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    await this.checkMenuUniqueness(menu, numericId);

    const existing = await query<MenuEntity>(
      "SELECT id_menus, `key`, name_menus, path, nama_akses, icon, menus_id, order_index, is_active, is_sidebar, created_at, creator, updated_at, update_pic, deleted_at, delete_pic FROM menus WHERE id_menus = ? LIMIT 1",
      [numericId],
    );
    const current = existing[0] || ({} as MenuEntity);

    const rawParentId = menu.menus_id ?? menu.parent_id;
    const parentId =
      rawParentId !== undefined
        ? rawParentId
          ? (CryptoUtil.decryptId(rawParentId) ?? rawParentId)
          : null
        : (current.menus_id ?? current.parent_id ?? null);

    const menuTitle = menu.name_menus ?? menu.title ?? current.name_menus ?? current.title;

    const sql = `
      UPDATE menus 
      SET \`key\` = ?, name_menus = ?, path = ?, nama_akses = ?, icon = ?, menus_id = ?, order_index = ?, is_active = ?, is_sidebar = ?, updated_at = NOW(), update_pic = ?
      WHERE id_menus = ?
    `;
    await query(sql, [
      menu.key !== undefined ? menu.key : current.key || null,
      menuTitle,
      menu.path !== undefined ? menu.path : current.path,
      menu.nama_akses !== undefined
        ? menu.nama_akses
        : current.nama_akses || null,
      menu.icon !== undefined ? menu.icon?.trim() || null : current.icon,
      parentId,
      menu.order_index !== undefined
        ? menu.order_index
        : (current.order_index ?? 0),
      menu.is_active !== undefined
        ? menu.is_active
          ? 1
          : 0
        : current.is_active
          ? 1
          : 0,
      menu.is_sidebar !== undefined
        ? menu.is_sidebar
          ? 1
          : 0
        : current.is_sidebar
          ? 1
          : 0,
      updatePic,
      numericId,
    ]);

    if (allowedRoles !== undefined) {
      await query("DELETE FROM role_menus WHERE menus_id = ?", [numericId]);
      for (const r of allowedRoles) {
        let roleId = CryptoUtil.decryptId(r);
        if (!roleId) {
          const roleRows = await query<RoleEntity>(
            "SELECT id_roles FROM roles WHERE code = ? LIMIT 1",
            [r],
          );
          if (roleRows.length > 0) roleId = Number(roleRows[0].id_roles || (roleRows[0] as any).id);
        }
        if (roleId) {
          await query(
            "INSERT INTO role_menus (roles_id, menus_id, can_view, created_at, creator) VALUES (?, ?, 1, NOW(), ?)",
            [roleId, numericId, updatePic ?? 0],
          );
        }
      }
    }
    return true;
  }

  async reorderMenus(
    items: { id?: string | number; id_menus?: string | number; order_index: number }[],
    updatePic: number | null = null,
  ): Promise<boolean> {
    for (const item of items) {
      const rawId = item.id_menus ?? item.id;
      const numericId = CryptoUtil.decryptId(rawId) ?? rawId;
      await query(
        "UPDATE menus SET order_index = ?, updated_at = NOW(), update_pic = ? WHERE id_menus = ?",
        [item.order_index, updatePic, numericId],
      );
    }
    return true;
  }

  async softDeleteMenu(
    id: string | number,
    deletePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    await query(
      "UPDATE menus SET deleted_at = NOW(), delete_pic = ? WHERE id_menus = ?",
      [deletePic, numericId],
    );
    return true;
  }
}
