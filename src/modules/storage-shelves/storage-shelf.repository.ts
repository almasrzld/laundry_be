import { query } from '../../config/database';
import { StorageShelfEntity } from './storage-shelf.types';

const SHELF_COLUMNS = `
  id_storage_shelves,
  name_storage_shelves,
  shelf_types_id,
  code, capacity, location_notes, is_active,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class StorageShelfRepository {
  async findAll(search?: string): Promise<StorageShelfEntity[]> {
    let sql = `SELECT ${SHELF_COLUMNS} FROM master_storage_shelves WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND (name_storage_shelves LIKE ? OR code LIKE ? OR location_notes LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY id_storage_shelves ASC`;
    return await query<StorageShelfEntity>(sql, params);
  }

  async findById(id: number | string): Promise<StorageShelfEntity | null> {
    const numId = Number(id);
    const sql = `SELECT ${SHELF_COLUMNS} FROM master_storage_shelves WHERE id_storage_shelves = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<StorageShelfEntity>(sql, [numId]);
    return res[0] || null;
  }

  async findByCode(code: string, excludeId?: number | string): Promise<StorageShelfEntity | null> {
    let sql = `SELECT ${SHELF_COLUMNS} FROM master_storage_shelves WHERE LOWER(code) = LOWER(?)`;
    const params: any[] = [code.trim()];

    if (excludeId) {
      sql += ` AND id_storage_shelves != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<StorageShelfEntity>(sql, params);
    return res[0] || null;
  }

  async getNextCode(shelfTypeId: number | string): Promise<string> {
    const prefix = String(Number(shelfTypeId) || 1);
    const sql = `SELECT code FROM master_storage_shelves WHERE code LIKE ?`;
    const rows = await query<{ code: string }>(sql, [`${prefix}%`]);

    let maxSeq = 0;
    const regex = new RegExp(`^${prefix}(\\d{5})$`);

    for (const row of rows) {
      if (!row.code) continue;
      const match = row.code.trim().match(regex);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  async create(data: Partial<StorageShelfEntity>, creator: number | null = null): Promise<StorageShelfEntity> {
    const nameVal = data.name_storage_shelves || (data as any).name;
    const sql = `
      INSERT INTO master_storage_shelves (name_storage_shelves, shelf_types_id, code, capacity, location_notes, is_active, created_at, creator)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      data.shelf_types_id || null,
      data.code,
      data.capacity !== undefined ? Number(data.capacity) : 0,
      data.location_notes || null,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      creator ?? (data as any)?.creator ?? 0,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<StorageShelfEntity>, updatePic: number | null = null): Promise<StorageShelfEntity | null> {
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const nameVal = data.name_storage_shelves !== undefined ? data.name_storage_shelves : (data as any).name !== undefined ? (data as any).name : current.name_storage_shelves;

    const sql = `
      UPDATE master_storage_shelves
      SET name_storage_shelves = ?, shelf_types_id = ?, code = ?, capacity = ?, location_notes = ?, is_active = ?, updated_at = NOW(), update_pic = ?
      WHERE id_storage_shelves = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      data.shelf_types_id !== undefined ? data.shelf_types_id : current.shelf_types_id,
      data.code !== undefined ? data.code : current.code,
      data.capacity !== undefined ? data.capacity : current.capacity,
      data.location_notes !== undefined ? data.location_notes : current.location_notes,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: number | string, deletePic: number | null = null): Promise<boolean> {
    const numId = Number(id);
    const sql = `UPDATE master_storage_shelves SET deleted_at = NOW(), delete_pic = ? WHERE id_storage_shelves = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}
