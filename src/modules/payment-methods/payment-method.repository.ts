import { query } from '../../config/database';
import { PaymentMethodEntity } from './payment-method.types';

const PAYMENT_COLUMNS = `
  id_payment_methods,
  name_payment_methods,
  code, type, account_number, account_name, description, is_active,
  created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class PaymentMethodRepository {
  async findAll(search?: string, type?: string): Promise<PaymentMethodEntity[]> {
    let sql = `SELECT ${PAYMENT_COLUMNS} FROM master_payment_methods WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (type && type !== 'all') {
      sql += ` AND type = ?`;
      params.push(type);
    }

    if (search && search.trim().length > 0) {
      sql += ` AND (name_payment_methods LIKE ? OR code LIKE ? OR account_number LIKE ? OR account_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY id_payment_methods ASC`;
    return await query<PaymentMethodEntity>(sql, params);
  }

  async findById(id: number | string): Promise<PaymentMethodEntity | null> {
    const numId = Number(id);
    const sql = `SELECT ${PAYMENT_COLUMNS} FROM master_payment_methods WHERE id_payment_methods = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<PaymentMethodEntity>(sql, [numId]);
    return res[0] || null;
  }

  async findByCode(code: string, excludeId?: number | string): Promise<PaymentMethodEntity | null> {
    let sql = `SELECT ${PAYMENT_COLUMNS} FROM master_payment_methods WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [code.trim()];

    if (excludeId) {
      sql += ` AND id_payment_methods != ?`;
      params.push(Number(excludeId));
    }

    sql += ` LIMIT 1`;
    const res = await query<PaymentMethodEntity>(sql, params);
    return res[0] || null;
  }

  async create(data: Partial<PaymentMethodEntity>, creator: number | null = null): Promise<PaymentMethodEntity> {
    const nameVal = data.name_payment_methods || (data as any).name;
    const sql = `
      INSERT INTO master_payment_methods (name_payment_methods, code, type, account_number, account_name, description, is_active, created_at, creator)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      data.code,
      data.type || 'cash',
      data.account_number || null,
      data.account_name || null,
      data.description || null,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      creator ?? (data as any)?.creator ?? 0,
    ]);

    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<PaymentMethodEntity>, updatePic: number | null = null): Promise<PaymentMethodEntity | null> {
    const numId = Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const nameVal = data.name_payment_methods !== undefined ? data.name_payment_methods : (data as any).name !== undefined ? (data as any).name : current.name_payment_methods;

    const sql = `
      UPDATE master_payment_methods
      SET name_payment_methods = ?, code = ?, type = ?, account_number = ?, account_name = ?, description = ?, is_active = ?, updated_at = NOW(), update_pic = ?
      WHERE id_payment_methods = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      data.code !== undefined ? data.code : current.code,
      data.type !== undefined ? data.type : current.type,
      data.account_number !== undefined ? data.account_number : current.account_number,
      data.account_name !== undefined ? data.account_name : current.account_name,
      data.description !== undefined ? data.description : current.description,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
      updatePic,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: number | string, deletePic: number | null = null): Promise<boolean> {
    const numId = Number(id);
    const sql = `UPDATE master_payment_methods SET deleted_at = NOW(), delete_pic = ? WHERE id_payment_methods = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic, numId]);
    return res.affectedRows > 0;
  }
}
