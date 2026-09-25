import { query } from '../../config/database';
import { PerfumeEntity } from './perfume.types';

const PERFUME_COLUMNS = `
  id_perfumes,
  name_perfumes,
  code, scent_type, description, is_active,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class PerfumeRepository {
  async findAll(search?: string): Promise<PerfumeEntity[]> {
    let sql = `SELECT ${PERFUME_COLUMNS} FROM master_perfumes WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND (name_perfumes LIKE ? OR code LIKE ? OR scent_type LIKE ? OR description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY id_perfumes ASC`;
    return await query<PerfumeEntity>(sql, params);
  }

  async findById(id: number | string): Promise<PerfumeEntity | null> {
    const numId = Number(id);
    const sql = `SELECT ${PERFUME_COLUMNS} FROM master_perfumes WHERE id_perfumes = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<PerfumeEntity>(sql, [numId]);
    return res[0] || null;
  }

  async findByCode(code: string, excludeId?: number | string): Promise<PerfumeEntity | null> {
    let sql = `SELECT ${PERFUME_COLUMNS} FROM master_perfumes WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [code.trim()];

    if (excludeId) {
      sql += ` AND id_perfumes != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<PerfumeEntity>(sql, params);
    return res[0] || null;
  }

  async create(data: Partial<PerfumeEntity>, creator: number | null = null): Promise<PerfumeEntity> {
    const nameVal = data.name_perfumes || (data as any).name;
    const sql = `
      INSERT INTO master_perfumes (name_perfumes, code, scent_type, description, is_active, created_at, creator)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      data.code,
      data.scent_type || null,
      data.description || null,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      creator ?? (data as any)?.creator ?? 0,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<PerfumeEntity>, updatePic: number | null = null): Promise<PerfumeEntity | null> {
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const nameVal = data.name_perfumes !== undefined ? data.name_perfumes : (data as any).name !== undefined ? (data as any).name : current.name_perfumes;

    const sql = `
      UPDATE master_perfumes
      SET name_perfumes = ?, code = ?, scent_type = ?, description = ?, is_active = ?, updated_at = NOW(), update_pic = ?
      WHERE id_perfumes = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      data.code !== undefined ? data.code : current.code,
      data.scent_type !== undefined ? data.scent_type : current.scent_type,
      data.description !== undefined ? data.description : current.description,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: number | string, deletePic: number | null = null): Promise<boolean> {
    const numId = Number(id);
    const sql = `UPDATE master_perfumes SET deleted_at = NOW(), delete_pic = ? WHERE id_perfumes = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}
