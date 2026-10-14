import { Request, Response } from 'express';
import { ServiceCategoryService } from './service-category.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';
import { ActivityLogMain, ActivityLogSecondary } from '../activity-logs/activity-log.helper';

export class ServiceCategoryController {
  private service = new ServiceCategoryService();

  getCategories = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const data = await this.service.getAllCategories(search);
      ActivityLogSecondary(req, 'Mengakses Halaman Master Kategori Layanan', [search]);
      return sendSuccess(res, data, 'Data master kategori layanan berhasil diambil');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getCategoryById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await this.service.getCategoryById(id);
      if (!item) return sendError(res, 'Kategori tidak ditemukan', 404);
      ActivityLogSecondary(req, 'Mengambil Detail Master Kategori Layanan', [id]);
      return sendSuccess(res, item, 'Detail master kategori layanan');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  createCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, code, icon_code, badge_color, description, is_active } = req.body;
      if (!name || !code) {
        return sendError(res, 'Nama dan kode kategori wajib diisi', 400);
      }
      const creator = getPicId(req);
      const created = await this.service.createCategory(
        { name, code, icon_code, badge_color, description, is_active },
        creator,
      );
      ActivityLogMain(req, `Menambahkan Master Kategori Layanan "${name}" (Kode: ${code})`, req.body);
      return sendSuccess(res, created, 'Master kategori berhasil ditambahkan', 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  updateCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const updated = await this.service.updateCategory(id, req.body, updatePic);
      if (!updated) return sendError(res, 'Kategori tidak ditemukan', 404);
      ActivityLogMain(req, `Memperbarui Master Kategori Layanan "${updated.name}" (Kode: ${updated.code})`, { id, ...req.body });
      return sendSuccess(res, updated, 'Master kategori berhasil diperbarui');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.service.deleteCategory(id, deletePic);
      if (!success) return sendError(res, 'Gagal menghapus kategori atau data tidak ditemukan', 404);
      ActivityLogMain(req, `Menghapus Master Kategori Layanan ID ${id}`, { id });
      return sendSuccess(res, { deleted: true }, 'Master kategori berhasil dihapus');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };
}
