import { query } from "../../config/database";
import { UnitEntity } from "./unit.types";

const UNIT_COLUMNS = `
  id_units,
  name_unit,
  code_unit, symbol, description, is_active,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class UnitRepository {
  async findAll(search?: string): Promise<UnitEntity[]> {
    let sql = `SELECT ${UNIT_COLUMNS} FROM master_units WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND (name_unit LIKE ? OR code_unit LIKE ? OR symbol LIKE ? OR description LIKE ?)`;
      params.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
      );
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

  async findByCode(
    code: string,
    excludeId?: number | string,
  ): Promise<UnitEntity | null> {
    let sql = `SELECT ${UNIT_COLUMNS} FROM master_units WHERE LOWER(code_unit) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [code.trim()];

    if (excludeId) {
      sql += ` AND id_units != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<UnitEntity>(sql, params);
    return res[0] || null;
  }

  async create(
    data: Partial<UnitEntity>,
    creator: number | null = null,
  ): Promise<UnitEntity> {
    const sql = `
      INSERT INTO master_units (name_unit, code_unit, symbol, description, is_active, created_at, creator)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      data.name_unit,
      data.code_unit,
      data.symbol,
      data.description,
      data.is_active,
      creator,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(
    id: number | string,
    data: Partial<UnitEntity>,
    updatePic: number | null = null,
  ): Promise<UnitEntity | null> {
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const sql = `
      UPDATE master_units
      SET name_unit = ?, code_unit = ?, symbol = ?, description = ?, is_active = ?, updated_at = NOW(), update_pic = ?
      WHERE id_units = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      data.name_unit !== undefined ? data.name_unit : current.name_unit,
      data.code_unit !== undefined ? data.code_unit : current.code_unit,
      data.symbol !== undefined ? data.symbol : current.symbol,
      data.description !== undefined ? data.description : current.description,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(
    id: number | string,
    deletePic: number | null = null,
  ): Promise<boolean> {
    const numId = Number(id);
    const sql = `UPDATE master_units SET deleted_at = NOW(), delete_pic = ? WHERE id_units = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}
