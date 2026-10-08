import { Request, Response } from 'express';
import { PromoService } from './promo.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';
import { ActivityLogMain, ActivityLogSecondary } from '../activity-logs/activity-log.helper';

export class PromoController {
  private promoService: PromoService;

  constructor(promoService?: PromoService) {
    this.promoService = promoService || new PromoService();
  }

  getPromos = async (req: Request, res: Response): Promise<void> => {
    try {
      const search = req.query.search as string | undefined;
      const category = (req.query.category as string | undefined) || (req.query.type as string | undefined);
      const activeParam = req.query.active || req.query.active_only || req.query.activeOnly;
      const activeOnly = activeParam === 'true' || activeParam === '1';

      const promos = await this.promoService.getAllPromos({
        search,
        category,
        activeOnly,
      });
      ActivityLogSecondary(req, 'Mengakses Halaman Master Promo & Voucher', [search, category]);
      sendSuccess(res, promos, 'Daftar promo berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil promo', 500);
    }
  };

  generateCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const isRandom = req.query.random === 'true' || req.query.mode === 'random';
      const code = await this.promoService.generatePromoCode(isRandom ? 'random' : 'sequence');
      sendSuccess(res, { code }, 'Kode promo berhasil digenerate');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal men-generate kode promo', 500);
    }
  };

  getPromoById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const promo = await this.promoService.getPromoById(id);
      if (!promo) {
        sendError(res, 'Promo tidak ditemukan', 404);
        return;
      }
      ActivityLogSecondary(req, 'Mengambil Detail Promo & Voucher', [id]);
      sendSuccess(res, promo, 'Data promo berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil data promo', 500);
    }
  };

  createPromo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const creator = getPicId(req);
      const promo = await this.promoService.createPromo(req.body, creator);
      ActivityLogMain(req, `Menambahkan Promo Voucher Baru "${promo.code}" (${promo.name})`, req.body);
      sendSuccess(res, promo, 'Promo baru berhasil dibuat', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal membuat promo baru', 400);
    }
  };

  updatePromo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const promo = await this.promoService.updatePromo(id, req.body, updatePic);
      ActivityLogMain(req, `Memperbarui Promo Voucher "${promo.code}" (${promo.name})`, { id, ...req.body });
      sendSuccess(res, promo, 'Promo berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui promo', 400);
    }
  };

  deletePromo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.promoService.deletePromo(id, deletePic);
      if (!success) {
        sendError(res, 'Gagal menghapus promo atau promo tidak ditemukan', 404);
        return;
      }
      ActivityLogMain(req, `Menghapus Promo Voucher ID ${id}`, { id });
      sendSuccess(res, { deleted: true }, 'Promo berhasil dihapus');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menghapus promo', 400);
    }
  };
}
