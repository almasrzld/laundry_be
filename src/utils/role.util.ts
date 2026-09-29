import { query } from '../config/database';

interface RoleRecord {
  code: string;
  name_roles: string;
}

let cachedRoles: RoleRecord[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 detik cache untuk performa tinggi

export async function getActiveRoles(): Promise<RoleRecord[]> {
  const now = Date.now();
  if (cachedRoles && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedRoles;
  }
  try {
    const rows = await query<RoleRecord>('SELECT code, name_roles FROM roles WHERE deleted_at IS NULL');
    cachedRoles = rows || [];
    lastCacheTime = now;
    return cachedRoles;
  } catch (error) {
    return cachedRoles || [];
  }
}

export function invalidateRoleCache(): void {
  cachedRoles = null;
  lastCacheTime = 0;
}

/**
 * Memeriksa apakah suatu role merupakan role pelanggan/customer secara dinamis
 * berdasarkan data tabel roles di database tanpa hardcoding kaku.
 */
export async function isCustomerRole(roleCode?: string | null): Promise<boolean> {
  if (!roleCode) return false;
  const clean = String(roleCode).toLowerCase().trim();
  if (clean === 'customer' || clean === 'pelanggan') return true;

  try {
    const roles = await getActiveRoles();
    const matched = roles.find((r) => (r.code || '').toLowerCase().trim() === clean);
    if (matched) {
      const name = (matched.name_roles || '').toLowerCase();
      return (
        name.includes('pelanggan') ||
        name.includes('customer') ||
        clean.includes('customer') ||
        clean.includes('pelanggan')
      );
    }
  } catch (_) {}

  return clean.includes('pelanggan') || clean.includes('customer');
}

/**
 * Memeriksa apakah suatu role merupakan role kurir/delivery secara dinamis
 * berdasarkan data tabel roles di database tanpa hardcoding kaku.
 */
export async function isCourierRole(roleCode?: string | null): Promise<boolean> {
  if (!roleCode) return false;
  const clean = String(roleCode).toLowerCase().trim();
  if (clean === 'kurir' || clean === 'courier') return true;

  try {
    const roles = await getActiveRoles();
    const matched = roles.find((r) => (r.code || '').toLowerCase().trim() === clean);
    if (matched) {
      const name = (matched.name_roles || '').toLowerCase();
      return (
        name.includes('kurir') ||
        name.includes('courier') ||
        name.includes('driver') ||
        name.includes('delivery') ||
        clean.includes('kurir') ||
        clean.includes('courier')
      );
    }
  } catch (_) {}

  return clean.includes('kurir') || clean.includes('courier') || clean.includes('driver');
}

/**
 * Memeriksa apakah suatu role merupakan staf/admin operasional secara dinamis
 * (semua role internal yang bertugas memproses operasional, bukan customer dan bukan kurir).
 */
export async function isAdminOrStaffRole(roleCode?: string | null): Promise<boolean> {
  if (!roleCode) return false;
  const isCust = await isCustomerRole(roleCode);
  if (isCust) return false;
  const isCour = await isCourierRole(roleCode);
  if (isCour) return false;
  return true;
}

/**
 * Mengambil daftar kode hak akses (permissions) aktif untuk suatu role secara dinamis dari database.
 */
export async function getPermissionsForRole(roleCode?: string | null): Promise<string[]> {
  if (!roleCode || roleCode.trim() === '') return [];
  const clean = roleCode.trim().toLowerCase();
  try {
    const rows = await query<{ code: string }>(
      `SELECT DISTINCT p.code 
       FROM role_permissions rp
       JOIN permissions p ON rp.permissions_id = p.id_permissions
       JOIN roles r ON rp.roles_id = r.id_roles
       WHERE (LOWER(r.code) = LOWER(?) OR LOWER(r.name_roles) = LOWER(?) OR r.id_roles = ?)
         AND rp.deleted_at IS NULL AND p.deleted_at IS NULL AND r.deleted_at IS NULL`,
      [clean, clean, clean]
    );
    return (rows || []).map((r) => r.code);
  } catch (err) {
    console.warn('[RoleUtil Warning] Gagal memuat permissions untuk role:', roleCode, err);
    return [];
  }
}
