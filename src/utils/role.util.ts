import { query } from '../config/database';

/**
 * Memeriksa apakah suatu role merupakan role pelanggan/customer secara dinamis
 * tanpa melakukan hardcode statis kaku.
 */
export async function isCustomerRole(roleCode?: string | null): Promise<boolean> {
  if (!roleCode) return false;
  const clean = String(roleCode).toLowerCase().trim();
  if (clean === 'customer' || clean === 'pelanggan') return true;

  try {
    const roles = await query<any>('SELECT code, name_roles FROM roles WHERE deleted_at IS NULL');
    const matched = roles.find((r) => (r.code || '').toLowerCase() === clean);
    if (matched) {
      const name = (matched.name_roles || '').toLowerCase();
      return (
        name.includes('pelanggan') ||
        name.includes('customer') ||
        clean === 'customer' ||
        clean === 'pelanggan'
      );
    }
  } catch (_) {}

  return clean.includes('pelanggan') || clean.includes('customer');
}
