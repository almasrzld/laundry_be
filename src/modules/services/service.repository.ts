import { query } from "../../config/database";
import { CryptoUtil } from "../../utils/crypto.util";

export interface ServiceEntity {
  id?: number | string;
  id_services?: number | string;
  name?: string;
  name_services?: string;
  description: string;
  price: number;
  units_id: number | string;
  service_categories_id: number | string;
  icons_id?: number | string | null;
  // Attached relation attributes
  unit_id?: string;
  unit?: string;
  unit_name?: string;
  unit_symbol?: string;
  service_category_id?: string;
  category_id?: string;
  category?: string;
  category_name?: string;
  icon_id?: string | null;
  icon_code?: string;
  icon_name?: string;
  duration: string;
  is_popular: boolean | number;
  badge_color_hex: number;
  created_at?: Date | string;
  creator?: number | null;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

const SERVICE_COLUMNS = `
  id_services, name_services, description, price, units_id, service_categories_id, icons_id, duration, is_popular, badge_color_hex, created_at, creator, updated_at, update_pic, deleted_at, delete_pic
`;

export class ServiceRepository {
  private async attachRelations(
    services: ServiceEntity[],
  ): Promise<ServiceEntity[]> {
    if (services.length === 0) return [];

    try {
      const units = await query<{
        id_units: number;
        name_unit: string;
        code_unit: string;
        symbol: string;
      }>(
        `SELECT id_units, name_unit, code_unit, symbol FROM master_units WHERE deleted_at IS NULL`,
      );
      const categories = await query<{
        id_service_categories: number;
        name_service_categories: string;
        code: string;
      }>(
        `SELECT id_service_categories, name_service_categories, code FROM master_service_categories WHERE deleted_at IS NULL`,
      );
      const icons = await query<{
        id_icons: number;
        name_icons: string;
        code: string;
      }>(
        `SELECT id_icons, name_icons, code FROM icons WHERE deleted_at IS NULL`,
      );

      const unitMap = new Map(units.map((u) => [Number(u.id_units), u]));
      const catMap = new Map(
        categories.map((c) => [Number(c.id_service_categories), c]),
      );
      const iconMap = new Map(icons.map((i) => [Number(i.id_icons), i]));

      for (const s of services) {
        const rawId = Number(s.id_services ?? s.id);
        s.id = CryptoUtil.encryptId(rawId) ?? String(rawId);
        s.id_services = rawId;
        s.name = s.name_services ?? s.name;
        s.name_services = s.name_services ?? s.name;

        const u = unitMap.get(Number(s.units_id));
        if (u) {
          s.unit_id = CryptoUtil.encryptId(u.id_units) ?? String(u.id_units);
          s.unit = u.code_unit;
          s.unit_name = u.name_unit;
          s.unit_symbol = u.symbol;
        } else {
          s.unit_id =
            CryptoUtil.encryptId(Number(s.units_id)) ?? String(s.units_id);
          s.unit = "";
          s.unit_name = "";
          s.unit_symbol = "";
        }

        const c = catMap.get(Number(s.service_categories_id));
        if (c) {
          s.service_category_id =
            CryptoUtil.encryptId(c.id_service_categories) ??
            String(c.id_service_categories);
          s.category_id = s.service_category_id;
          s.category = c.code;
          s.category_name = c.name_service_categories;
        } else {
          s.service_category_id =
            CryptoUtil.encryptId(Number(s.service_categories_id)) ??
            String(s.service_categories_id);
          s.category_id = s.service_category_id;
          s.category = "";
          s.category_name = "";
        }

        if (s.icons_id) {
          const ic = iconMap.get(Number(s.icons_id));
          if (ic) {
            s.icon_id =
              CryptoUtil.encryptId(ic.id_icons) ?? String(ic.id_icons);
            s.icon_code = ic.code;
            s.icon_name = ic.name_icons;
          } else {
            s.icon_id =
              CryptoUtil.encryptId(Number(s.icons_id)) ?? String(s.icons_id);
            s.icon_code = "shirt";
            s.icon_name = "";
          }
        } else {
          s.icon_id = null;
          s.icon_code = "shirt";
          s.icon_name = "";
        }
      }
    } catch (_) {}

    return services;
  }

  private async resolveForeignKeys(
    service: Partial<ServiceEntity> & Record<string, any>,
  ): Promise<{
    units_id: number;
    service_categories_id: number;
    icons_id: number | null;
  }> {
    let units_id = 0;
    if (service.units_id) {
      units_id = Number(
        CryptoUtil.decryptId(service.units_id) ?? service.units_id,
      );
    } else if (service.unit_id) {
      units_id = Number(
        CryptoUtil.decryptId(service.unit_id) ?? service.unit_id,
      );
    }
    if (!units_id && service.unit) {
      const u = await query<{ id_units: number }>(
        `SELECT id_units FROM master_units WHERE LOWER(code_unit) = LOWER(?) OR LOWER(name_unit) = LOWER(?) OR LOWER(symbol) = LOWER(?) LIMIT 1`,
        [String(service.unit).trim(), String(service.unit).trim(), String(service.unit).trim()],
      );
      if (u.length > 0) units_id = u[0].id_units;
    }
    if (!units_id) units_id = 1;

    let service_categories_id = 0;
    if (service.service_categories_id) {
      service_categories_id = Number(
        CryptoUtil.decryptId(service.service_categories_id) ??
          service.service_categories_id,
      );
    } else if (service.category_id || service.service_category_id) {
      const catId = service.category_id || service.service_category_id;
      service_categories_id = Number(CryptoUtil.decryptId(catId) ?? catId);
    }
    if (!service_categories_id && service.category) {
      const c = await query<{ id_service_categories: number }>(
        `SELECT id_service_categories FROM master_service_categories WHERE LOWER(code) = LOWER(?) OR LOWER(name_service_categories) = LOWER(?) LIMIT 1`,
        [String(service.category).trim(), String(service.category).trim()],
      );
      if (c.length > 0) service_categories_id = c[0].id_service_categories;
    }
    if (!service_categories_id) service_categories_id = 1;

    let icons_id: number | null = null;
    if (service.icons_id) {
      icons_id = Number(
        CryptoUtil.decryptId(service.icons_id) ?? service.icons_id,
      );
    } else if (service.icon_id) {
      icons_id = Number(
        CryptoUtil.decryptId(service.icon_id) ?? service.icon_id,
      );
    }
    if (!icons_id && service.icon_code) {
      const ic = await query<{ id_icons: number }>(
        `SELECT id_icons FROM icons WHERE LOWER(code) = LOWER(?) LIMIT 1`,
        [String(service.icon_code).trim()],
      );
      if (ic.length > 0) icons_id = ic[0].id_icons;
    }

    return { units_id, service_categories_id, icons_id };
  }

  async findAll(
    categoryFilter?: string,
    queryStr?: string,
  ): Promise<ServiceEntity[]> {
    try {
      let sql = `SELECT ${SERVICE_COLUMNS} FROM services WHERE deleted_at IS NULL`;
      const params: any[] = [];

      if (queryStr && queryStr.trim().length > 0) {
        sql += " AND (name_services LIKE ? OR description LIKE ?)";
        params.push(`%${queryStr}%`, `%${queryStr}%`);
      }

      sql += " ORDER BY id_services ASC";

      const results = await query<ServiceEntity>(sql, params);
      const withRelations = await this.attachRelations(results);

      if (categoryFilter && categoryFilter !== "all") {
        const catClean = categoryFilter.toLowerCase();
        return withRelations.filter(
          (s) =>
            s.category?.toLowerCase() === catClean ||
            String(s.service_categories_id) === categoryFilter ||
            s.category_id === categoryFilter,
        );
      }

      return withRelations;
    } catch (_) {}

    return [];
  }

  async findById(id: string | number): Promise<ServiceEntity | null> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    try {
      const sql = `SELECT ${SERVICE_COLUMNS} FROM services WHERE id_services = ? AND deleted_at IS NULL LIMIT 1`;
      const results = await query<ServiceEntity>(sql, [numericId]);
      if (results.length > 0) {
        const list = await this.attachRelations(results);
        return list[0] || null;
      }
    } catch (_) {}

    return null;
  }

  async create(
    service: Partial<ServiceEntity> & Record<string, any>,
    creatorPic?: number,
  ): Promise<ServiceEntity> {
    const serviceName = service.name_services || service.name || "";
    const creatorVal = creatorPic ?? service.creator ?? 0;
    const { units_id, service_categories_id, icons_id } =
      await this.resolveForeignKeys(service);

    const newService: ServiceEntity = {
      id_services: 0,
      id: 0,
      name_services: serviceName,
      name: serviceName,
      description: service.description || "",
      price: service.price || 0,
      units_id,
      service_categories_id,
      icons_id,
      duration: service.duration || "",
      is_popular: service.is_popular || false,
      badge_color_hex: service.badge_color_hex || 0xff0284c7,
      created_at: new Date(),
      creator: creatorVal,
      deleted_at: null,
      delete_pic: null,
    };

    try {
      const sql = `
        INSERT INTO services (name_services, description, price, units_id, service_categories_id, icons_id, duration, is_popular, badge_color_hex, created_at, creator)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `;
      const res: any = await query(sql, [
        serviceName,
        newService.description,
        newService.price,
        units_id,
        service_categories_id,
        icons_id,
        newService.duration,
        newService.is_popular ? 1 : 0,
        newService.badge_color_hex,
        creatorVal,
      ]);
      if (res && res.insertId) {
        newService.id_services = res.insertId;
        newService.id =
          CryptoUtil.encryptId(res.insertId) ?? String(res.insertId);
        return (await this.findById(res.insertId)) || newService;
      }
    } catch (err: any) {
      console.error("Create service error:", err);
      throw err;
    }

    return newService;
  }

  async update(
    id: string | number,
    service: Partial<ServiceEntity> & Record<string, any>,
    updatePic?: number,
  ): Promise<ServiceEntity | null> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const serviceName = service.name_services ?? service.name ?? null;

    // Check if foreign keys need resolving
    let units_id: number | null = null;
    if (
      service.units_id !== undefined ||
      service.unit_id !== undefined ||
      service.unit !== undefined
    ) {
      const fks = await this.resolveForeignKeys(service);
      units_id = fks.units_id;
    }

    let service_categories_id: number | null = null;
    if (
      service.service_categories_id !== undefined ||
      service.category_id !== undefined ||
      service.service_category_id !== undefined ||
      service.category !== undefined
    ) {
      const fks = await this.resolveForeignKeys(service);
      service_categories_id = fks.service_categories_id;
    }

    let icons_id: number | null | undefined = undefined;
    if (
      service.icons_id !== undefined ||
      service.icon_id !== undefined ||
      service.icon_code !== undefined
    ) {
      const fks = await this.resolveForeignKeys(service);
      icons_id = fks.icons_id;
    }

    try {
      const sql = `
        UPDATE services SET
          name_services = COALESCE(?, name_services),
          description = COALESCE(?, description),
          price = COALESCE(?, price),
          units_id = COALESCE(?, units_id),
          service_categories_id = COALESCE(?, service_categories_id),
          icons_id = CASE WHEN ? = 1 THEN ? ELSE icons_id END,
          duration = COALESCE(?, duration),
          is_popular = COALESCE(?, is_popular),
          badge_color_hex = COALESCE(?, badge_color_hex),
          update_pic = ?,
          updated_at = NOW()
        WHERE id_services = ? AND deleted_at IS NULL
      `;
      await query(sql, [
        serviceName,
        service.description ?? null,
        service.price ?? null,
        units_id,
        service_categories_id,
        icons_id !== undefined ? 1 : 0,
        icons_id ?? null,
        service.duration ?? null,
        service.is_popular !== undefined ? (service.is_popular ? 1 : 0) : null,
        service.badge_color_hex ?? null,
        updatePic ?? null,
        numericId,
      ]);
      return this.findById(numericId);
    } catch (err: any) {
      console.error("Update service error:", err);
      throw err;
    }
  }

  async softDelete(id: string | number, deletePic?: number): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    try {
      await query(
        "UPDATE services SET deleted_at = NOW(), delete_pic = ? WHERE id_services = ?",
        [deletePic || null, numericId],
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}
