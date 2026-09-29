import bcrypt from 'bcryptjs';
import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';
import { UserEntity } from '../auth/auth.repository';
import { isCustomerRole, getPermissionsForRole } from '../../utils/role.util';

export interface AddressEntity {
  id?: string | number;
  id_addresses?: string | number;
  user_id?: string | number;
  users_id?: string | number;
  label: string;
  full_address: string;
  note?: string;
  is_default: boolean;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface SecurityQuestionsEntity {
  question_1: string;
  question_2: string;
}

export interface SecurityQuestionsWithAnswersEntity extends SecurityQuestionsEntity {
  answer_1: string;
  answer_2: string;
}

export class UserRepository {
  async getProfile(userId: string | number): Promise<(UserEntity & { has_security_questions: boolean; is_customer: boolean; security_questions?: SecurityQuestionsEntity; permissions?: string[] }) | null> {
    const numericId = CryptoUtil.decryptId(userId) ?? userId;
    const results = await query<UserEntity>(
      'SELECT id_users, name_users, email, phone, role_code, status, member_tier, laundry_pay_balance, reward_points, created_at, creator, updated_at, update_pic, deleted_at, delete_pic FROM users WHERE id_users = ? AND deleted_at IS NULL LIMIT 1',
      [numericId]
    );
    if (results.length === 0) return null;
    const user = results[0];

    const sq = await this.getSecurityQuestions(numericId);
    const isCustomer = await isCustomerRole(user.role_code);
    const permissions = await getPermissionsForRole(user.role_code);

    return {
      ...user,
      has_security_questions: Boolean(sq),
      is_customer: isCustomer,
      security_questions: sq || undefined,
      permissions,
    };
  }

  async getSecurityQuestions(userId: string | number): Promise<SecurityQuestionsEntity | null> {
    const numericId = CryptoUtil.decryptId(userId) ?? userId;
    const rows = await query<any>(
      'SELECT question_1, question_2 FROM user_security_questions WHERE users_id = ? AND deleted_at IS NULL LIMIT 1',
      [numericId]
    );
    if (rows.length === 0) return null;
    return {
      question_1: rows[0].question_1,
      question_2: rows[0].question_2,
    };
  }

  async getSecurityQuestionsWithAnswers(userId: string | number): Promise<SecurityQuestionsWithAnswersEntity | null> {
    const numericId = CryptoUtil.decryptId(userId) ?? userId;
    const rows = await query<any>(
      'SELECT question_1, answer_1, question_2, answer_2 FROM user_security_questions WHERE users_id = ? AND deleted_at IS NULL LIMIT 1',
      [numericId]
    );
    if (rows.length === 0) return null;
    return {
      question_1: rows[0].question_1,
      answer_1: rows[0].answer_1,
      question_2: rows[0].question_2,
      answer_2: rows[0].answer_2,
    };
  }

  async saveSecurityQuestions(
    userId: string | number,
    q1: string,
    a1: string,
    q2: string,
    a2: string,
    picId?: number | null
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(userId) ?? userId;
    const existing = await query<any>(
      'SELECT id_user_security_questions FROM user_security_questions WHERE users_id = ? AND deleted_at IS NULL LIMIT 1',
      [numericId]
    );

    const cleanQ1 = q1.trim();
    const cleanQ2 = q2.trim();
    const cleanA1 = a1.trim().toLowerCase();
    const cleanA2 = a2.trim().toLowerCase();

    if (!cleanQ1 || !cleanQ2) {
      throw new Error('Pertanyaan keamanan 1 dan 2 wajib diisi');
    }
    if (cleanQ1.toLowerCase() === cleanQ2.toLowerCase()) {
      throw new Error('Pertanyaan keamanan 1 dan 2 tidak boleh sama');
    }
    if (cleanA1.length < 2 || cleanA2.length < 2) {
      throw new Error('Jawaban pertanyaan keamanan minimal 2 karakter');
    }

    const hashedA1 = bcrypt.hashSync(cleanA1, 10);
    const hashedA2 = bcrypt.hashSync(cleanA2, 10);
    const creatorVal = picId ?? 0;

    if (existing.length > 0) {
      await query(
        'UPDATE user_security_questions SET question_1 = ?, answer_1 = ?, question_2 = ?, answer_2 = ?, updated_at = NOW(), update_pic = ? WHERE users_id = ? AND deleted_at IS NULL',
        [cleanQ1, hashedA1, cleanQ2, hashedA2, picId || null, numericId]
      );
    } else {
      await query(
        'INSERT INTO user_security_questions (users_id, question_1, answer_1, question_2, answer_2, created_at, creator) VALUES (?, ?, ?, ?, ?, NOW(), ?)',
        [numericId, cleanQ1, hashedA1, cleanQ2, hashedA2, creatorVal]
      );
    }
    return true;
  }

  async getAddresses(userId: string | number): Promise<AddressEntity[]> {
    const numericId = CryptoUtil.decryptId(userId) ?? userId;
    const results = await query<AddressEntity>(
      'SELECT id_addresses, users_id, label, full_address, note, is_default, created_at, creator, updated_at, update_pic, deleted_at, delete_pic FROM addresses WHERE users_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, updated_at DESC, id_addresses DESC',
      [numericId]
    );
    return results;
  }

  async addAddress(userId: string | number, address: Partial<AddressEntity>, creatorPic?: number): Promise<AddressEntity> {
    const numericUserId = CryptoUtil.decryptId(userId) ?? userId;
    const creatorVal = creatorPic ?? address.creator ?? 0;
    const label = address.label || 'Alamat';
    const fullAddress = address.full_address || '';
    const note = address.note || '';
    const isDefault = address.is_default ? 1 : 0;

    if (isDefault === 1) {
      await query(
        'UPDATE addresses SET is_default = 0 WHERE users_id = ? AND deleted_at IS NULL',
        [numericUserId]
      );
    }

    const res: any = await query(
      'INSERT INTO addresses (users_id, label, full_address, note, is_default, created_at, creator) VALUES (?, ?, ?, ?, ?, NOW(), ?)',
      [numericUserId, label, fullAddress, note, isDefault, creatorVal]
    );

    const insertedId = res.insertId;
    return {
      id: insertedId,
      id_addresses: insertedId,
      user_id: numericUserId,
      users_id: numericUserId,
      label,
      full_address: fullAddress,
      note,
      is_default: Boolean(isDefault),
      created_at: new Date(),
      creator: creatorVal,
      deleted_at: null,
      delete_pic: null,
    };
  }

  async updateProfile(userId: string | number, data: Partial<UserEntity>, updatePic?: number | null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(userId) ?? userId;

    // Check email duplicate if changed
    if (data.email && data.email.trim()) {
      const email = data.email.trim().toLowerCase();
      const dup = await query<any>(
        'SELECT id_users FROM users WHERE LOWER(email) = LOWER(?) AND id_users != ? AND deleted_at IS NULL LIMIT 1',
        [email, numericId]
      );
      if (dup.length > 0) {
        throw new Error('Email sudah terdaftar oleh pengguna lain');
      }
    }

    // Check phone duplicate if changed
    if (data.phone && data.phone.trim()) {
      const normalize = (p: string) => {
        let d = (p || '').replace(/\D/g, '');
        if (d.startsWith('62')) d = d.slice(2);
        while (d.startsWith('0')) d = d.slice(1);
        return d;
      };
      const targetNorm = normalize(data.phone);
      if (targetNorm) {
        const allUsers = await query<any>(
          'SELECT id_users, phone FROM users WHERE id_users != ? AND deleted_at IS NULL',
          [numericId]
        );
        const isDup = allUsers.some(u => normalize(u.phone) === targetNorm);
        if (isDup) {
          throw new Error('Nomor HP sudah terdaftar oleh pengguna lain');
        }
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    const userName = data.name_users ?? data.name;
    if (userName) { fields.push('name_users = ?'); values.push(userName); }
    if (data.phone) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.email) { fields.push('email = ?'); values.push(data.email); }

    fields.push('updated_at = NOW()');
    fields.push('update_pic = ?');
    values.push(updatePic || null);

    values.push(numericId);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id_users = ? AND deleted_at IS NULL`, values);
    return true;
  }

  async changePassword(
    userId: string | number,
    oldPass: string,
    newPass: string,
    updatePic?: number | null,
    securityQuestions?: { question_1: string; answer_1: string; question_2: string; answer_2: string }
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(userId) ?? userId;
    const rows = await query<any>('SELECT password, role_code FROM users WHERE id_users = ? AND deleted_at IS NULL LIMIT 1', [numericId]);
    if (!rows || rows.length === 0) {
      throw new Error('Pengguna tidak ditemukan');
    }
    const currentHash = rows[0].password;
    const roleCode = rows[0].role_code;

    if (!bcrypt.compareSync(oldPass, currentHash)) {
      throw new Error('Password saat ini (lama) tidak sesuai');
    }

    const isCustomer = await isCustomerRole(roleCode);
    const existingSQ = await this.getSecurityQuestions(numericId);

    // Jika user adalah role pelanggan dan belum memiliki pertanyaan keamanan, WAJIB diisi saat pertama kali ganti password
    if (isCustomer && !existingSQ) {
      if (!securityQuestions || !securityQuestions.question_1 || !securityQuestions.answer_1 || !securityQuestions.question_2 || !securityQuestions.answer_2) {
        throw new Error('Akun pelanggan wajib melengkapi 2 Pertanyaan Keamanan untuk pertama kali ganti password');
      }
      await this.saveSecurityQuestions(
        numericId,
        securityQuestions.question_1,
        securityQuestions.answer_1,
        securityQuestions.question_2,
        securityQuestions.answer_2,
        updatePic
      );
    } else if (securityQuestions && securityQuestions.question_1 && securityQuestions.answer_1 && securityQuestions.question_2 && securityQuestions.answer_2) {
      // Jika pertanyaan keamanan dikirim saat sudah pernah dibuat, lakukan update
      await this.saveSecurityQuestions(
        numericId,
        securityQuestions.question_1,
        securityQuestions.answer_1,
        securityQuestions.question_2,
        securityQuestions.answer_2,
        updatePic
      );
    }

    const newHash = bcrypt.hashSync(newPass.trim(), 10);
    await query(
      'UPDATE users SET password = ?, failed_login_attempts = 0, lockout_stage = 0, locked_until = NULL, is_permanently_locked = 0, updated_at = NOW(), update_pic = ? WHERE id_users = ?',
      [newHash, updatePic || null, numericId]
    );
    return true;
  }

  async updateAddress(id: string | number, address: Partial<AddressEntity>, updatePic?: number): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const label = address.label || 'Alamat';
    const fullAddress = address.full_address || '';
    const note = address.note || '';
    const isDefault = address.is_default !== undefined ? (address.is_default ? 1 : 0) : null;

    if (isDefault === 1) {
      const ownerRows = await query<any>(
        'SELECT users_id FROM addresses WHERE id_addresses = ? AND deleted_at IS NULL LIMIT 1',
        [numericId]
      );
      if (ownerRows.length > 0) {
        await query(
          'UPDATE addresses SET is_default = 0 WHERE users_id = ? AND deleted_at IS NULL',
          [ownerRows[0].users_id]
        );
      }
    }

    let sql = 'UPDATE addresses SET label = ?, full_address = ?, note = ?, updated_at = NOW(), update_pic = ?';
    const params: any[] = [label, fullAddress, note, updatePic || null];

    if (isDefault !== null) {
      sql += ', is_default = ?';
      params.push(isDefault);
    }

    sql += ' WHERE id_addresses = ? AND deleted_at IS NULL';
    params.push(numericId);

    const res: any = await query(sql, params);
    return res.affectedRows > 0;
  }

  async softDeleteAddress(id: string | number, deletePic?: number): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const addr = await query<any>('SELECT users_id, is_default FROM addresses WHERE id_addresses = ? LIMIT 1', [numericId]);
    const res: any = await query('UPDATE addresses SET deleted_at = NOW(), delete_pic = ? WHERE id_addresses = ?', [deletePic || null, numericId]);
    if (addr.length > 0 && addr[0].is_default === 1) {
      await query(
        'UPDATE addresses SET is_default = 1 WHERE users_id = ? AND deleted_at IS NULL ORDER BY id_addresses DESC LIMIT 1',
        [addr[0].users_id]
      );
    }
    return res.affectedRows > 0;
  }

  async addRewardPoints(
    userId: string | number,
    points: number,
    orderId?: string | number | null,
    title?: string,
    description?: string
  ): Promise<boolean> {
    const numericUserId = CryptoUtil.decryptId(userId) ?? Number(userId);
    const numericOrderId = orderId ? (CryptoUtil.decryptId(orderId) ?? Number(orderId)) : null;
    if (!numericUserId || points <= 0) return false;

    await query(
      'UPDATE users SET reward_points = COALESCE(reward_points, 0) + ? WHERE id_users = ? AND deleted_at IS NULL',
      [points, numericUserId]
    );

    try {
      await query(
        `INSERT INTO point_histories (users_id, orders_id, points, type, title, description)
         VALUES (?, ?, ?, 'earn', ?, ?)`,
        [
          numericUserId,
          numericOrderId,
          points,
          title || `Reward Pesanan Selesai (+${points} Poin)`,
          description || `Poin reward otomatis dari transaksi laundry`,
        ]
      );
    } catch (e) {
      console.warn('[PointHistory Warning] Gagal menyimpan riwayat poin:', e);
    }

    return true;
  }

  async deductRewardPoints(
    userId: string | number,
    points: number,
    title?: string,
    description?: string
  ): Promise<boolean> {
    const numericUserId = CryptoUtil.decryptId(userId) ?? Number(userId);
    if (!numericUserId || points <= 0) return false;

    const res: any = await query(
      'UPDATE users SET reward_points = reward_points - ? WHERE id_users = ? AND reward_points >= ? AND deleted_at IS NULL',
      [points, numericUserId, points]
    );

    if (res.affectedRows > 0) {
      try {
        await query(
          `INSERT INTO point_histories (users_id, points, type, title, description)
           VALUES (?, ?, 'redeem', ?, ?)`,
          [
            numericUserId,
            points,
            title || `Penukaran Poin (-${points} Poin)`,
            description || `Poin ditukarkan dengan voucher diskon`,
          ]
        );
      } catch (e) {
        console.warn('[PointHistory Warning] Gagal menyimpan riwayat penukaran poin:', e);
      }
      return true;
    }
    return false;
  }

  async getPointHistories(userId: string | number): Promise<PointHistoryEntity[]> {
    const numericUserId = CryptoUtil.decryptId(userId) ?? Number(userId);
    if (!numericUserId) return [];

    try {
      const rows = await query<any>(
        'SELECT id_point_histories, users_id, orders_id, points, type, title, description, created_at FROM point_histories WHERE users_id = ? ORDER BY id_point_histories DESC LIMIT 50',
        [numericUserId]
      );
      return rows.map(r => ({
        ...r,
        id: CryptoUtil.encryptId(r.id_point_histories) ?? String(r.id_point_histories),
        user_id: CryptoUtil.encryptId(r.users_id) ?? String(r.users_id),
        order_id: r.orders_id ? (CryptoUtil.encryptId(r.orders_id) ?? String(r.orders_id)) : null,
      }));
    } catch (_) {
      return [];
    }
  }

  async getWalletTransactions(userId: string | number, limit: number = 50): Promise<any[]> {
    const numericUserId = CryptoUtil.decryptId(userId) ?? Number(userId);
    if (!numericUserId) return [];

    try {
      const rows = await query<any>(
        `SELECT 
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
           o.invoice_no
         FROM wallet_transactions wt
         LEFT JOIN orders o ON wt.orders_id = o.id_orders
         WHERE wt.users_id = ?
         ORDER BY wt.created_at DESC, wt.id_wallet_transactions DESC
         LIMIT ?`,
        [numericUserId, Number(limit) || 50]
      );

      return rows.map(r => ({
        ...r,
        id: CryptoUtil.encryptId(r.id_wallet_transactions) ?? String(r.id_wallet_transactions),
        user_id: CryptoUtil.encryptId(r.users_id) ?? String(r.users_id),
        order_id: r.orders_id ? (CryptoUtil.encryptId(r.orders_id) ?? String(r.orders_id)) : null,
        amount: Number(r.amount) || 0,
        balance_before: Number(r.balance_before) || 0,
        balance_after: Number(r.balance_after) || 0,
      }));
    } catch (_) {
      return [];
    }
  }
}

export interface PointHistoryEntity {
  id?: number | string;
  id_point_histories?: number | string;
  user_id?: number | string;
  users_id?: number | string;
  order_id?: number | string | null;
  orders_id?: number | string | null;
  points: number;
  type: 'earn' | 'redeem';
  title: string;
  description?: string | null;
  created_at?: Date | string;
}
