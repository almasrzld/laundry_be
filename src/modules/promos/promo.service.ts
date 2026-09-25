import { PromoRepository, PromoEntity } from './promo.repository';
import { CryptoUtil } from '../../utils/crypto.util';
import { PromoGeneratorUtil } from '../../utils/promo-generator.util';

export class PromoService {
  private promoRepository: PromoRepository;

  constructor(promoRepository?: PromoRepository) {
    this.promoRepository = promoRepository || new PromoRepository();
  }

  private formatPromo(p: PromoEntity): PromoEntity {
    const rawId = Number(p.id_promos ?? p.id);
    return {
      ...p,
      id_promos: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name_promos: p.name_promos ?? p.title ?? p.name,
      title: p.name_promos ?? p.title ?? p.name,
      name: p.name_promos ?? p.title ?? p.name,
    };
  }

  async generatePromoCode(mode: 'sequence' | 'random' = 'sequence'): Promise<string> {
    return await PromoGeneratorUtil.generatePromoCode({ mode });
  }

  async getAllPromos(search?: string): Promise<PromoEntity[]> {
    const list = await this.promoRepository.findAll(search);
    return list.map((p) => this.formatPromo(p));
  }

  async getPromoById(id: string | number): Promise<PromoEntity | null> {
    const promo = await this.promoRepository.findById(id);
    return promo ? this.formatPromo(promo) : null;
  }

  async createPromo(data: Partial<PromoEntity>, creator: number | null = null): Promise<PromoEntity> {
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
