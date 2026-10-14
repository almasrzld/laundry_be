import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';

export type PromoCategory = 'Event' | 'Reward Point' | string;
export type PromoBenefitType = 'Potongan Harga' | 'Bebas Ongkir' | 'Potongan Ongkir' | string;
export type PromoDiscountType = 'Nominal' | 'Persen' | string;

export function normalizeCategory(val?: string): 'Event' | 'Reward Point' {
  if (!val) return 'Event';
  const clean = val.trim().toLowerCase();
  if (clean === 'reward point' || clean === 'reward_point' || clean === 'reward') return 'Reward Point';
  return 'Event';
}

export function normalizeBenefitType(val?: string): 'Potongan Harga' | 'Bebas Ongkir' | 'Potongan Ongkir' {
  if (!val) return 'Potongan Harga';
  const clean = val.trim().toLowerCase();
  if (clean === 'bebas ongkir' || clean === 'bebas_ongkir' || clean === 'free delivery' || clean === 'free_delivery' || clean === 'gratis ongkir') return 'Bebas Ongkir';
  if (clean === 'potongan ongkir' || clean === 'potongan_ongkir' || clean === 'delivery discount' || clean === 'delivery_discount') return 'Potongan Ongkir';
  return 'Potongan Harga';
}

export function normalizeDiscountType(val?: string): 'Nominal' | 'Persen' {
  if (!val) return 'Nominal';
  const clean = val.trim().toLowerCase();
  if (clean === 'persen' || clean === 'percent' || clean === 'percentage') return 'Persen';
  return 'Nominal';
}

export interface PromoEntity {
  id?: number | string;
  id_promos?: number | string;
  title?: string;
  name?: string;
  name_promos?: string;
  subtitle: string;
  code: string;
  category: PromoCategory;
  benefit_type: PromoBenefitType;
  discount_type: PromoDiscountType;
  discount_amount: number;
  max_discount?: number | null;
  min_order_amount: number;
  points_required: number;
  start_date: string;
  end_date: string;
  icon_code: string;
  color_hex: number;
  is_active?: boolean;
  created_at?: Date | string;
  creator?: number;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface PromoFilterOptions {
  search?: string;
  category?: string;
  activeOnly?: boolean;
}

const PROMO_COLUMNS = `
  id_promos, 
  name_promos, 
  subtitle, 
  code, 
  category,
  benefit_type,
  discount_type,
  discount_amount, 
  max_discount,
  min_order_amount, 
  points_required,
  DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
  DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
  icon_code, 
  color_hex, 
  is_active, 
  created_at, 
  creator, 
  updated_at, 
  update_pic, 
  deleted_at, 
  delete_pic
`;

export class PromoRepository {
  async findAll(options?: PromoFilterOptions | string): Promise<PromoEntity[]> {
    let search = '';
    let category: string | undefined;
    let activeOnly = false;

    if (typeof options === 'string') {
      search = options;
    } else if (options && typeof options === 'object') {
      search = options.search || '';
      category = options.category;
      activeOnly = Boolean(options.activeOnly);
    }

    let sql = `SELECT ${PROMO_COLUMNS} FROM promos WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search && search.trim().length > 0) {
      sql += ` AND (name_promos LIKE ? OR code LIKE ? OR subtitle LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (category && category.trim().length > 0 && category.toLowerCase() !== 'all') {
      const normalizedCat = normalizeCategory(category);
      sql += ` AND (category = ? OR LOWER(category) = LOWER(?))`;
      params.push(normalizedCat, category.trim());
    }

    if (activeOnly) {
      sql += ` AND (start_date IS NULL OR start_date <= CURDATE()) AND (end_date IS NULL OR end_date >= CURDATE())`;
    }

    sql += ` ORDER BY id_promos DESC`;
    return await query<PromoEntity>(sql, params);
  }

  async findById(id: number | string): Promise<PromoEntity | null> {
    const numId = CryptoUtil.decryptId(id) ?? Number(id);
    const sql = `SELECT ${PROMO_COLUMNS} FROM promos WHERE id_promos = ? AND deleted_at IS NULL LIMIT 1`;
    const res = await query<PromoEntity>(sql, [numId]);
    return res[0] || null;
  }

  async findByCode(code: string, excludeId?: number | string): Promise<PromoEntity | null> {
    let sql = `SELECT ${PROMO_COLUMNS} FROM promos WHERE LOWER(code) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [code.trim()];
    if (excludeId) {
      const numId = CryptoUtil.decryptId(excludeId) ?? Number(excludeId);
      sql += ` AND id_promos != ?`;
      params.push(numId);
    }
    sql += ` LIMIT 1`;
    const res = await query<PromoEntity>(sql, params);
    return res[0] || null;
  }

  async create(data: Partial<PromoEntity>, creator: number | null = null): Promise<PromoEntity> {
    const nameVal = data.name_promos || data.title || data.name || '';
    const creatorVal = creator ?? (data as any)?.creator ?? 0;
    const category = normalizeCategory(data.category);
    const benefitType = normalizeBenefitType(data.benefit_type);
    const discountType = normalizeDiscountType(data.discount_type);
    const discountAmount = Number(data.discount_amount) || 0;
    const maxDiscount = data.max_discount !== undefined && data.max_discount !== null ? Number(data.max_discount) : null;
    const minOrderAmount = Number(data.min_order_amount) || 0;
    const pointsRequired = Number(data.points_required) || 0;
    const startDate = data.start_date ? String(data.start_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const endDate = data.end_date ? String(data.end_date).slice(0, 10) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const isActive = (!startDate || startDate <= today) && (!endDate || endDate >= today) ? 1 : 0;

    const sql = `
      INSERT INTO promos (
        name_promos, subtitle, code, category, benefit_type, discount_type,
        discount_amount, max_discount, min_order_amount, points_required,
        start_date, end_date, icon_code, color_hex, is_active, created_at, creator
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const res: any = await query(sql, [
      nameVal,
      data.subtitle || '',
      data.code ? data.code.toUpperCase() : '',
      category,
      benefitType,
      discountType,
      discountAmount,
      maxDiscount,
      minOrderAmount,
      pointsRequired,
      startDate,
      endDate,
      data.icon_code || 'ticket',
      data.color_hex || 4278412487,
      isActive,
      creatorVal,
    ]);
    return (await this.findById(res.insertId))!;
  }

  async update(id: number | string, data: Partial<PromoEntity>, updatePic: number | null = null): Promise<PromoEntity | null> {
    const numId = CryptoUtil.decryptId(id) ?? Number(id);
    const current = await this.findById(numId);
    if (!current) return null;

    const nameVal = data.name_promos !== undefined ? data.name_promos : data.title !== undefined ? data.title : data.name !== undefined ? data.name : current.name_promos;
    const updatePicVal = updatePic ?? (data as any)?.update_pic ?? null;

    const category = data.category !== undefined ? normalizeCategory(data.category) : current.category;
    const benefitType = data.benefit_type !== undefined ? normalizeBenefitType(data.benefit_type) : current.benefit_type;
    const discountType = data.discount_type !== undefined ? normalizeDiscountType(data.discount_type) : current.discount_type;
    const discountAmount = data.discount_amount !== undefined ? Number(data.discount_amount) : current.discount_amount;
    const maxDiscount = data.max_discount !== undefined ? (data.max_discount !== null ? Number(data.max_discount) : null) : current.max_discount;
    const minOrderAmount = data.min_order_amount !== undefined ? Number(data.min_order_amount) : current.min_order_amount;
    const pointsRequired = data.points_required !== undefined ? Number(data.points_required) : current.points_required;
    const startDate = data.start_date !== undefined ? String(data.start_date).slice(0, 10) : current.start_date;
    const endDate = data.end_date !== undefined ? String(data.end_date).slice(0, 10) : current.end_date;
    const today = new Date().toISOString().slice(0, 10);
    const isActive = (!startDate || startDate <= today) && (!endDate || endDate >= today) ? 1 : 0;

    const sql = `
      UPDATE promos
      SET name_promos = ?, subtitle = ?, code = ?, category = ?, benefit_type = ?, discount_type = ?,
          discount_amount = ?, max_discount = ?, min_order_amount = ?, points_required = ?,
          start_date = ?, end_date = ?, icon_code = ?, color_hex = ?, is_active = ?,
          updated_at = NOW(), update_pic = ?
      WHERE id_promos = ? AND deleted_at IS NULL
    `;
    await query(sql, [
      nameVal,
      data.subtitle !== undefined ? data.subtitle : current.subtitle,
      data.code !== undefined ? data.code.toUpperCase() : current.code,
      category,
      benefitType,
      discountType,
      discountAmount,
      maxDiscount,
      minOrderAmount,
      pointsRequired,
      startDate,
      endDate,
      data.icon_code !== undefined ? data.icon_code : current.icon_code,
      data.color_hex !== undefined ? data.color_hex : current.color_hex,
      isActive,
      updatePicVal,
      numId,
    ]);

    return await this.findById(numId);
  }

  async softDelete(id: string | number, deletePic?: number | null): Promise<boolean> {
    const numId = CryptoUtil.decryptId(id) ?? Number(id);
    const sql = `UPDATE promos SET deleted_at = NOW(), delete_pic = ? WHERE id_promos = ? AND deleted_at IS NULL`;
    const res: any = await query(sql, [deletePic ?? null, numId]);
    return res.affectedRows > 0;
  }
}
