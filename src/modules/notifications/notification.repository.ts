import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';
import { isCustomerRole, isAdminOrStaffRole } from '../../utils/role.util';
import { hasRolePermission } from '../../middleware/permission.middleware';
import { emitNotificationEvent } from './notification.events';

export interface NotificationEntity {
  id?: number | string;
  id_notifications?: number | string;
  users_id?: number | string | null;
  user_id?: number | string | null;
  orders_id?: number | string | null;
  order_id?: number | string | null;
  title: string;
  message: string;
  type: string;
  target_role?: string | null;
  is_read?: boolean | number;
  data?: any;
  created_at?: Date | string;
  created_pic?: number | null;
  updated_at?: Date | string;
  updated_pic?: number | null;

  // Joined fields
  invoice_no?: string | null;
  service_name?: string | null;
  order_status?: string | null;
}

export class NotificationRepository {
  /**
   * Membangun WHERE clause secara dinamis murni berbasis parameter pengguna
   * dan izin akses (role_permissions) dari database, tanpa hardcoding nama role.
   */
  private async buildRoleWhereClause(
    userId?: number | null,
    roleCode?: string | null
  ): Promise<{ clause: string; params: any[] }> {
    const conditions: string[] = [];
    const params: any[] = [];

    // 1. Notifikasi Personal langsung untuk user ini (berdasarkan users_id)
    if (userId) {
      conditions.push(`n.users_id = ?`);
      params.push(userId);
    }

    // 2. Notifikasi Berbasis Role (HANYA jika users_id IS NULL / bukan notifikasi personal pengguna lain)
    if (roleCode && roleCode.trim() !== '') {
      const cleanRole = roleCode.trim().toLowerCase();
      conditions.push(`(n.users_id IS NULL AND n.target_role IS NOT NULL AND (LOWER(n.target_role) = ? OR FIND_IN_SET(?, LOWER(n.target_role)) > 0))`);
      params.push(cleanRole, cleanRole);
    }

    // 3. Notifikasi Operasional Pesanan (order_created / target_role 'admin' / 'staff' tanpa users_id)
    // Diperiksa secara dinamis: hanya staf/admin internal operasional (bukan customer dan bukan kurir) yang memiliki izin kelola pesanan
    const isAdminStaff = await isAdminOrStaffRole(roleCode);
    const canManageOrders = isAdminStaff && roleCode
      ? await hasRolePermission(roleCode, ['admin.akses.index', 'order.edit', 'order.index'])
      : false;

    if (canManageOrders) {
      // Staf/Admin operasional berhak melihat notifikasi pesanan masuk & notifikasi operasional internal
      conditions.push(`(n.users_id IS NULL AND (n.type = 'order_created' OR LOWER(n.target_role) = 'admin' OR LOWER(n.target_role) = 'staff'))`);
    }

    // 4. Notifikasi Siaran Umum (Broadcast ke semua pengguna: tanpa users_id dan tanpa target_role spesifik)
    // Kecualikan 'order_created' dari siaran umum agar tidak bocor ke akun publik/pelanggan umum
    conditions.push(`(n.users_id IS NULL AND (n.target_role IS NULL OR n.target_role = '' OR n.target_role = '*') AND n.type != 'order_created')`);

    if (conditions.length === 0) {
      return { clause: `1 = 0`, params: [] };
    }

    return {
      clause: `(${conditions.join(' OR ')})`,
      params,
    };
  }

  async findAll(options: {
    userId?: number | null;
    roleCode?: string | null;
    limit?: number;
  }): Promise<NotificationEntity[]> {
    const limit = options.limit || 50;

    let sql = `
      SELECT 
        n.id_notifications,
        n.users_id,
        n.orders_id,
        n.title,
        n.message,
        n.type,
        n.target_role,
        n.is_read,
        n.data,
        n.created_at,
        n.created_pic,
        n.updated_at,
        n.updated_pic,
        o.invoice_no,
        o.service_name,
        o.status AS order_status
      FROM notifications n
      LEFT JOIN orders o ON n.orders_id = o.id_orders
    `;

    const { clause, params } = await this.buildRoleWhereClause(options.userId, options.roleCode);
    sql += ` WHERE ` + clause;
    sql += ` ORDER BY n.id_notifications DESC LIMIT ?`;
    params.push(limit);

    return await query<NotificationEntity>(sql, params);
  }

  async getUnreadCount(options: {
    userId?: number | null;
    roleCode?: string | null;
  }): Promise<number> {
    const { clause, params } = await this.buildRoleWhereClause(options.userId, options.roleCode);
    const sql = `SELECT COUNT(*) as count FROM notifications n WHERE n.is_read = 0 AND ${clause}`;

    const res: any = await query(sql, params);
    return Number(res[0]?.count || 0);
  }

  async markAsRead(id: number | string): Promise<boolean> {
    const numId = CryptoUtil.decryptId(id) ?? Number(id);
    const sql = `UPDATE notifications SET is_read = 1, updated_at = NOW() WHERE id_notifications = ?`;
    await query(sql, [numId]);
    emitNotificationEvent({ action: 'read', notificationId: numId });
    return true;
  }

  async markAllAsRead(options: {
    userId?: number | null;
    roleCode?: string | null;
  }): Promise<boolean> {
    const { clause, params } = await this.buildRoleWhereClause(options.userId, options.roleCode);
    const sql = `UPDATE notifications n SET n.is_read = 1, n.updated_at = NOW() WHERE n.is_read = 0 AND ${clause}`;

    await query(sql, params);
    emitNotificationEvent({ action: 'read_all', userId: options.userId, targetRole: options.roleCode });
    return true;
  }

  async create(data: {
    users_id?: number | string | null;
    orders_id?: number | string | null;
    title: string;
    message: string;
    type?: string;
    target_role?: string | null;
    data?: any;
    created_pic?: number | null;
  }): Promise<number> {
    const rawUserId = data.users_id ? (CryptoUtil.decryptId(data.users_id) ?? Number(data.users_id)) : null;
    const rawOrderId = data.orders_id ? (CryptoUtil.decryptId(data.orders_id) ?? Number(data.orders_id)) : null;
    const dataJson = data.data ? JSON.stringify(data.data) : null;

    const sql = `
      INSERT INTO notifications (users_id, orders_id, title, message, type, target_role, is_read, data, created_at, created_pic)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW(), ?)
    `;

    const res: any = await query(sql, [
      rawUserId,
      rawOrderId,
      data.title,
      data.message,
      data.type || 'general',
      data.target_role || null,
      dataJson,
      data.created_pic || null,
    ]);

    const newId = res.insertId;
    emitNotificationEvent({
      action: 'created',
      userId: rawUserId,
      targetRole: data.target_role,
      notificationId: newId,
    });

    return newId;
  }
}
