import { Request, Response, NextFunction } from "express";
import { CryptoUtil } from "../utils/crypto.util";

/**
 * Middleware untuk secara otomatis mendekripsi ID dari params, query, dan body
 * sehingga controller dan database selalu menerima integer ID yang valid.
 */
export const decryptRequestMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      if (
        key === "id" ||
        key.startsWith("id_") ||
        key.endsWith("_id") ||
        [
          "user_id",
          "order_id",
          "service_id",
          "role_id",
          "parent_id",
        ].includes(key)
      ) {
        const val = req.query[key];
        if (typeof val === "string" && val.trim()) {
          const dec = CryptoUtil.decryptId(val);
          if (dec !== null) {
            req.query[key] = String(dec);
          }
        }
      }
    }
  }

  // 2. Dekripsi route params (di Express params diproses saat route match, tapi bila sudah ada)
  if (req.params && typeof req.params === "object") {
    for (const key of Object.keys(req.params)) {
      const val = req.params[key];
      if (typeof val === "string" && val.trim()) {
        const dec = CryptoUtil.decryptId(val);
        if (dec !== null) {
          req.params[key] = String(dec);
        }
      }
    }
  }

  // 3. Dekripsi request body (JSON payload)
  if (req.body && typeof req.body === "object") {
    const decryptObject = (obj: any) => {
      if (!obj || typeof obj !== "object") return;

      for (const key of Object.keys(obj)) {
        if (
          key === "id" ||
          key.startsWith("id_") ||
          key.endsWith("_id") ||
          [
            "parent_id",
            "user_id",
            "order_id",
            "role_id",
            "menu_id",
            "permission_id",
          ].includes(key)
        ) {
          if (obj[key] !== undefined && obj[key] !== null) {
            if (
              (key === "parent_id" || key === "menus_id") &&
              (obj[key] === "root" || obj[key] === "")
            ) {
              obj[key] = null;
            } else if (typeof obj[key] === "string") {
              const dec = CryptoUtil.decryptId(obj[key]);
              if (dec !== null) {
                obj[key] = dec;
              }
            }
          }
        }
      }

      // Khusus untuk array reorder items (misal reorder menu)
      if (Array.isArray(obj.items)) {
        for (const item of obj.items) {
          if (item) {
            const rawId = item.id_menus ?? item.id;
            if (rawId && typeof rawId === "string") {
              const dec = CryptoUtil.decryptId(rawId);
              if (dec !== null) {
                item.id = dec;
                item.id_menus = dec;
              }
            }
          }
        }
      }
    };

    decryptObject(req.body);
  }

  next();
};

/**
 * Route parameter helper untuk mendekripsi :id atau :*Id secara otomatis saat route match
 */
export const decryptParamHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
  val: string,
  name: string,
): void => {
  if (val) {
    const dec = CryptoUtil.decryptId(val);
    if (dec !== null) {
      req.params[name] = String(dec);
    }
  }
  next();
};
