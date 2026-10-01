import { Request, Response } from 'express';
import { OutletService } from './outlet.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';

export class OutletController {
  private service = new OutletService();

  getOutlets = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const data = await this.service.getAllOutlets(search);
      return sendSuccess(res, data, 'Data master outlet berhasil diambil');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getOutletById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await this.service.getOutletById(id);
      if (!item) return sendError(res, 'Master outlet tidak ditemukan', 404);
      return sendSuccess(res, item, 'Detail master outlet');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  createOutlet = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const creator = getPicId(req);
      const created = await this.service.createOutlet(req.body, creator);
      return sendSuccess(res, created, 'Master outlet berhasil ditambahkan', 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  updateOutlet = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const updated = await this.service.updateOutlet(id, req.body, updatePic);
      if (!updated) return sendError(res, 'Master outlet tidak ditemukan', 404);
      return sendSuccess(res, updated, 'Master outlet berhasil diperbarui');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  deleteOutlet = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.service.deleteOutlet(id, deletePic);
      if (!success) return sendError(res, 'Gagal menghapus master outlet atau data tidak ditemukan', 404);
      return sendSuccess(res, { deleted: true }, 'Master outlet berhasil dihapus');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };
}
