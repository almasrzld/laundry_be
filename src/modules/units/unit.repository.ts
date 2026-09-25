import { query } from '../../config/database';
import { UnitEntity } from './unit.types';

const UNIT_COLUMNS = `
  id_units,
  name_units,
  code, symbol, description, is_active,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class UnitRepository {
  async findAll(search?: string): Promise<UnitEntity[]> {
    let sql = `SELECT ${UNIT_COLUMNS} FROM master_units WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND (name_units LIKE ? OR code LIKE ? OR symbol LIKE ? OR description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY id_units ASC`;
    return await query<UnitEntity>(sql, params);
  }

  async findById(id: number | string): Promise<UnitEntity | null> {
    const numId = Number(id);
    const sql = `SELECT ${UNIT_COLUMNS} FROM master_units WHERE id_units = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<UnitEntity>(sql, [numId]);
    return res[0] || null;
  }

  async findByCode(code: string, excludeId?: number | string): Promise<UnitEntity | null> {
    let sql = `SELECT ${UNIT_COLUMNS} FROM master_units WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [code.trim()];

    if (excludeId) {
      sql += ` AND id_units != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<UnitEntity>(sql, params);
    return res[0] || null;
  }

  async create(data: Partial<UnitEntity>, creator: number | null = null): Promise<UnitEntity> {
    const nameVal = data.name_units || (data as any).name;
    const sql = `
      INSERT INTO master_units (name_units, code, symbol, description, is_active, created_at, creator)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      data.code,
      data.symbol || data.code,
      data.description || null,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      creator ?? (data as any)?.creator ?? 0,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<UnitEntity>, updatePic: number | null = null): Promise<UnitEntity | null> {
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const nameVal = data.name_units !== undefined ? data.name_units : (data as any).name !== undefined ? (data as any).name : current.name_units;

    const sql = `
      UPDATE master_units
      SET name_units = ?, code = ?, symbol = ?, description = ?, is_active = ?, updated_at = NOW(), update_pic = ?
      WHERE id_units = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      data.code !== undefined ? data.code : current.code,
      data.symbol !== undefined ? data.symbol : current.symbol,
      data.description !== undefined ? data.description : current.description,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: number | string, deletePic: number | null = null): Promise<boolean> {
    const numId = Number(id);
    const sql = `UPDATE master_units SET deleted_at = NOW(), delete_pic = ? WHERE id_units = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}
