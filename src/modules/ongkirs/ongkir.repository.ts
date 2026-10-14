import { query } from '../../config/database';
import { OngkirEntity } from './ongkir.types';
import { CryptoUtil } from '../../utils/crypto.util';

const ONGKIR_COLUMNS = `
  id_ongkirs, outlets_id, units_id, name_ongkir, code_ongkir,
  free_radius, base_radius, base_price, step_radius, step_price, max_radius,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class OngkirRepository {
  private async attachRelations(items: OngkirEntity[]): Promise<OngkirEntity[]> {
    if (items.length === 0) return [];

    try {
      const outlets = await query<{
        id_outlets: number;
        name_outlet: string;
        address: string;
        latitude: number;
        longitude: number;
        phone: string | null;
      }>(`SELECT id_outlets, name_outlet, address, latitude, longitude, phone FROM master_outlets WHERE deleted_at IS NULL`);

      const units = await query<{
        id_units: number;
        name_unit: string;
        code_unit: string;
        symbol: string | null;
      }>(`SELECT id_units, name_unit, code_unit, symbol FROM master_units WHERE deleted_at IS NULL`);

      const outletMap = new Map(outlets.map((o) => [Number(o.id_outlets), o]));
      const unitMap = new Map(units.map((u) => [Number(u.id_units), u]));

      for (const item of items) {
        const rawId = Number(item.id_ongkirs ?? item.id);
        item.id = CryptoUtil.encryptId(rawId) ?? String(rawId);
        item.id_ongkirs = rawId;

        item.free_radius = Number(item.free_radius);
        item.base_radius = Number(item.base_radius);
        item.base_price = Number(item.base_price);
        item.step_radius = Number(item.step_radius);
        item.step_price = Number(item.step_price);
        item.max_radius = Number(item.max_radius);

        const o = outletMap.get(Number(item.outlets_id));
        if (o) {
          item.outlet_id = CryptoUtil.encryptId(o.id_outlets) ?? String(o.id_outlets);
          item.outlet_name = o.name_outlet;
          item.outlet_address = o.address;
          item.outlet_latitude = Number(o.latitude);
          item.outlet_longitude = Number(o.longitude);
          item.outlet_phone = o.phone || '';
        } else {
          item.outlet_id = CryptoUtil.encryptId(Number(item.outlets_id)) ?? String(item.outlets_id);
          item.outlet_name = '';
          item.outlet_address = '';
          item.outlet_latitude = 0;
          item.outlet_longitude = 0;
          item.outlet_phone = '';
        }

        const u = unitMap.get(Number(item.units_id));
        if (u) {
          item.unit_id = CryptoUtil.encryptId(u.id_units) ?? String(u.id_units);
          item.unit_name = u.name_unit;
          item.unit_code = u.code_unit;
          item.unit_symbol = u.symbol || u.code_unit;
        } else {
          item.unit_id = CryptoUtil.encryptId(Number(item.units_id)) ?? String(item.units_id);
          item.unit_name = '';
          item.unit_code = '';
          item.unit_symbol = '';
        }
      }
    } catch {
      for (const item of items) {
        const rawId = Number(item.id_ongkirs ?? item.id);
        item.id = CryptoUtil.encryptId(rawId) ?? String(rawId);
        item.id_ongkirs = rawId;
        item.outlet_id = CryptoUtil.encryptId(Number(item.outlets_id)) ?? String(item.outlets_id);
        item.unit_id = CryptoUtil.encryptId(Number(item.units_id)) ?? String(item.units_id);
      }
    }

    return items;
  }

  async findAll(search?: string): Promise<OngkirEntity[]> {
    let sql = `SELECT ${ONGKIR_COLUMNS} FROM master_ongkirs WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND (name_ongkir LIKE ? OR code_ongkir LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY id_ongkirs ASC`;
    const rows = await query<OngkirEntity>(sql, params);
    return await this.attachRelations(rows);
  }

  async findById(id: number | string): Promise<OngkirEntity | null> {
    const numId = Number(id);
    const sql = `SELECT ${ONGKIR_COLUMNS} FROM master_ongkirs WHERE id_ongkirs = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<OngkirEntity>(sql, [numId]);
    if (!res[0]) return null;
    const attached = await this.attachRelations([res[0]]);
    return attached[0] || null;
  }

  async findByOutletId(outletId: number | string, excludeId?: number | string): Promise<OngkirEntity | null> {
    const numOutletId = Number(outletId);
    let sql = `SELECT ${ONGKIR_COLUMNS} FROM master_ongkirs WHERE outlets_id = ? AND deleted_at IS NULL`;
    const params: any[] = [numOutletId];

    if (excludeId) {
      sql += ` AND id_ongkirs != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<OngkirEntity>(sql, params);
    if (!res[0]) return null;
    const attached = await this.attachRelations([res[0]]);
    return attached[0] || null;
  }

  async findByCode(code: string, excludeId?: number | string): Promise<OngkirEntity | null> {
    let sql = `SELECT ${ONGKIR_COLUMNS} FROM master_ongkirs WHERE LOWER(code_ongkir) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [code.trim()];

    if (excludeId) {
      sql += ` AND id_ongkirs != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<OngkirEntity>(sql, params);
    if (!res[0]) return null;
    const attached = await this.attachRelations([res[0]]);
    return attached[0] || null;
  }

  async getNextCode(): Promise<string> {
    const sql = `SELECT code_ongkir FROM master_ongkirs`;
    const rows = await query<{ code_ongkir: string }>(sql);

    let maxSeq = 0;
    const regex = /^(\d{1,3})$/;

    for (const row of rows) {
      if (!row.code_ongkir) continue;
      const match = row.code_ongkir.trim().match(regex);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    const nextSeq = maxSeq + 1;
    return String(nextSeq).padStart(3, '0');
  }

  async create(data: Partial<OngkirEntity>, creator: number | null = null): Promise<OngkirEntity> {
    const sql = `
      INSERT INTO master_ongkirs (
        outlets_id, units_id, name_ongkir, code_ongkir,
        free_radius, base_radius, base_price, step_radius, step_price, max_radius,
        created_at, creator
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      Number(data.outlets_id),
      Number(data.units_id),
      data.name_ongkir,
      data.code_ongkir,
      Number(data.free_radius),
      Number(data.base_radius),
      Number(data.base_price),
      Number(data.step_radius),
      Number(data.step_price),
      Number(data.max_radius),
      creator,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<OngkirEntity>, updatePic: number | null = null): Promise<OngkirEntity | null> {
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const sql = `
      UPDATE master_ongkirs
      SET
        outlets_id = ?,
        units_id = ?,
        name_ongkir = ?,
        code_ongkir = ?,
        free_radius = ?,
        base_radius = ?,
        base_price = ?,
        step_radius = ?,
        step_price = ?,
        max_radius = ?,
        updated_at = NOW(),
        update_pic = ?
      WHERE id_ongkirs = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      data.outlets_id !== undefined ? Number(data.outlets_id) : current.outlets_id,
      data.units_id !== undefined ? Number(data.units_id) : current.units_id,
      data.name_ongkir !== undefined ? data.name_ongkir : current.name_ongkir,
      data.code_ongkir !== undefined ? data.code_ongkir : current.code_ongkir,
      data.free_radius !== undefined ? Number(data.free_radius) : current.free_radius,
      data.base_radius !== undefined ? Number(data.base_radius) : current.base_radius,
      data.base_price !== undefined ? Number(data.base_price) : current.base_price,
      data.step_radius !== undefined ? Number(data.step_radius) : current.step_radius,
      data.step_price !== undefined ? Number(data.step_price) : current.step_price,
      data.max_radius !== undefined ? Number(data.max_radius) : current.max_radius,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: number | string, deletePic: number | null = null): Promise<boolean> {
    const numId = Number(id);
    const sql = `UPDATE master_ongkirs SET deleted_at = NOW(), delete_pic = ? WHERE id_ongkirs = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}
