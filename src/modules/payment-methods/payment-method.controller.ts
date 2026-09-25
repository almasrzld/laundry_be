import { Request, Response } from 'express';
import { PaymentMethodService } from './payment-method.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';

export class PaymentMethodController {
  private service = new PaymentMethodService();

  getPaymentMethods = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const type = req.query.type as string | undefined;
      const data = await this.service.getAllPaymentMethods(search, type);
      return sendSuccess(res, data, 'Data master metode pembayaran berhasil diambil');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getPaymentMethodById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await this.service.getPaymentMethodById(id);
      if (!item) return sendError(res, 'Metode pembayaran tidak ditemukan', 404);
      return sendSuccess(res, item, 'Detail master metode pembayaran');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  createPaymentMethod = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, code, type, account_number, account_name, description, is_active } = req.body;
      if (!name || !code) {
        return sendError(res, 'Nama dan kode metode pembayaran wajib diisi', 400);
      }
      const creator = getPicId(req);
      const created = await this.service.createPaymentMethod(
        { name, code, type, account_number, account_name, description, is_active },
        creator,
      );
      return sendSuccess(res, created, 'Master metode pembayaran berhasil ditambahkan', 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  updatePaymentMethod = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const updated = await this.service.updatePaymentMethod(id, req.body, updatePic);
      if (!updated) return sendError(res, 'Metode pembayaran tidak ditemukan', 404);
      return sendSuccess(res, updated, 'Master metode pembayaran berhasil diperbarui');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  deletePaymentMethod = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.service.deletePaymentMethod(id, deletePic);
      if (!success) return sendError(res, 'Gagal menghapus metode pembayaran atau data tidak ditemukan', 404);
      return sendSuccess(res, { deleted: true }, 'Master metode pembayaran berhasil dihapus');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };
}
