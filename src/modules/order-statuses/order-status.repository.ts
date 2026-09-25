import { query } from '../../config/database';
import { OrderStatusEntity } from './order-status.types';

const STATUS_COLUMNS = `
  id_order_statuses,
  name_order_statuses,
  code, step_order, color_hex, badge_variant, description, is_active,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class OrderStatusRepository {
  async findAll(search?: string): Promise<OrderStatusEntity[]> {
    let sql = `SELECT ${STATUS_COLUMNS} FROM master_order_statuses WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND (name_order_statuses LIKE ? OR code LIKE ? OR description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY step_order ASC, id_order_statuses ASC`;
    return await query<OrderStatusEntity>(sql, params);
  }

  async findById(id: number | string): Promise<OrderStatusEntity | null> {
    const numId = Number(id);
    const sql = `SELECT ${STATUS_COLUMNS} FROM master_order_statuses WHERE id_order_statuses = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<OrderStatusEntity>(sql, [numId]);
    return res[0] || null;
  }

  async findByCode(code: string, excludeId?: number | string): Promise<OrderStatusEntity | null> {
    let sql = `SELECT ${STATUS_COLUMNS} FROM master_order_statuses WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [code.trim()];

    if (excludeId) {
      sql += ` AND id_order_statuses != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<OrderStatusEntity>(sql, params);
    return res[0] || null;
  }

  async create(data: Partial<OrderStatusEntity>, creator: number | null = null): Promise<OrderStatusEntity> {
    const nameVal = data.name_order_statuses || (data as any).name;
    const sql = `
      INSERT INTO master_order_statuses (name_order_statuses, code, step_order, color_hex, badge_variant, description, is_active, created_at, creator)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      data.code,
      data.step_order || 1,
      data.color_hex || '#0284c7',
      data.badge_variant || 'info',
      data.description || null,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      creator ?? (data as any)?.creator ?? 0,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<OrderStatusEntity>, updatePic: number | null = null): Promise<OrderStatusEntity | null> {
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const nameVal = data.name_order_statuses !== undefined ? data.name_order_statuses : (data as any).name !== undefined ? (data as any).name : current.name_order_statuses;

    const sql = `
      UPDATE master_order_statuses
      SET name_order_statuses = ?, code = ?, step_order = ?, color_hex = ?, badge_variant = ?, description = ?, is_active = ?, updated_at = NOW(), update_pic = ?
      WHERE id_order_statuses = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      data.code !== undefined ? data.code : current.code,
      data.step_order !== undefined ? data.step_order : current.step_order,
      data.color_hex !== undefined ? data.color_hex : current.color_hex,
      data.badge_variant !== undefined ? data.badge_variant : current.badge_variant,
      data.description !== undefined ? data.description : current.description,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: number | string, deletePic: number | null = null): Promise<boolean> {
    const numId = Number(id);
    const sql = `UPDATE master_order_statuses SET deleted_at = NOW(), delete_pic = ? WHERE id_order_statuses = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}
