import { Request, Response } from 'express';
import { ShelfTypeService } from './shelf-type.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';

export class ShelfTypeController {
  private service = new ShelfTypeService();

  getShelfTypes = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const data = await this.service.getAllShelfTypes(search);
      return sendSuccess(res, data, 'Data master jenis rak berhasil diambil');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getShelfTypeById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await this.service.getShelfTypeById(id);
      if (!item) return sendError(res, 'Jenis rak tidak ditemukan', 404);
      return sendSuccess(res, item, 'Detail master jenis rak');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  createShelfType = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return sendError(res, 'Nama jenis rak wajib diisi', 400);
      }
      const creator = getPicId(req);
      const created = await this.service.createShelfType(
        { name },
        creator,
      );
      return sendSuccess(res, created, 'Master jenis rak berhasil ditambahkan', 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  updateShelfType = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const updated = await this.service.updateShelfType(id, req.body, updatePic);
      if (!updated) return sendError(res, 'Jenis rak tidak ditemukan', 404);
      return sendSuccess(res, updated, 'Master jenis rak berhasil diperbarui');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  deleteShelfType = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.service.deleteShelfType(id, deletePic);
      if (!success) return sendError(res, 'Gagal menghapus jenis rak atau data tidak ditemukan', 404);
      return sendSuccess(res, { deleted: true }, 'Master jenis rak berhasil dihapus');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };
}
