import { Request, Response } from 'express';
import { IconService } from './icon.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { UserCodeUtil } from '../../utils/user-code.util';
import { ActivityLogMain, ActivityLogSecondary } from '../activity-logs/activity-log.helper';

const getPicId = (req: Request): number | null => {
  return UserCodeUtil.resolveUserCode((req as any).user);
};

export class IconController {
  private iconService: IconService;

  constructor(iconService?: IconService) {
    this.iconService = iconService || new IconService();
  }

  getIcons = async (req: Request, res: Response): Promise<void> => {
    try {
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;
      const icons = await this.iconService.getIcons(category, search);
      ActivityLogSecondary(req, 'Mengakses Halaman Master Ikon', [category, search]);
      sendSuccess(res, icons, 'Data master ikon berhasil diambil');
    } catch (err: any) {
      sendError(res, err.message || 'Gagal mengambil data master ikon', 500);
    }
  };

  getIconById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const icon = await this.iconService.getIconById(id);
      if (!icon) {
        sendError(res, 'Ikon tidak ditemukan', 404);
        return;
      }
      ActivityLogSecondary(req, 'Mengambil Detail Master Ikon', [id]);
      sendSuccess(res, icon, 'Detail master ikon berhasil diambil');
    } catch (err: any) {
      sendError(res, err.message || 'Gagal mengambil detail master ikon', 500);
    }
  };

  createIcon = async (req: Request, res: Response): Promise<void> => {
    try {
      const picId = getPicId(req);
      const icon = await this.iconService.createIcon(req.body, picId);
      ActivityLogMain(req, `Menambahkan Master Ikon Baru "${icon.name || req.body.name || ''}"`, req.body);
      sendSuccess(res, icon, 'Master ikon baru berhasil ditambahkan', 201);
    } catch (err: any) {
      sendError(res, err.message || 'Gagal menambahkan master ikon', 400);
    }
  };

  updateIcon = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const picId = getPicId(req);
      const updated = await this.iconService.updateIcon(id, req.body, picId);
      if (!updated) {
        sendError(res, 'Ikon tidak ditemukan untuk diperbarui', 404);
        return;
      }
      ActivityLogMain(req, `Memperbarui Master Ikon "${updated.name || req.body.name || ''}"`, { id, ...req.body });
      sendSuccess(res, updated, 'Data master ikon berhasil diperbarui');
    } catch (err: any) {
      sendError(res, err.message || 'Gagal memperbarui master ikon', 400);
    }
  };

  deleteIcon = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const picId = getPicId(req);
      const success = await this.iconService.deleteIcon(id, picId);
      if (!success) {
        sendError(res, 'Ikon tidak ditemukan atau gagal dihapus', 404);
        return;
      }
      ActivityLogMain(req, `Menghapus Master Ikon ID ${id}`, { id });
      sendSuccess(res, null, 'Master ikon berhasil dihapus');
    } catch (err: any) {
      sendError(res, err.message || 'Gagal menghapus master ikon', 500);
    }
  };
}
