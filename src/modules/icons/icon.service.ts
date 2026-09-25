import { IconRepository, IconEntity } from './icon.repository';
import { CryptoUtil } from '../../utils/crypto.util';

export class IconService {
  private iconRepo: IconRepository;

  constructor(iconRepo?: IconRepository) {
    this.iconRepo = iconRepo || new IconRepository();
  }

  private formatIcon(icon: IconEntity): IconEntity {
    const rawId = Number(icon.id_icons ?? icon.id);
    return {
      ...icon,
      id_icons: rawId,
      id: CryptoUtil.encryptId(rawId) || String(rawId),
      name: icon.name_icons ?? icon.name,
      is_active: Boolean(icon.is_active),
    };
  }

  async getIcons(category?: string, search?: string): Promise<IconEntity[]> {
    const icons = await this.iconRepo.findAll(category, search);
    return icons.map((icon) => this.formatIcon(icon));
  }

  async getIconById(id: string): Promise<IconEntity | null> {
    const icon = await this.iconRepo.findById(id);
    if (!icon) return null;
    return this.formatIcon(icon);
  }

  async createIcon(data: Partial<IconEntity>, creatorPic: number | null = null): Promise<IconEntity> {
    const iconName = (data.name_icons || data.name || '').trim();
    if (!iconName || !data.code) {
      throw new Error('Nama ikon dan kode ikon wajib diisi');
    }

    const existing = await this.iconRepo.findByCode(data.code);
    if (existing) {
      throw new Error(`Kode ikon "${data.code}" sudah digunakan.`);
    }

    const created = await this.iconRepo.create({ ...data, name_icons: iconName, name: iconName }, creatorPic);
    return this.formatIcon(created);
  }

  async updateIcon(id: string, data: Partial<IconEntity>, updatePic: number | null = null): Promise<IconEntity | null> {
    if (data.code) {
      const existing = await this.iconRepo.findByCode(data.code, id);
      if (existing) {
        throw new Error(`Kode ikon "${data.code}" sudah digunakan oleh ikon lain.`);
      }
    }

    const updated = await this.iconRepo.update(id, data, updatePic);
    if (!updated) return null;

    return this.formatIcon(updated);
  }

  async deleteIcon(id: string, deletePic: number | null = null): Promise<boolean> {
    return await this.iconRepo.softDelete(id, deletePic);
  }
}
