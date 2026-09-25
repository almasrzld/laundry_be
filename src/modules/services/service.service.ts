import { ServiceRepository, ServiceEntity } from './service.repository';
import { CryptoUtil } from '../../utils/crypto.util';

export class ServiceService {
  private serviceRepository: ServiceRepository;

  constructor(serviceRepository?: ServiceRepository) {
    this.serviceRepository = serviceRepository || new ServiceRepository();
  }

  private formatService(s: ServiceEntity): ServiceEntity {
    const rawId = Number(s.id_services ?? s.id);
    return {
      ...s,
      id_services: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name: s.name_services ?? s.name,
      name_services: s.name_services ?? s.name,
    };
  }

  async getAllServices(category?: string, query?: string): Promise<ServiceEntity[]> {
    const list = await this.serviceRepository.findAll(category, query);
    return list.map((s) => this.formatService(s));
  }

  async getServiceById(id: string | number): Promise<ServiceEntity | null> {
    const service = await this.serviceRepository.findById(id);
    if (!service) {
      throw new Error('Layanan laundry tidak ditemukan');
    }
    return this.formatService(service);
  }

  async createService(data: Partial<ServiceEntity>, creatorPic?: number | null): Promise<ServiceEntity> {
    const serviceName = data.name_services || data.name;
    if (!serviceName || !data.price) {
      throw new Error('Nama layanan dan harga wajib diisi');
    }
    const created = await this.serviceRepository.create({ ...data, name_services: serviceName, name: serviceName }, creatorPic || undefined);
    return this.formatService(created);
  }

  async updateService(id: string | number, data: Partial<ServiceEntity>, updatePic?: number | null): Promise<ServiceEntity | null> {
    const updated = await this.serviceRepository.update(id, data, updatePic || undefined);
    if (!updated) {
      throw new Error('Layanan tidak ditemukan untuk diperbarui');
    }
    return this.formatService(updated);
  }

  async deleteService(id: string | number, deletePic?: number | null): Promise<boolean> {
    return this.serviceRepository.softDelete(id, deletePic || undefined);
  }
}
