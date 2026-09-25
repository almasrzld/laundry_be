import { PaymentMethodRepository } from './payment-method.repository';
import { PaymentMethodEntity, CreatePaymentMethodDto, UpdatePaymentMethodDto } from './payment-method.types';
import { CryptoUtil } from '../../utils/crypto.util';

export class PaymentMethodService {
  private repo = new PaymentMethodRepository();

  private formatPaymentMethod(entity: PaymentMethodEntity): PaymentMethodEntity {
    const rawId = Number(entity.id_payment_methods ?? entity.id);
    return {
      ...entity,
      id_payment_methods: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name: entity.name_payment_methods ?? entity.name,
      is_active: Boolean(entity.is_active),
    };
  }

  async getAllPaymentMethods(search?: string, type?: string): Promise<PaymentMethodEntity[]> {
    const list = await this.repo.findAll(search, type);
    return list.map((pm) => this.formatPaymentMethod(pm));
  }

  async getPaymentMethodById(id: string): Promise<PaymentMethodEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) return null;
    const item = await this.repo.findById(numericId);
    return item ? this.formatPaymentMethod(item) : null;
  }

  async createPaymentMethod(dto: CreatePaymentMethodDto, creator: number | null = null): Promise<PaymentMethodEntity> {
    const cleanCode = dto.code.trim().toLowerCase();
    const existing = await this.repo.findByCode(cleanCode);
    if (existing) {
      throw new Error(`Kode metode pembayaran "${dto.code}" sudah terdaftar.`);
    }

    const pmName = (dto.name_payment_methods || dto.name || '').trim();
    const created = await this.repo.create(
      {
        name_payment_methods: pmName,
        name: pmName,
        code: cleanCode,
        type: dto.type || 'cash',
        account_number: dto.account_number?.trim() || null,
        account_name: dto.account_name?.trim() || null,
        description: dto.description?.trim() || null,
        is_active: dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : 1,
      },
      creator,
    );

    return this.formatPaymentMethod(created);
  }

  async updatePaymentMethod(id: string, dto: UpdatePaymentMethodDto, updatePic: number | null = null): Promise<PaymentMethodEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Metode Pembayaran tidak valid.');

    if (dto.code) {
      const cleanCode = dto.code.trim().toLowerCase();
      const existing = await this.repo.findByCode(cleanCode, numericId);
      if (existing) {
        throw new Error(`Kode metode pembayaran "${dto.code}" sudah digunakan.`);
      }
    }

    const pmName = dto.name_payment_methods !== undefined ? dto.name_payment_methods.trim() : (dto.name !== undefined ? dto.name.trim() : undefined);

    const updated = await this.repo.update(
      numericId,
      {
        ...(pmName !== undefined && { name_payment_methods: pmName, name: pmName }),
        ...(dto.code && { code: dto.code.trim().toLowerCase() }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.account_number !== undefined && { account_number: dto.account_number?.trim() || null }),
        ...(dto.account_name !== undefined && { account_name: dto.account_name?.trim() || null }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active ? 1 : 0 }),
      },
      updatePic,
    );

    return updated ? this.formatPaymentMethod(updated) : null;
  }

  async deletePaymentMethod(id: string, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Metode Pembayaran tidak valid.');
    return await this.repo.softDelete(numericId, deletePic);
  }
}
