import { query } from '../../config/database';
import { ShelfTypeEntity } from './shelf-type.types';

const SHELF_TYPE_COLUMNS = `
  id_shelf_types,
  name_shelf_types,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class ShelfTypeRepository {
  private initialized = false;

  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS \`master_shelf_types\` (
          \`id_shelf_types\` INT AUTO_INCREMENT PRIMARY KEY,
          \`name_shelf_types\` VARCHAR(100) NOT NULL,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`creator\` BIGINT UNSIGNED NOT NULL,
          \`updated_at\` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          \`update_pic\` BIGINT UNSIGNED NULL,
          \`deleted_at\` DATETIME NULL,
          \`delete_pic\` BIGINT UNSIGNED NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      this.initialized = true;
    } catch (e) {
      this.initialized = true;
    }
  }

  async findAll(search?: string): Promise<ShelfTypeEntity[]> {
    await this.ensureTable();
    let sql = `SELECT ${SHELF_TYPE_COLUMNS} FROM master_shelf_types WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND name_shelf_types LIKE ?`;
      params.push(`%${search.trim()}%`);
    }

    sql += ` ORDER BY id_shelf_types ASC`;
    return await query<ShelfTypeEntity>(sql, params);
  }

  async findById(id: number | string): Promise<ShelfTypeEntity | null> {
    await this.ensureTable();
    const numId = Number(id);
    const sql = `SELECT ${SHELF_TYPE_COLUMNS} FROM master_shelf_types WHERE id_shelf_types = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<ShelfTypeEntity>(sql, [numId]);
    return res[0] || null;
  }

  async findByName(name: string, excludeId?: number | string): Promise<ShelfTypeEntity | null> {
    await this.ensureTable();
    let sql = `SELECT ${SHELF_TYPE_COLUMNS} FROM master_shelf_types WHERE LOWER(name_shelf_types) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [name.trim()];

    if (excludeId) {
      sql += ` AND id_shelf_types != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<ShelfTypeEntity>(sql, params);
    return res[0] || null;
  }

  async create(data: Partial<ShelfTypeEntity>, creator: number | null = null): Promise<ShelfTypeEntity> {
    await this.ensureTable();
    const nameVal = data.name_shelf_types || (data as any).name;
    const sql = `
      INSERT INTO master_shelf_types (name_shelf_types, created_at, creator)
      VALUES (?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      creator ?? (data as any)?.creator ?? 0,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<ShelfTypeEntity>, updatePic: number | null = null): Promise<ShelfTypeEntity | null> {
    await this.ensureTable();
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const nameVal = data.name_shelf_types !== undefined ? data.name_shelf_types : (data as any).name !== undefined ? (data as any).name : current.name_shelf_types;

    const sql = `
      UPDATE master_shelf_types
      SET name_shelf_types = ?, updated_at = NOW(), update_pic = ?
      WHERE id_shelf_types = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: number | string, deletePic: number | null = null): Promise<boolean> {
    await this.ensureTable();
    const numId = Number(id);
    const sql = `UPDATE master_shelf_types SET deleted_at = NOW(), delete_pic = ? WHERE id_shelf_types = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}
