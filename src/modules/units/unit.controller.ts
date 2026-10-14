import { Request, Response } from 'express';
import { UnitService } from './unit.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';
import { ActivityLogMain, ActivityLogSecondary } from '../activity-logs/activity-log.helper';

export class UnitController {
  private service = new UnitService();

  getUnits = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const data = await this.service.getAllUnits(search);
      ActivityLogSecondary(req, 'Mengakses Halaman Master Satuan', [search]);
      return sendSuccess(res, data, 'Data master satuan berhasil diambil');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getUnitById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await this.service.getUnitById(id);
      if (!item) return sendError(res, 'Satuan tidak ditemukan', 404);
      ActivityLogSecondary(req, 'Mengambil Detail Master Satuan', [id]);
      return sendSuccess(res, item, 'Detail master satuan');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  createUnit = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name_unit, code_unit, symbol, description, is_active } = req.body;

      if (!name_unit?.trim() || !code_unit?.trim()) {
        return sendError(res, 'Nama dan kode satuan wajib diisi', 400);
      }
      const creator = getPicId(req);
      const created = await this.service.createUnit(
        {
          name_unit: name_unit.trim(),
          code_unit: code_unit.trim(),
          symbol,
          description,
          is_active: Boolean(is_active),
        },
        creator,
      );
      ActivityLogMain(
        req,
        `Menambahkan Master Satuan Baru "${name_unit.trim()}" (Kode: ${code_unit.trim()}, Simbol: ${symbol || '-'})`,
        req.body
      );
      return sendSuccess(res, created, 'Master satuan berhasil ditambahkan', 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  updateUnit = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const updated = await this.service.updateUnit(id, req.body, updatePic);
      if (!updated) return sendError(res, 'Satuan tidak ditemukan', 404);
      ActivityLogMain(
        req,
        `Memperbarui Master Satuan "${updated.name_unit}" (Kode: ${updated.code_unit})`,
        { id, ...req.body }
      );
      return sendSuccess(res, updated, 'Master satuan berhasil diperbarui');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  deleteUnit = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.service.deleteUnit(id, deletePic);
      if (!success) return sendError(res, 'Gagal menghapus satuan atau data tidak ditemukan', 404);
      ActivityLogMain(req, `Menghapus Master Satuan ID ${id}`, { id });
      return sendSuccess(res, { deleted: true }, 'Master satuan berhasil dihapus');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };
}
