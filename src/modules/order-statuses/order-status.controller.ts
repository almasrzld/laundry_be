import { Request, Response } from 'express';
import { OrderStatusService } from './order-status.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';

export class OrderStatusController {
  private service = new OrderStatusService();

  getOrderStatuses = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const data = await this.service.getAllOrderStatuses(search);
      return sendSuccess(res, data, 'Data master status cucian berhasil diambil');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getOrderStatusById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await this.service.getOrderStatusById(id);
      if (!item) return sendError(res, 'Status tidak ditemukan', 404);
      return sendSuccess(res, item, 'Detail master status cucian');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  createOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, code, step_order, color_hex, badge_variant, description, is_active } = req.body;
      if (!name || !code) {
        return sendError(res, 'Nama dan kode status wajib diisi', 400);
      }
      const creator = getPicId(req);
      const created = await this.service.createOrderStatus(
        { name, code, step_order, color_hex, badge_variant, description, is_active },
        creator,
      );
      return sendSuccess(res, created, 'Master status cucian berhasil ditambahkan', 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  updateOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const updated = await this.service.updateOrderStatus(id, req.body, updatePic);
      if (!updated) return sendError(res, 'Status tidak ditemukan', 404);
      return sendSuccess(res, updated, 'Master status cucian berhasil diperbarui');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  deleteOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.service.deleteOrderStatus(id, deletePic);
      if (!success) return sendError(res, 'Gagal menghapus status atau data tidak ditemukan', 404);
      return sendSuccess(res, { deleted: true }, 'Master status cucian berhasil dihapus');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };
}
