import { ServiceCategoryRepository } from './service-category.repository';
import { ServiceCategoryEntity, CreateCategoryDto, UpdateCategoryDto } from './service-category.types';
import { CryptoUtil } from '../../utils/crypto.util';

export class ServiceCategoryService {
  private repo = new ServiceCategoryRepository();

  private formatCategory(entity: ServiceCategoryEntity): ServiceCategoryEntity {
    const rawId = Number(entity.id_service_categories ?? entity.id);
    return {
      ...entity,
      id_service_categories: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name: entity.name_service_categories ?? entity.name,
      is_active: Boolean(entity.is_active),
    };
  }

  async getAllCategories(search?: string): Promise<ServiceCategoryEntity[]> {
    const list = await this.repo.findAll(search);
    return list.map((c) => this.formatCategory(c));
  }

  async getCategoryById(id: string): Promise<ServiceCategoryEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) return null;
    const item = await this.repo.findById(numericId);
    return item ? this.formatCategory(item) : null;
  }

  async createCategory(dto: CreateCategoryDto, creator: number | null = null): Promise<ServiceCategoryEntity> {
    const cleanCode = dto.code.trim().toLowerCase();
    const existing = await this.repo.findByCode(cleanCode);
    if (existing) {
      throw new Error(`Kode kategori "${dto.code}" sudah terdaftar.`);
    }

    const catName = (dto.name_service_categories || dto.name || '').trim();
    const created = await this.repo.create(
      {
        name_service_categories: catName,
        name: catName,
        code: cleanCode,
        icon_code: dto.icon_code?.trim() || null,
        badge_color: dto.badge_color || 'primary',
        description: dto.description?.trim() || null,
        is_active: dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : 1,
      },
      creator,
    );

    return this.formatCategory(created);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, updatePic: number | null = null): Promise<ServiceCategoryEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Kategori tidak valid.');

    if (dto.code) {
      const cleanCode = dto.code.trim().toLowerCase();
      const existing = await this.repo.findByCode(cleanCode, numericId);
      if (existing) {
        throw new Error(`Kode kategori "${dto.code}" sudah digunakan.`);
      }
    }

    const catName = dto.name_service_categories !== undefined ? dto.name_service_categories.trim() : (dto.name !== undefined ? dto.name.trim() : undefined);

    const updated = await this.repo.update(
      numericId,
      {
        ...(catName !== undefined && { name_service_categories: catName, name: catName }),
        ...(dto.code && { code: dto.code.trim().toLowerCase() }),
        ...(dto.icon_code !== undefined && { icon_code: dto.icon_code?.trim() || null }),
        ...(dto.badge_color !== undefined && { badge_color: dto.badge_color }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active ? 1 : 0 }),
      },
      updatePic,
    );

    return updated ? this.formatCategory(updated) : null;
  }

  async deleteCategory(id: string, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Kategori tidak valid.');
    return await this.repo.softDelete(numericId, deletePic);
  }
}
