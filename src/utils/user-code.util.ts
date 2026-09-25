/**
 * Helper Auto-generate Kode User Backend Almas Laundry
 * Format: AABBCCCCC
 * - AA    : Kode role (start 10, bertambah kelipatan 5: 10, 15, 20, 25, 30..., dinamis sesuai master role)
 * - BB    : 2 digit tahun pendaftaran akun (contoh: 2026 -> 26)
 * - CCCCC : 5 digit nomor urut / ID pengguna (contoh: ID 1 -> 00001)
 *
 * Catatan: Murni dinamis berdasarkan data master roles di database, tanpa hardcode nama role.
 */

import { CryptoUtil } from "./crypto.util";

const dynamicRoleMap = new Map<string, string>();

export class UserCodeUtil {
  /**
   * Menghasilkan kode role 2 digit secara dinamis sesuai posisi master role
   */
  static getRoleCodeNumber(
    roleIdentifier?: string | null,
    roles?: Array<{ id?: number | string; id_roles?: number | string; code: string; name?: string; name_roles?: string }>
  ): string {
    if (!roleIdentifier) return '10';
    const normalized = String(roleIdentifier).toLowerCase().trim();

    // 1. Cari index role pada list master roles dari database (urut pembuatan terlama / pertama kali dibuat)
    if (roles && roles.length > 0) {
      const chronologicallySorted = [...roles].sort((a, b) => {
        const timeA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
        const timeB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
        if (timeA > 0 && timeB > 0 && timeA !== timeB) {
          return timeA - timeB;
        }
        const idA = typeof (a.id_roles ?? a.id) === 'number' ? (a.id_roles ?? a.id) : parseInt(String(a.id_roles ?? a.id ?? ''), 10) || 0;
        const idB = typeof (b.id_roles ?? b.id) === 'number' ? (b.id_roles ?? b.id) : parseInt(String(b.id_roles ?? b.id ?? ''), 10) || 0;
        return (idA as number) - (idB as number);
      });

      const idx = chronologicallySorted.findIndex(
        (r) =>
          r.code?.toLowerCase().trim() === normalized ||
          String(r.id_roles ?? r.id) === normalized ||
          ((r.name_roles || r.name) && (r.name_roles || r.name)!.toLowerCase().trim() === normalized)
      );
      if (idx !== -1) {
        const codeStr = String(10 + idx * 5).padStart(2, '0');
        dynamicRoleMap.set(normalized, codeStr);
        return codeStr;
      }
    }

    // 2. Cek runtime map jika sudah pernah dipetakan
    if (dynamicRoleMap.has(normalized)) {
      return dynamicRoleMap.get(normalized)!;
    }

    // 3. Jika berupa angka ID numerik
    const numericId = parseInt(normalized, 10);
    if (!isNaN(numericId) && numericId > 0) {
      const codeStr = String(10 + (numericId - 1) * 5).padStart(2, '0');
      dynamicRoleMap.set(normalized, codeStr);
      return codeStr;
    }

    // 4. Daftarkan secara dinamis sesuai urutan kedatangan role baru
    const baseOffset = roles && roles.length > 0 ? roles.length : 0;
    const newIndex = baseOffset + dynamicRoleMap.size;
    const dynamicallyAssigned = String(10 + newIndex * 5).padStart(2, '0');
    dynamicRoleMap.set(normalized, dynamicallyAssigned);

    return dynamicallyAssigned;
  }

  static getYearCode(createdAt?: Date | string | null): string {
    if (createdAt) {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) {
        return String(d.getFullYear()).slice(-2);
      }
    }
    return String(new Date().getFullYear()).slice(-2);
  }

  static getSequenceCode(seq?: number | string | null): string {
    let num = typeof seq === 'number' ? seq : parseInt(String(seq || ''), 10);
    if (isNaN(num) || num <= 0) {
      num = 1;
    }
    return String(num).padStart(5, '0');
  }

  static generate(
    user: { id?: number | string; id_users?: number | string; role_code?: string; created_at?: Date | string | null },
    roles?: Array<{ id?: number | string; id_roles?: number | string; code: string; name?: string; name_roles?: string }>,
    roleSequence?: number
  ): string {
    const aa = UserCodeUtil.getRoleCodeNumber(user.role_code, roles);
    const bb = UserCodeUtil.getYearCode(user.created_at);
    const ccccc = UserCodeUtil.getSequenceCode(roleSequence ?? user.id_users ?? user.id);
    return `${aa}${bb}${ccccc}`;
  }

  private static userCodeCache = new Map<number, number>();

  static resolveUserCode(
    user?: {
      id?: string | number;
      id_users?: string | number;
      role?: string;
      role_code?: string;
      user_code?: string | number;
      created_at?: Date | string | null;
    } | null,
    roles?: Array<{ id?: number | string; id_roles?: number | string; code: string; name?: string; name_roles?: string }>
  ): number | null {
    if (!user || (!user.id && !user.id_users)) return null;

    if (user.user_code && /^\d{9}$/.test(String(user.user_code))) {
      return Number(user.user_code);
    }
    const rawVal = user.id_users ?? user.id;
    const rawId = CryptoUtil.decryptId(rawVal) ?? rawVal;
    const numericId = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);

    if (!isNaN(numericId) && UserCodeUtil.userCodeCache.has(numericId)) {
      return UserCodeUtil.userCodeCache.get(numericId)!;
    }

    if (rawId && /^\d{9}$/.test(String(rawId))) {
      return Number(rawId);
    }

    const codeStr = UserCodeUtil.generate(
      {
        id: rawId,
        id_users: rawId,
        role_code: user.role_code || user.role,
        created_at: user.created_at,
      },
      roles
    );
    const parsed = Number(codeStr);
    return isNaN(parsed) ? null : parsed;
  }

  static async resolveUserCodeAsync(
    user?: {
      id?: string | number;
      id_users?: string | number;
      role?: string;
      role_code?: string;
      user_code?: string | number;
      created_at?: Date | string | null;
    } | null
  ): Promise<number | null> {
    if (!user || (!user.id && !user.id_users)) return null;

    if (user.user_code && /^\d{9}$/.test(String(user.user_code))) {
      return Number(user.user_code);
    }

    const rawVal = user.id_users ?? user.id;
    const rawId = CryptoUtil.decryptId(rawVal) ?? rawVal;
    const numericId = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);

    if (!isNaN(numericId) && UserCodeUtil.userCodeCache.has(numericId)) {
      return UserCodeUtil.userCodeCache.get(numericId)!;
    }

    try {
      const { query } = await import('../config/database');
      const userRows = await query<any>(
        'SELECT id_users, role_code, created_at FROM users WHERE id_users = ? LIMIT 1',
        [numericId]
      );
      if (userRows.length > 0) {
        const u = userRows[0];
        const countRes = await query<any>(
          'SELECT COUNT(*) AS seq FROM users WHERE role_code = ? AND (created_at < ? OR (created_at = ? AND id_users <= ?))',
          [u.role_code, u.created_at, u.created_at, u.id_users]
        );
        const seq = Number(countRes[0]?.seq || 1);
        const roles = await query<any>(
          'SELECT id_roles, name_roles, code, created_at FROM roles WHERE deleted_at IS NULL ORDER BY created_at ASC'
        );
        const generatedStr = UserCodeUtil.generate(u, roles, seq);
        const codeNum = Number(generatedStr);
        if (!isNaN(codeNum) && !isNaN(numericId)) {
          UserCodeUtil.userCodeCache.set(numericId, codeNum);
          return codeNum;
        }
      }
    } catch (_) {}

    return UserCodeUtil.resolveUserCode(user);
  }
}

export const getPicId = (req: any): number | null => {
  return UserCodeUtil.resolveUserCode(req?.user);
};
