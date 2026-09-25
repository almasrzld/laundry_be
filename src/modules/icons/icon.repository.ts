import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';

export interface IconEntity {
  id?: number | string;
  id_icons?: number | string;
  name?: string;
  name_icons?: string;
  code: string;
  category: string;
  description?: string | null;
  is_active: boolean | number;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

const ICON_COLUMNS = `
  id_icons, name_icons, code, category, description, is_active, created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class IconRepository {
  async findAll(category?: string, search?: string): Promise<IconEntity[]> {
    let sql = `
      SELECT ${ICON_COLUMNS}
      FROM icons
      WHERE deleted_at IS NULL
    `;
    const params: any[] = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (search && search.trim().length > 0) {
      sql += ' AND (name_icons LIKE ? OR code LIKE ? OR description LIKE ? OR category LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY id_icons ASC';

    return await query<IconEntity>(sql, params);
  }

  async findById(id: string | number): Promise<IconEntity | null> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const sql = `
      SELECT ${ICON_COLUMNS}
      FROM icons
      WHERE id_icons = ? AND deleted_at IS NULL
      LIMIT 1
    `;
    const results = await query<IconEntity>(sql, [numericId]);
    return results[0] || null;
  }

  async findByCode(code: string, excludeId?: string | number): Promise<IconEntity | null> {
    let sql = 'SELECT id_icons, name_icons, code FROM icons WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL';
    const params: any[] = [code.trim()];

    if (excludeId) {
      const numericId = CryptoUtil.decryptId(excludeId) ?? excludeId;
      sql += ' AND id_icons != ?';
      params.push(numericId);
    }

    sql += ' LIMIT 1';
    const results = await query<IconEntity>(sql, params);
    return results[0] || null;
  }

  async create(data: Partial<IconEntity>, creatorPic: number | null = null): Promise<IconEntity> {
    const nameVal = data.name_icons || data.name;
    const sql = `
      INSERT INTO icons (name_icons, code, category, description, is_active, created_at, creator)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      data.code,
      data.category || 'Laundry',
      data.description || null,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      creatorPic ?? (data as any)?.creator ?? 0,
    ]);

    const newId = res.insertId;
    return (await this.findById(newId))!;
  }

  async update(id: string | number, data: Partial<IconEntity>, updatePic: number | null = null): Promise<IconEntity | null> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const current = await this.findById(numericId);
    if (!current) return null;

    const nameVal = data.name_icons !== undefined ? data.name_icons : data.name !== undefined ? data.name : current.name_icons;

    const sql = `
      UPDATE icons
      SET name_icons = ?, code = ?, category = ?, description = ?, is_active = ?, updated_at = NOW(), update_pic = ?
      WHERE id_icons = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      data.code !== undefined ? data.code : current.code,
      data.category !== undefined ? data.category : current.category,
      data.description !== undefined ? data.description : current.description,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
      updatePic,
      numericId,
    ]);

    return await this.findById(numericId);
  }

  async softDelete(id: string | number, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const sql = 'UPDATE icons SET deleted_at = NOW(), delete_pic = ? WHERE id_icons = ? AND deleted_at IS NULL';
    const res: any = await query(sql, [deletePic, numericId]);
    return res.affectedRows > 0;
  }
}
