import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';

export interface PromoEntity {
  id?: number | string;
  id_promos?: number | string;
  title?: string;
  name?: string;
  name_promos?: string;
  subtitle: string;
  code: string;
  discount_amount: number;
  min_order_amount: number;
  icon_code: string;
  color_hex: number;
  is_active?: boolean;
  created_at?: Date | string;
  creator?: number;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

const PROMO_COLUMNS = `
  id_promos, name_promos, subtitle, code, discount_amount, min_order_amount, icon_code, color_hex, is_active, created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class PromoRepository {
  async findAll(search?: string): Promise<PromoEntity[]> {
    let sql = `SELECT ${PROMO_COLUMNS} FROM promos WHERE deleted_at IS NULL`;
    const params: any[] = [];
    if (search && search.trim().length > 0) {
      sql += ` AND (name_promos LIKE ? OR code LIKE ? OR subtitle LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY id_promos DESC`;
    return await query<PromoEntity>(sql, params);
  }

  async findById(id: number | string): Promise<PromoEntity | null> {
    const numId = CryptoUtil.decryptId(id) ?? Number(id);
    const sql = `SELECT ${PROMO_COLUMNS} FROM promos WHERE id_promos = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<PromoEntity>(sql, [numId]);
    return res[0] || null;
  }

  async findByCode(code: string, excludeId?: number | string): Promise<PromoEntity | null> {
    let sql = `SELECT ${PROMO_COLUMNS} FROM promos WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [code.trim()];
    if (excludeId) {
      const numId = CryptoUtil.decryptId(excludeId) ?? Number(excludeId);
      sql += ` AND id_promos != ?`;
      params.push(numId);
    }
    sql += ` LIMIT 1`;
    const res = await query<PromoEntity>(sql, params);
    return res[0] || null;
  }

  async create(data: Partial<PromoEntity>, creator: number | null = null): Promise<PromoEntity> {
    const nameVal = data.name_promos || data.title || data.name || '';
    const creatorVal = creator ?? (data as any)?.creator ?? 0;
    const sql = `
      INSERT INTO promos (name_promos, subtitle, code, discount_amount, min_order_amount, icon_code, color_hex, is_active, created_at, creator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      data.subtitle || '',
      data.code ? data.code.toUpperCase() : '',
      data.discount_amount || 0,
      data.min_order_amount || 0,
      data.icon_code || 'ticket',
      data.color_hex || 4278412487,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      creatorVal,
    ]);
    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<PromoEntity>, updatePic: number | null = null): Promise<PromoEntity | null> {
    const numId = CryptoUtil.decryptId(id) ?? Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const nameVal = data.name_promos !== undefined ? data.name_promos : data.title !== undefined ? data.title : data.name !== undefined ? data.name : current.name_promos;
    const updatePicVal = updatePic ?? (data as any)?.update_pic ?? null;

    const sql = `
      UPDATE promos
      SET name_promos = ?, subtitle = ?, code = ?, discount_amount = ?, min_order_amount = ?, icon_code = ?, color_hex = ?, is_active = ?, updated_at = NOW(), update_pic = ?
      WHERE id_promos = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      data.subtitle !== undefined ? data.subtitle : current.subtitle,
      data.code !== undefined ? data.code.toUpperCase() : current.code,
      data.discount_amount !== undefined ? data.discount_amount : current.discount_amount,
      data.min_order_amount !== undefined ? data.min_order_amount : current.min_order_amount,
      data.icon_code !== undefined ? data.icon_code : current.icon_code,
      data.color_hex !== undefined ? data.color_hex : current.color_hex,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
      updatePicVal,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: string | number, deletePic?: number | null): Promise<boolean> {
    const numId = CryptoUtil.decryptId(id) ?? Number(id);
    const sql = `UPDATE promos SET deleted_at = NOW(), delete_pic = ? WHERE id_promos = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic ?? null, numId]);
    return res.affectedRows > 0;
  }
}
