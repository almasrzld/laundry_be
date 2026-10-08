import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';
import { OrderEntity } from '../orders/order.repository';
import { NotificationRepository } from '../notifications/notification.repository';

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

export function normalizeBankName(name: string): string {
  if (!name) return '';
  return name.trim();
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
    isPersonalView?: boolean;
  }): Promise<CourierSummaryEntity> {
    const couriersCountRes = await query<any>(`
      SELECT COUNT(u.id_users) AS total_couriers
      FROM users u
      LEFT JOIN roles r ON u.role_code = r.code
      WHERE (u.role_code LIKE '%kurir%' OR u.role_code LIKE '%courier%' OR LOWER(r.name_roles) LIKE '%kurir%')
        AND u.deleted_at IS NULL
    `);

    // Ambil saldo dompet pengguna
    let courierBalance = 0;
    if (options?.userId) {
      const userRes = await query<any>(
        'SELECT laundry_pay_balance FROM users WHERE id_users = ? AND deleted_at IS NULL LIMIT 1',
        [options.userId]
      );
      if (userRes && userRes.length > 0) {
        courierBalance = Number(userRes[0].laundry_pay_balance) || 0;
      }
    }

    // Jika personal view tetapi tidak ada identitas kurir yang cocok (misal customer atau user tanpa tugas)
    if (options?.isPersonalView && !options?.courierName && !options?.courierPhone) {
      return {
        total_couriers: 1,
        active_deliveries: 0,
        completed_deliveries: 0,
        total_tips: 0,
        average_rating: 0,
        laundry_pay_balance: courierBalance,
      };
    }

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
      const cleanName = cName.replace(/\s*\([^)]*\)/g, '').trim();

      const conditions: string[] = [];
      if (cName) {
        conditions.push('LOWER(o.courier_name) = LOWER(?)');
        params.push(cName);
        if (cleanName && cleanName.toLowerCase() !== cName.toLowerCase()) {
          conditions.push('LOWER(o.courier_name) = LOWER(?)');
          params.push(cleanName);
        }
      }
      if (cleanPhone.length > 5) {
        conditions.push("REPLACE(REPLACE(o.courier_phone, '-', ''), ' ', '') = ?");
        params.push(cleanPhone);
      }

      if (conditions.length > 0) {
        ordersSql += ` AND (${conditions.join(' OR ')})`;
      }
    }

    const ordersStatsRes = await query<any>(ordersSql, params);
    const cCount = Number(couriersCountRes[0]?.total_couriers) || 0;
    const stats = ordersStatsRes[0] || {};

    return {
      total_couriers: options?.isPersonalView || options?.courierName || options?.courierPhone ? 1 : cCount,
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
    isPersonalView?: boolean;
  }): Promise<OrderEntity[]> {
    // Jika personal view tetapi tidak ada identitas kurir yang cocok, jangan bocorkan tugas kurir lain
    if (options.isPersonalView && !options.courierName && !options.courierPhone) {
      return [];
    }

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

    if (options.courierName || options.courierPhone) {
      const cleanPhone = (options.courierPhone || '').replace(/[^0-9]/g, '');
      const cName = (options.courierName || '').trim();
      const cleanName = cName.replace(/\s*\([^)]*\)/g, '').trim();

      const conditions: string[] = [];
      if (cName) {
        conditions.push('LOWER(o.courier_name) = LOWER(?)');
        params.push(cName);
        if (cleanName && cleanName.toLowerCase() !== cName.toLowerCase()) {
          conditions.push('LOWER(o.courier_name) = LOWER(?)');
          params.push(cleanName);
        }
      }
      if (cleanPhone.length > 5) {
        conditions.push("REPLACE(REPLACE(o.courier_phone, '-', ''), ' ', '') = ?");
        params.push(cleanPhone);
      }

      if (conditions.length > 0) {
        sql += ` AND (${conditions.join(' OR ')})`;
      }
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

  async requestWithdrawal(
    userId: string | number,
    amount: number,
    bankName: string,
    accountNumber: string,
    accountName: string,
    notes?: string,
  ): Promise<any> {
    let resolvedUserId: number | null = null;
    if (typeof userId === 'string') {
      resolvedUserId = CryptoUtil.decryptId(userId);
      if (!resolvedUserId && /^\d+$/.test(userId)) {
        resolvedUserId = parseInt(userId, 10);
      }
    } else {
      resolvedUserId = userId;
    }

    if (!resolvedUserId) throw new Error('Identitas kurir tidak valid');

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 10000) {
      throw new Error('Minimal penarikan dana adalah Rp 10.000');
    }

    const cleanBank = normalizeBankName(bankName);

    const userRes = await query<any>(
      'SELECT id_users, name_users, laundry_pay_balance FROM users WHERE id_users = ? AND deleted_at IS NULL LIMIT 1',
      [resolvedUserId],
    );
    if (!userRes || userRes.length === 0) {
      throw new Error('Data kurir tidak ditemukan');
    }

    const currentBal = Number(userRes[0].laundry_pay_balance) || 0;
    if (currentBal < numAmount) {
      throw new Error(`Saldo tidak mencukupi. Saldo saat ini: Rp ${currentBal.toLocaleString('id-ID')}`);
    }

    const newBal = currentBal - numAmount;
    await query('UPDATE users SET laundry_pay_balance = ? WHERE id_users = ?', [newBal, resolvedUserId]);

    const ref = `WD-${Date.now()}`;
    await query(
      `INSERT INTO wallet_transactions 
       (users_id, type, category, amount, balance_before, balance_after, title, description, reference_no, created_at)
       VALUES (?, 'debit', 'withdrawal', ?, ?, ?, ?, ?, ?, NOW())`,
      [
        resolvedUserId,
        numAmount,
        currentBal,
        newBal,
        `Penarikan Dana (${cleanBank})`,
        `Penarikan ke rekening ${accountNumber} a.n. ${accountName}`,
        ref,
      ],
    );

    const insertRes: any = await query(
      `INSERT INTO withdrawal_requests 
       (users_id, amount, bank_name, account_number, account_name, status, admin_notes, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [resolvedUserId, numAmount, cleanBank, accountNumber, accountName, notes || null],
    );

    const insertedId = insertRes?.insertId;

    // Kirim notifikasi real-time ke Admin Web dan konfirmasi ke Kurir
    try {
      const notifRepo = new NotificationRepository();
      const formattedAmt = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(numAmount);

      // 1. Notifikasi ke Admin Web (target_role: 'admin')
      await notifRepo.create({
        target_role: 'admin',
        title: 'Pengajuan Penarikan Dana (WD)',
        message: `Kurir ${userRes[0].name_users || 'Kurir'} mengajukan penarikan dana sebesar ${formattedAmt} ke rekening ${cleanBank} (${accountNumber} a.n ${accountName}).`,
        type: 'withdrawal_requested',
        data: {
          withdrawal_id: insertedId,
          courier_id: resolvedUserId,
          courier_name: userRes[0].name_users,
          amount: numAmount,
          bank_name: cleanBank,
          account_number: accountNumber,
          account_name: accountName,
        },
        created_pic: resolvedUserId,
      });

      // 2. Notifikasi konfirmasi ke Kurir Mobile
      await notifRepo.create({
        users_id: resolvedUserId,
        title: 'Pengajuan Penarikan Dana Terkirim',
        message: `Pengajuan penarikan dana sebesar ${formattedAmt} ke rekening ${cleanBank} (${accountNumber}) sedang diproses oleh admin.`,
        type: 'withdrawal_submitted',
        data: {
          withdrawal_id: insertedId,
          amount: numAmount,
          bank_name: cleanBank,
          account_number: accountNumber,
        },
        created_pic: resolvedUserId,
      });
    } catch (notifErr) {
      console.error('[Notification] Gagal mengirim notifikasi pengajuan penarikan:', notifErr);
    }

    return {
      id: CryptoUtil.encryptId(insertedId) ?? String(insertedId),
      amount: numAmount,
      bank_name: cleanBank,
      account_number: accountNumber,
      account_name: accountName,
      status: 'pending',
      balance_remaining: newBal,
    };
  }

  async getCourierWithdrawals(userId: string | number): Promise<any[]> {
    let resolvedUserId: number | null = null;
    if (typeof userId === 'string') {
      resolvedUserId = CryptoUtil.decryptId(userId);
      if (!resolvedUserId && /^\d+$/.test(userId)) {
        resolvedUserId = parseInt(userId, 10);
      }
    } else {
      resolvedUserId = userId;
    }

    if (!resolvedUserId) return [];

    const rows = await query<any>(
      `SELECT 
        id_withdrawal_requests, 
        users_id, 
        amount, 
        bank_name, 
        account_number, 
        account_name, 
        status, 
        admin_notes, 
        processed_at, 
        created_at 
       FROM withdrawal_requests 
       WHERE users_id = ? 
       ORDER BY created_at DESC, id_withdrawal_requests DESC`,
      [resolvedUserId],
    );

    return rows.map((r) => ({
      ...r,
      bank_name: normalizeBankName(r.bank_name),
      id: CryptoUtil.encryptId(r.id_withdrawal_requests) ?? String(r.id_withdrawal_requests),
      user_id: CryptoUtil.encryptId(r.users_id) ?? String(r.users_id),
      amount: Number(r.amount) || 0,
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

