import { Request, Response } from 'express';
import { OngkirService } from './ongkir.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';
import { ActivityLogMain, ActivityLogSecondary } from '../activity-logs/activity-log.helper';

export class OngkirController {
  private service = new OngkirService();

  getOngkirs = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const data = await this.service.getAllOngkirs(search);
      ActivityLogSecondary(req, 'Mengakses Halaman Master Data Tarif Ongkir', [search]);
      return sendSuccess(res, data, 'Data master ongkir berhasil diambil');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getNextCode = async (req: Request, res: Response) => {
    try {
      const code = await this.service.getNextCode();
      ActivityLogSecondary(req, 'Mengambil Kode Master Ongkir Berikutnya', [code]);
      return sendSuccess(res, { code }, 'Kode ongkir berikutnya berhasil digenerate');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  getTiersPreview = async (req: Request, res: Response) => {
    try {
      const config = {
        free_radius: Number(req.query.free_radius),
        base_radius: Number(req.query.base_radius),
        base_price: Number(req.query.base_price),
        step_radius: Number(req.query.step_radius),
        step_price: Number(req.query.step_price),
        max_radius: Number(req.query.max_radius),
      };
      const unitSymbol = req.query.unit_symbol as string | undefined;
      const tiers = this.service.generateTiers(config, unitSymbol);
      ActivityLogSecondary(req, 'Melakukan Simulasi Sequence Tier Ongkir', config);
      return sendSuccess(res, tiers, 'Simulasi sequence tier ongkir berhasil digenerate');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  calculateOngkir = async (req: Request, res: Response) => {
    try {
      const latitude = Number(req.body.latitude ?? req.query.latitude);
      const longitude = Number(req.body.longitude ?? req.query.longitude);
      const outlets_id = req.body.outlets_id ?? req.query.outlets_id;

      const result = await this.service.calculateOngkir({
        outlets_id,
        latitude,
        longitude,
      });

      ActivityLogSecondary(req, 'Melakukan Kalkulasi Tarif Ongkir Real-time', { outlets_id, latitude, longitude });
      return sendSuccess(res, result, 'Kalkulasi tarif ongkir berhasil');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  getOngkirById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await this.service.getOngkirById(id);
      if (!item) return sendError(res, 'Master ongkir tidak ditemukan', 404);
      ActivityLogSecondary(req, 'Mengambil Detail Master Ongkir', [id]);
      return sendSuccess(res, item, 'Detail master ongkir');
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  };

  createOngkir = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const creator = getPicId(req);
      const created = await this.service.createOngkir(req.body, creator);
      ActivityLogMain(req, `Menambahkan Master Data Ongkir Baru (Kode: ${created.code_ongkir || req.body.code_ongkir || ''})`, req.body);
      return sendSuccess(res, created, 'Master ongkir berhasil ditambahkan', 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  updateOngkir = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updatePic = getPicId(req);
      const updated = await this.service.updateOngkir(id, req.body, updatePic);
      if (!updated) return sendError(res, 'Master ongkir tidak ditemukan', 404);
      ActivityLogMain(req, `Memperbarui Master Data Ongkir (Kode: ${updated.code_ongkir || ''})`, { id, ...req.body });
      return sendSuccess(res, updated, 'Master ongkir berhasil diperbarui');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };

  deleteOngkir = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deletePic = getPicId(req);
      const success = await this.service.deleteOngkir(id, deletePic);
      if (!success) return sendError(res, 'Gagal menghapus master ongkir atau data tidak ditemukan', 404);
      ActivityLogMain(req, `Menghapus Master Data Ongkir ID ${id}`, [id]);
      return sendSuccess(res, { deleted: true }, 'Master ongkir berhasil dihapus');
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  };
}
