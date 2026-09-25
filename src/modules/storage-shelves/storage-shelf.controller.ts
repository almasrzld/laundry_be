import { Request, Response } from 'express';
import { StorageShelfService } from './storage-shelf.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';

export class StorageShelfController {
  private service = new StorageShelfService();

  getShelves = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const data = await this.service.getAllShelves(search);
      return sendSuccess(res, data, 'Data master rak penyimpanan berhasil diambil');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getShelfById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await this.service.getShelfById(id);
      if (!item) return sendError(res, 'Rak tidak ditemukan', 404);
      return sendSuccess(res, item, 'Detail master rak penyimpanan');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getNextCode = async (req: Request, res: Response) => {
    try {
      const typeId = (req.query.typeId as string) || (req.query.shelfTypeId as string) || '1';
      const code = await this.service.getNextCode(typeId);
      return sendSuccess(res, { code }, 'Kode rak berikutnya berhasil digenerate');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  createShelf = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, code, capacity, location_notes, is_active } = req.body;
      if (!name || !code) {
        return sendError(res, 'Nama dan kode rak wajib diisi', 400);
      }
      const creator = getPicId(req);
      const created = await this.service.createShelf(
        { name, code, capacity, location_notes, is_active },
        creator,
      );
      return sendSuccess(res, created, 'Master rak berhasil ditambahkan', 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  updateShelf = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const updated = await this.service.updateShelf(id, req.body, updatePic);
      if (!updated) return sendError(res, 'Rak tidak ditemukan', 404);
      return sendSuccess(res, updated, 'Master rak berhasil diperbarui');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  deleteShelf = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.service.deleteShelf(id, deletePic);
      if (!success) return sendError(res, 'Gagal menghapus rak atau data tidak ditemukan', 404);
      return sendSuccess(res, { deleted: true }, 'Master rak berhasil dihapus');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };
}
