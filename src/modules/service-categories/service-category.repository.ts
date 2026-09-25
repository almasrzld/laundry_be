import { query } from '../../config/database';
import { ServiceCategoryEntity } from './service-category.types';

const CATEGORY_COLUMNS = `
  id_service_categories,
  name_service_categories,
  code, icon_code, badge_color, description, is_active,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class ServiceCategoryRepository {
  async findAll(search?: string): Promise<ServiceCategoryEntity[]> {
    let sql = `SELECT ${CATEGORY_COLUMNS} FROM master_service_categories WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND (name_service_categories LIKE ? OR code LIKE ? OR description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY id_service_categories ASC`;
    return await query<ServiceCategoryEntity>(sql, params);
  }

  async findById(id: number | string): Promise<ServiceCategoryEntity | null> {
    const numId = Number(id);
    const sql = `SELECT ${CATEGORY_COLUMNS} FROM master_service_categories WHERE id_service_categories = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<ServiceCategoryEntity>(sql, [numId]);
    return res[0] || null;
  }

  async findByCode(code: string, excludeId?: number | string): Promise<ServiceCategoryEntity | null> {
    let sql = `SELECT ${CATEGORY_COLUMNS} FROM master_service_categories WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [code.trim()];

    if (excludeId) {
      sql += ` AND id_service_categories != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<ServiceCategoryEntity>(sql, params);
    return res[0] || null;
  }

  async create(data: Partial<ServiceCategoryEntity>, creator: number | null = null): Promise<ServiceCategoryEntity> {
    const nameVal = data.name_service_categories || (data as any).name;
    const sql = `
      INSERT INTO master_service_categories (name_service_categories, code, icon_code, badge_color, description, is_active, created_at, creator)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      data.code,
      data.icon_code || null,
      data.badge_color || 'primary',
      data.description || null,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      creator ?? (data as any)?.creator ?? 0,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<ServiceCategoryEntity>, updatePic: number | null = null): Promise<ServiceCategoryEntity | null> {
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const nameVal = data.name_service_categories !== undefined ? data.name_service_categories : (data as any).name !== undefined ? (data as any).name : current.name_service_categories;

    const sql = `
      UPDATE master_service_categories
      SET name_service_categories = ?, code = ?, icon_code = ?, badge_color = ?, description = ?, is_active = ?, updated_at = NOW(), update_pic = ?
      WHERE id_service_categories = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      data.code !== undefined ? data.code : current.code,
      data.icon_code !== undefined ? data.icon_code : current.icon_code,
      data.badge_color !== undefined ? data.badge_color : current.badge_color,
      data.description !== undefined ? data.description : current.description,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: number | string, deletePic: number | null = null): Promise<boolean> {
    const numId = Number(id);
    const sql = `UPDATE master_service_categories SET deleted_at = NOW(), delete_pic = ? WHERE id_service_categories = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}
