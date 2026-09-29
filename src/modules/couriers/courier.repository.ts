import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';
import { OrderEntity } from '../orders/order.repository';

export interface CourierEntity {
  id: string;
  id_users: number;
  name: string;
  email: string;
  phone: string;
  role_code: string;
  avatar_url?: string | null;
  total_orders: number;
  active_orders: number;
  completed_orders: number;
  total_tips: number;
  average_rating: number;
  total_reviews: number;
  created_at?: Date | string;
}

export interface CourierSummaryEntity {
  total_couriers: number;
  active_deliveries: number;
  completed_deliveries: number;
  total_tips: number;
  average_rating: number;
  laundry_pay_balance?: number;
}

export class CourierRepository {
  async getCouriers(): Promise<CourierEntity[]> {
    // 1. Ambil semua akun staf kurir aktif dari database
    const users = await query<any>(`
      SELECT u.id_users, u.name_users, u.email, u.phone, u.role_code, u.avatar_url, u.created_at
      FROM users u
      LEFT JOIN roles r ON u.role_code = r.code
      WHERE (u.role_code LIKE '%kurir%' OR u.role_code LIKE '%courier%' OR LOWER(r.name_roles) LIKE '%kurir%')
        AND u.deleted_at IS NULL
      ORDER BY u.name_users ASC
    `);

    if (users.length === 0) return [];

    // 2. Agregasi statistik riil pesanan, tips, dan rating per kurir dari tabel orders
    const statsRows = await query<any>(`
      SELECT 
        o.courier_name,
        o.courier_phone,
        COUNT(o.id_orders) AS total_orders,
        SUM(CASE WHEN LOWER(o.status) NOT LIKE '%selesai%' AND LOWER(o.status) NOT LIKE '%batal%' AND (mos.code IS NULL OR mos.code NOT IN ('pesanan-selesai', 'cancelled')) THEN 1 ELSE 0 END) AS active_orders,
        SUM(CASE WHEN LOWER(o.status) LIKE '%selesai%' OR mos.code = 'pesanan-selesai' THEN 1 ELSE 0 END) AS completed_orders,
        COALESCE(SUM(o.tip_amount), 0) AS total_tips,
        COALESCE(AVG(o.rating), 0) AS average_rating,
        SUM(CASE WHEN o.review IS NOT NULL AND TRIM(o.review) != '' THEN 1 ELSE 0 END) AS total_reviews
      FROM orders o
      LEFT JOIN master_order_statuses mos ON o.order_statuses_id = mos.id_order_statuses AND mos.deleted_at IS NULL
      WHERE o.deleted_at IS NULL
        AND o.courier_name IS NOT NULL
        AND TRIM(o.courier_name) != ''
      GROUP BY o.courier_name, o.courier_phone
    `);

    return users.map((u: any) => {
      const uName = (u.name_users || '').trim().toLowerCase();
      const uPhone = (u.phone || '').replace(/[^0-9]/g, '');

      // Cocokkan statistik berdasarkan nama atau nomor telepon kurir yang terdata
      const matchedStats = statsRows.find((s: any) => {
        const sName = (s.courier_name || '').trim().toLowerCase();
        const sPhone = (s.courier_phone || '').replace(/[^0-9]/g, '');
        return sName === uName || (uPhone.length > 5 && sPhone === uPhone);
      });

      const rawId = Number(u.id_users);
      return {
        id: CryptoUtil.encryptId(rawId) ?? String(rawId),
        id_users: rawId,
        name: u.name_users,
        email: u.email,
        phone: u.phone,
        role_code: u.role_code,
        avatar_url: u.avatar_url,
        total_orders: Number(matchedStats?.total_orders) || 0,
        active_orders: Number(matchedStats?.active_orders) || 0,
        completed_orders: Number(matchedStats?.completed_orders) || 0,
        total_tips: Number(matchedStats?.total_tips) || 0,
        average_rating: matchedStats?.average_rating ? Number(Number(matchedStats.average_rating).toFixed(1)) : 0,
        total_reviews: Number(matchedStats?.total_reviews) || 0,
        created_at: u.created_at,
      };
    });
  }

  async getCourierSummary(options?: {
    courierName?: string | null;
    courierPhone?: string | null;
    userId?: number | null;
  }): Promise<CourierSummaryEntity> {
    const couriersCountRes = await query<any>(`
      SELECT COUNT(u.id_users) AS total_couriers
      FROM users u
      LEFT JOIN roles r ON u.role_code = r.code
      WHERE (u.role_code LIKE '%kurir%' OR u.role_code LIKE '%courier%' OR LOWER(r.name_roles) LIKE '%kurir%')
        AND u.deleted_at IS NULL
    `);

    let ordersSql = `
      SELECT 
        SUM(CASE WHEN LOWER(o.status) NOT LIKE '%selesai%' AND LOWER(o.status) NOT LIKE '%batal%' AND (mos.code IS NULL OR mos.code NOT IN ('pesanan-selesai', 'cancelled')) THEN 1 ELSE 0 END) AS active_deliveries,
        SUM(CASE WHEN LOWER(o.status) LIKE '%selesai%' OR mos.code = 'pesanan-selesai' THEN 1 ELSE 0 END) AS completed_deliveries,
        COALESCE(SUM(o.tip_amount), 0) AS total_tips,
        COALESCE(AVG(o.rating), 0) AS average_rating
      FROM orders o
      LEFT JOIN master_order_statuses mos ON o.order_statuses_id = mos.id_order_statuses AND mos.deleted_at IS NULL
      WHERE o.deleted_at IS NULL
        AND o.courier_name IS NOT NULL
        AND TRIM(o.courier_name) != ''
    `;
    const params: any[] = [];

    if (options?.courierName || options?.courierPhone) {
      const cleanPhone = (options.courierPhone || '').replace(/[^0-9]/g, '');
      const cName = (options.courierName || '').trim();

      if (cName && cleanPhone.length > 5) {
        ordersSql += ` AND (LOWER(o.courier_name) = LOWER(?) OR REPLACE(REPLACE(o.courier_phone, '-', ''), ' ', '') = ?)`;
        params.push(cName, cleanPhone);
      } else if (cName) {
        ordersSql += ` AND LOWER(o.courier_name) = LOWER(?)`;
        params.push(cName);
      } else if (cleanPhone.length > 5) {
        ordersSql += ` AND REPLACE(REPLACE(o.courier_phone, '-', ''), ' ', '') = ?`;
        params.push(cleanPhone);
      }
    }

    const ordersStatsRes = await query<any>(ordersSql, params);

    // Ambil saldo dompet kurir jika ada userId
    let courierBalance = 0;
    if (options?.userId) {
      const userRes = await query<any>(
        'SELECT laundry_pay_balance FROM users WHERE id_users = ? AND deleted_at IS NULL LIMIT 1',
        [options.userId]
      );
      if (userRes && userRes.length > 0) {
        courierBalance = Number(userRes[0].laundry_pay_balance) || 0;
      }
    } else if (options?.courierPhone || options?.courierName) {
      const cleanPhone = (options.courierPhone || '').replace(/[^0-9]/g, '');
      const cName = (options.courierName || '').trim();
      const userRes = await query<any>(
        `SELECT laundry_pay_balance FROM users 
         WHERE ((phone IS NOT NULL AND phone != '' AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?) OR LOWER(name_users) = LOWER(?))
           AND deleted_at IS NULL LIMIT 1`,
        [cleanPhone, cName]
      );
      if (userRes && userRes.length > 0) {
        courierBalance = Number(userRes[0].laundry_pay_balance) || 0;
      }
    }

    const cCount = Number(couriersCountRes[0]?.total_couriers) || 0;
    const stats = ordersStatsRes[0] || {};

    return {
      total_couriers: options?.courierName || options?.courierPhone ? 1 : cCount,
      active_deliveries: Number(stats.active_deliveries) || 0,
      completed_deliveries: Number(stats.completed_deliveries) || 0,
      total_tips: Number(stats.total_tips) || 0,
      average_rating: stats.average_rating ? Number(Number(stats.average_rating).toFixed(1)) : 0,
      laundry_pay_balance: courierBalance,
    };
  }

  async getCourierTasks(options: {
    courierName?: string | null;
    courierPhone?: string | null;
    statusFilter?: 'active' | 'history' | 'all';
  }): Promise<OrderEntity[]> {
    let sql = `
      SELECT 
        o.id_orders,
        o.invoice_no,
        o.users_id,
        o.service_name,
        o.service_type,
        o.order_date,
        o.estimated_completion_date,
        o.status,
        o.order_statuses_id,
        o.quantity,
        o.unit,
        o.price_per_unit,
        o.delivery_fee,
        o.discount,
        o.pickup_address,
        o.delivery_address,
        o.courier_name,
        o.courier_phone,
        o.notes,
        o.rating,
        o.review,
        o.tip_amount,
        o.rated_at,
        o.created_at,
        mos.name_order_statuses AS status_name,
        mos.code AS status_code,
        mos.step_order AS status_step_order,
        mos.color_hex AS status_color_hex,
        mos.badge_variant AS status_badge_variant,
        u.name_users AS customer_name,
        u.phone AS customer_phone,
        u.email AS customer_email,
        u.member_tier AS customer_member_tier
      FROM orders o
      LEFT JOIN master_order_statuses mos ON o.order_statuses_id = mos.id_order_statuses AND mos.deleted_at IS NULL
      LEFT JOIN users u ON o.users_id = u.id_users AND u.deleted_at IS NULL
      WHERE o.deleted_at IS NULL
        AND o.courier_name IS NOT NULL
        AND TRIM(o.courier_name) != ''
    `;
    const params: any[] = [];

    if (options.courierName) {
      sql += ' AND (LOWER(o.courier_name) = LOWER(?)';
      params.push(options.courierName.trim());
      if (options.courierPhone) {
        sql += ' OR o.courier_phone = ?';
        params.push(options.courierPhone.trim());
      }
      sql += ')';
    }

    if (options.statusFilter === 'active') {
      sql += ` AND LOWER(o.status) NOT LIKE '%selesai%' AND LOWER(o.status) NOT LIKE '%batal%' AND (mos.code IS NULL OR mos.code NOT IN ('pesanan-selesai', 'cancelled'))`;
    } else if (options.statusFilter === 'history') {
      sql += ` AND (LOWER(o.status) LIKE '%selesai%' OR LOWER(o.status) LIKE '%batal%' OR mos.code IN ('pesanan-selesai', 'cancelled'))`;
    }

    sql += ' ORDER BY o.order_date DESC';

    const rows = await query<any>(sql, params);

    return rows.map((r: any) => {
      const rawId = Number(r.id_orders);
      const rawUserId = r.users_id ? Number(r.users_id) : null;
      return {
        ...r,
        id_orders: rawId,
        id: CryptoUtil.encryptId(rawId) ?? String(rawId),
        users_id: rawUserId,
        user_id: rawUserId ? (CryptoUtil.encryptId(rawUserId) ?? String(rawUserId)) : undefined,
      };
    });
  }

  async getCourierTransactions(options: {
    userId?: number | null;
    courierName?: string | null;
    courierPhone?: string | null;
    category?: string | null;
    limit?: number;
  }): Promise<WalletTransactionEntity[]> {
    let resolvedUserId: number | null = options.userId || null;

    if (!resolvedUserId && (options.courierPhone || options.courierName)) {
      const cleanPhone = (options.courierPhone || '').replace(/[^0-9]/g, '');
      const cName = (options.courierName || '').trim();
      const userRes = await query<any>(
        `SELECT id_users FROM users 
         WHERE ((phone IS NOT NULL AND phone != '' AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?) OR LOWER(name_users) = LOWER(?))
           AND deleted_at IS NULL LIMIT 1`,
        [cleanPhone, cName]
      );
      if (userRes && userRes.length > 0) {
        resolvedUserId = Number(userRes[0].id_users);
      }
    }

    if (!resolvedUserId) return [];

    let sql = `
      SELECT 
        wt.id_wallet_transactions,
        wt.users_id,
        wt.orders_id,
        wt.type,
        wt.category,
        wt.amount,
        wt.balance_before,
        wt.balance_after,
        wt.title,
        wt.description,
        wt.reference_no,
        wt.created_at,
        o.invoice_no,
        cust.name_users AS customer_name
      FROM wallet_transactions wt
      LEFT JOIN orders o ON wt.orders_id = o.id_orders
      LEFT JOIN users cust ON o.users_id = cust.id_users
      WHERE wt.users_id = ?
    `;
    const params: any[] = [resolvedUserId];

    if (options.category) {
      sql += ' AND wt.category = ?';
      params.push(options.category);
    }

    sql += ' ORDER BY wt.created_at DESC, wt.id_wallet_transactions DESC';
    if (options.limit && options.limit > 0) {
      sql += ` LIMIT ${Number(options.limit)}`;
    } else {
      sql += ' LIMIT 100';
    }

    const rows = await query<any>(sql, params);

    return rows.map((r: any) => ({
      ...r,
      id: CryptoUtil.encryptId(r.id_wallet_transactions) ?? String(r.id_wallet_transactions),
      user_id: CryptoUtil.encryptId(r.users_id) ?? String(r.users_id),
      order_id: r.orders_id ? (CryptoUtil.encryptId(r.orders_id) ?? String(r.orders_id)) : null,
      amount: Number(r.amount) || 0,
      balance_before: Number(r.balance_before) || 0,
      balance_after: Number(r.balance_after) || 0,
    }));
  }
}

export interface WalletTransactionEntity {
  id?: string | number;
  id_wallet_transactions?: number;
  users_id: number;
  user_id?: string;
  orders_id?: number | null;
  order_id?: string | null;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  title: string;
  description?: string;
  reference_no?: string;
  created_at?: string | Date;
  invoice_no?: string;
  customer_name?: string;
}

