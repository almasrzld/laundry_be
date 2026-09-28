import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';

export interface UserEntity {
  id?: string | number;
  id_users?: string | number;
  name?: string;
  name_users?: string;
  email: string;
  phone: string;
  password?: string;
  role_code?: string;
  member_tier: string;
  laundry_pay_balance: number;
  reward_points: number;
  failed_login_attempts?: number;
  lockout_stage?: number;
  locked_until?: Date | string | null;
  is_permanently_locked?: number | boolean;
  permissions?: string[];
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export class AuthRepository {
  private baseSelect = `
    SELECT id_users, name_users, email, phone, password, role_code, member_tier,
           laundry_pay_balance, reward_points, failed_login_attempts, lockout_stage,
           locked_until, is_permanently_locked, created_at, creator, updated_at,
           update_pic, deleted_at, delete_pic
    FROM users
  `;

  async findByEmail(email: string): Promise<UserEntity | null> {
    const sql = `${this.baseSelect} WHERE email = ? AND deleted_at IS NULL LIMIT 1`;
    const results = await query<UserEntity>(sql, [email]);
    if (results.length === 0) return null;
    const u = results[0];
    return {
      ...u,
      id: u.id_users,
      name: u.name_users,
    };
  }

  async findById(id: string | number): Promise<UserEntity | null> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const sql = `${this.baseSelect} WHERE id_users = ? AND deleted_at IS NULL LIMIT 1`;
    const results = await query<UserEntity>(sql, [numericId]);
    if (results.length === 0) return null;
    const u = results[0];
    return {
      ...u,
      id: u.id_users,
      name: u.name_users,
    };
  }

  async createUser(user: Partial<UserEntity>, creatorPic?: number): Promise<UserEntity> {
    const userName = user.name_users || user.name || '';
    const creatorVal = creatorPic ?? user.creator ?? 0;
    const sql = `
      INSERT INTO users (name_users, email, phone, password, member_tier, laundry_pay_balance, reward_points, created_at, creator)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      userName,
      user.email,
      user.phone,
      user.password,
      user.member_tier || 'REGULAR',
      user.laundry_pay_balance || 0,
      user.reward_points || 0,
      creatorVal,
    ]);

    const newId = res.insertId;
    return (await this.findById(newId))!;
  }

  async findUserByIdentifier(identifier: string): Promise<UserEntity | null> {
    const clean = identifier.trim().toLowerCase();
    const normalize = (p: string) => {
      let d = (p || '').replace(/\D/g, '');
      if (d.startsWith('62')) d = d.slice(2);
      while (d.startsWith('0')) d = d.slice(1);
      return d;
    };
    const normPhone = normalize(clean);

    // 1. Coba cari dengan email persis
    const emailSql = `${this.baseSelect} WHERE LOWER(email) = ? AND deleted_at IS NULL LIMIT 1`;
    const emailResults = await query<UserEntity>(emailSql, [clean]);
    if (emailResults.length > 0) {
      const u = emailResults[0];
      return { ...u, id: u.id_users, name: u.name_users };
    }

    // 2. Coba cari dengan nomor telepon
    const allUsers = await query<UserEntity>(`${this.baseSelect} WHERE deleted_at IS NULL`);
    const matched = allUsers.find(u => {
      if (!u.phone) return false;
      if (u.phone.trim() === identifier.trim()) return true;
      if (normPhone && normalize(u.phone) === normPhone) return true;
      return false;
    });

    if (matched) {
      return { ...matched, id: matched.id_users, name: matched.name_users };
    }

    return null;
  }

  async updatePassword(id: string | number, passwordHash: string, updatePic?: number | null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const res: any = await query('UPDATE users SET password = ?, updated_at = NOW(), update_pic = ? WHERE id_users = ?', [passwordHash, updatePic || null, numericId]);
    return res.affectedRows > 0;
  }

  async recordFailedAttempt(id: string | number, attempts: number): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const res: any = await query(
      'UPDATE users SET failed_login_attempts = ?, updated_at = NOW() WHERE id_users = ?',
      [attempts, numericId]
    );
    return res.affectedRows > 0;
  }

  async recordLockout(
    id: string | number,
    attempts: number,
    stage: number,
    lockedUntil: Date | null,
    isPermanent: boolean = false
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const res: any = await query(
      'UPDATE users SET failed_login_attempts = ?, lockout_stage = ?, locked_until = ?, is_permanently_locked = ?, updated_at = NOW() WHERE id_users = ?',
      [attempts, stage, lockedUntil, isPermanent ? 1 : 0, numericId]
    );
    return res.affectedRows > 0;
  }

  async setPermanentLockout(id: string | number): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const res: any = await query(
      'UPDATE users SET is_permanently_locked = 1, locked_until = NULL, failed_login_attempts = 0, updated_at = NOW() WHERE id_users = ?',
      [numericId]
    );
    return res.affectedRows > 0;
  }

  async resetLockout(id: string | number): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const res: any = await query(
      'UPDATE users SET failed_login_attempts = 0, lockout_stage = 0, locked_until = NULL, is_permanently_locked = 0, updated_at = NOW() WHERE id_users = ?',
      [numericId]
    );
    return res.affectedRows > 0;
  }

  async softDelete(id: string | number, deletePic?: number): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const res: any = await query('UPDATE users SET deleted_at = NOW(), delete_pic = ? WHERE id_users = ?', [deletePic || null, numericId]);
    return res.affectedRows > 0;
  }
}
