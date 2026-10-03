import { PromoRepository, PromoEntity, PromoFilterOptions, normalizeCategory, normalizeBenefitType, normalizeDiscountType } from './promo.repository';
import { CryptoUtil } from '../../utils/crypto.util';
import { PromoGeneratorUtil } from '../../utils/promo-generator.util';

export class PromoService {
  private promoRepository: PromoRepository;

  constructor(promoRepository?: PromoRepository) {
    this.promoRepository = promoRepository || new PromoRepository();
  }

  private formatPromo(p: PromoEntity): PromoEntity {
    const rawId = Number(p.id_promos ?? p.id);
    const startDate = p.start_date ? String(p.start_date).slice(0, 10) : '';
    const endDate = p.end_date ? String(p.end_date).slice(0, 10) : '';
    const today = new Date().toISOString().slice(0, 10);
    const isActive = (!startDate || startDate <= today) && (!endDate || endDate >= today);

    return {
      ...p,
      id_promos: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name_promos: p.name_promos ?? p.title ?? p.name,
      title: p.name_promos ?? p.title ?? p.name,
      name: p.name_promos ?? p.title ?? p.name,
      category: normalizeCategory(p.category),
      benefit_type: normalizeBenefitType(p.benefit_type),
      discount_type: normalizeDiscountType(p.discount_type),
      discount_amount: Number(p.discount_amount) || 0,
      max_discount: p.max_discount !== undefined && p.max_discount !== null ? Number(p.max_discount) : null,
      min_order_amount: Number(p.min_order_amount) || 0,
      points_required: Number(p.points_required) || 0,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive,
    };
  }

  async generatePromoCode(mode: 'sequence' | 'random' = 'sequence'): Promise<string> {
    return await PromoGeneratorUtil.generatePromoCode({ mode });
  }

  async getAllPromos(options?: PromoFilterOptions | string): Promise<PromoEntity[]> {
    const list = await this.promoRepository.findAll(options);
    return list.map((p) => this.formatPromo(p));
  }

  async getPromoById(id: string | number): Promise<PromoEntity | null> {
    const promo = await this.promoRepository.findById(id);
    return promo ? this.formatPromo(promo) : null;
  }

  private validatePromoData(data: Partial<PromoEntity>) {
    if (data.start_date && data.end_date) {
      const s = new Date(data.start_date);
      const e = new Date(data.end_date);
      if (e < s) {
        throw new Error('Tanggal berakhir promo tidak boleh lebih awal dari tanggal mulai');
      }
    }

    const discountType = data.discount_type ? normalizeDiscountType(data.discount_type) : undefined;
    if (discountType === 'Persen' && data.discount_amount !== undefined) {
      const pct = Number(data.discount_amount);
      if (pct <= 0 || pct > 100) {
        throw new Error('Persentase diskon harus bernilai antara 1% hingga 100%');
      }
    }

    const category = data.category ? normalizeCategory(data.category) : undefined;
    if (category === 'Reward Point' && (data.points_required === undefined || Number(data.points_required) <= 0)) {
      throw new Error('Voucher kategori poin reward wajib menentukan poin yang dibutuhkan (> 0)');
    }
  }

  async createPromo(data: Partial<PromoEntity>, creator: number | null = null): Promise<PromoEntity> {
    this.validatePromoData(data);

    let finalCode = (data.code || '').trim().replace(/[\s-]/g, '').toUpperCase();
    if (!finalCode) {
      finalCode = await PromoGeneratorUtil.generatePromoCode();
    }

    const existing = await this.promoRepository.findByCode(finalCode);
    if (existing) {
      throw new Error(`Kode promo "${finalCode}" sudah digunakan`);
    }

    const created = await this.promoRepository.create({ ...data, code: finalCode }, creator);
    return this.formatPromo(created);
  }

  async updatePromo(id: string | number, data: Partial<PromoEntity>, updatePic: number | null = null): Promise<PromoEntity> {
    this.validatePromoData(data);

    let finalCode = data.code !== undefined ? data.code.trim().replace(/[\s-]/g, '').toUpperCase() : undefined;
    if (finalCode) {
      const existing = await this.promoRepository.findByCode(finalCode, id);
      if (existing) {
        throw new Error(`Kode promo "${finalCode}" sudah digunakan`);
      }
    }

    const updated = await this.promoRepository.update(id, { ...data, ...(finalCode ? { code: finalCode } : {}) }, updatePic);
    if (!updated) {
      throw new Error('Promo tidak ditemukan');
    }
    return this.formatPromo(updated);
  }

  async deletePromo(id: string | number, deletePic: number | null = null): Promise<boolean> {
    const success = await this.promoRepository.softDelete(id, deletePic);
    if (!success) {
      throw new Error('Gagal menghapus promo atau promo tidak ditemukan');
    }
    return true;
  }
}
