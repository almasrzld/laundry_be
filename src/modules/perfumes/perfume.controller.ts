import { Request, Response } from 'express';
import { PerfumeService } from './perfume.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';

export class PerfumeController {
  private service = new PerfumeService();

  getPerfumes = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const data = await this.service.getAllPerfumes(search);
      return sendSuccess(res, data, 'Data master parfum berhasil diambil');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getPerfumeById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await this.service.getPerfumeById(id);
      if (!item) return sendError(res, 'Parfum tidak ditemukan', 404);
      return sendSuccess(res, item, 'Detail master parfum');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  createPerfume = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, code, scent_type, description, is_active } = req.body;
      if (!name || !code) {
        return sendError(res, 'Nama dan kode parfum wajib diisi', 400);
      }
      const creator = getPicId(req);
      const created = await this.service.createPerfume(
        { name, code, scent_type, description, is_active },
        creator,
      );
      return sendSuccess(res, created, 'Master parfum berhasil ditambahkan', 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  updatePerfume = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const updated = await this.service.updatePerfume(id, req.body, updatePic);
      if (!updated) return sendError(res, 'Parfum tidak ditemukan', 404);
      return sendSuccess(res, updated, 'Master parfum berhasil diperbarui');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  deletePerfume = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.service.deletePerfume(id, deletePic);
      if (!success) return sendError(res, 'Gagal menghapus parfum atau data tidak ditemukan', 404);
      return sendSuccess(res, { deleted: true }, 'Master parfum berhasil dihapus');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };
}
