import { Request, Response } from 'express';
import { ServiceService } from './service.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { getPicId } from '../../utils/user-code.util';
import { ActivityLogMain, ActivityLogSecondary } from '../activity-logs/activity-log.helper';

export class ServiceController {
  private serviceService: ServiceService;

  constructor(serviceService?: ServiceService) {
    this.serviceService = serviceService || new ServiceService();
  }

  getServices = async (req: Request, res: Response): Promise<void> => {
    try {
      const category = req.query.category as string | undefined;
      const search = req.query.q as string | undefined;

      const services = await this.serviceService.getAllServices(category, search);
      ActivityLogSecondary(req, 'Mengakses Halaman Master Data Layanan', [category, search]);
      sendSuccess(res, services, 'Daftar layanan berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil daftar layanan', 500);
    }
  };

  getServiceById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const service = await this.serviceService.getServiceById(id);
      ActivityLogSecondary(req, 'Mengambil Detail Layanan Laundry', [id]);
      sendSuccess(res, service, 'Detail layanan berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Layanan tidak ditemukan', 404);
    }
  };

  createService = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      const created = await this.serviceService.createService(req.body, picId);
      ActivityLogMain(req, `Menambahkan Master Layanan Laundry Baru "${created.name}"`, req.body);
      sendSuccess(res, created, 'Layanan baru berhasil ditambahkan', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menambahkan layanan', 400);
    }
  };

  updateService = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const picId = getPicId(req);
      const updated = await this.serviceService.updateService(id, req.body, picId);
      if (!updated) {
        sendError(res, 'Layanan tidak ditemukan', 404);
        return;
      }
      ActivityLogMain(req, `Memperbarui Master Layanan Laundry "${updated.name}"`, { id, ...req.body });
      sendSuccess(res, updated, 'Layanan berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui layanan', 400);
    }
  };

  deleteService = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const picId = getPicId(req);
      await this.serviceService.deleteService(id, picId);
      ActivityLogMain(req, `Menghapus Master Layanan Laundry ID ${id}`, [id]);
      sendSuccess(res, { success: true }, 'Layanan berhasil dihapus');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menghapus layanan', 400);
    }
  };
}
