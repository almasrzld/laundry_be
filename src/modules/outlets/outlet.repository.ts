import { query } from '../../config/database';
import { OutletEntity } from './outlet.types';
import { CryptoUtil } from '../../utils/crypto.util';

const OUTLET_COLUMNS = `
  id_outlets, name_outlet, address, latitude, longitude, phone,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class OutletRepository {
  private formatItem(item: any): OutletEntity {
    const rawId = Number(item.id_outlets ?? item.id);
    const usedCount = Number(item.used_count || 0);
    return {
      ...item,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      id_outlets: rawId,
      latitude: String(item.latitude || ''),
      longitude: String(item.longitude || ''),
      used_count: usedCount,
      is_used: usedCount > 0,
    };
  }

  async findAll(search?: string): Promise<OutletEntity[]> {
    let sql = `
      SELECT 
        o.id_outlets, o.name_outlet, o.address, o.latitude, o.longitude, o.phone,
        o.created_at, o.creator, o.updated_at, o.update_pic, o.deleted_at, o.delete_pic,
        (SELECT COUNT(*) FROM master_ongkirs mo WHERE mo.outlets_id = o.id_outlets AND mo.deleted_at IS NULL) AS used_count
      FROM master_outlets o
      WHERE o.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND (o.name_outlet LIKE ? OR o.address LIKE ? OR o.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY o.id_outlets ASC`;
    const rows = await query<OutletEntity>(sql, params);
    return rows.map((r) => this.formatItem(r));
  }

  async findById(id: number | string): Promise<OutletEntity | null> {
    const numId = Number(id);
    const sql = `
      SELECT 
        o.id_outlets, o.name_outlet, o.address, o.latitude, o.longitude, o.phone,
        o.created_at, o.creator, o.updated_at, o.update_pic, o.deleted_at, o.delete_pic,
        (SELECT COUNT(*) FROM master_ongkirs mo WHERE mo.outlets_id = o.id_outlets AND mo.deleted_at IS NULL) AS used_count
      FROM master_outlets o
      WHERE o.id_outlets = ? AND o.deleted_at IS NULL
      LIMIT 1
    `;
    const res = await query<OutletEntity>(sql, [numId]);
    if (!res[0]) return null;
    return this.formatItem(res[0]);
  }

  async create(data: Partial<OutletEntity>, creator: number | null = null): Promise<OutletEntity> {
    const sql = `
      INSERT INTO master_outlets (name_outlet, address, latitude, longitude, phone, created_at, creator)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      data.name_outlet,
      data.address,
      String(data.latitude || ''),
      String(data.longitude || ''),
      data.phone || null,
      creator,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<OutletEntity>, updatePic: number | null = null): Promise<OutletEntity | null> {
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const sql = `
      UPDATE master_outlets
      SET name_outlet = ?, address = ?, latitude = ?, longitude = ?, phone = ?, updated_at = NOW(), update_pic = ?
      WHERE id_outlets = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      data.name_outlet !== undefined ? data.name_outlet : current.name_outlet,
      data.address !== undefined ? data.address : current.address,
      data.latitude !== undefined ? String(data.latitude) : current.latitude,
      data.longitude !== undefined ? String(data.longitude) : current.longitude,
      data.phone !== undefined ? data.phone : current.phone,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: number | string, deletePic: number | null = null): Promise<boolean> {
    const numId = Number(id);
    const sql = `UPDATE master_outlets SET deleted_at = NOW(), delete_pic = ? WHERE id_outlets = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}

