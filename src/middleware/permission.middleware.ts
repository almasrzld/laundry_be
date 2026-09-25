import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { query } from "../config/database";
import { sendError } from "../utils/response.util";

/**
 * Helper to check if a role has the required permission(s)
 */
export async function hasRolePermission(
  roleCodeOrId: string | number,
  requiredPermissions: string | string[],
): Promise<boolean> {
  const perms = Array.isArray(requiredPermissions)
    ? requiredPermissions.map((p) => p.toLowerCase().trim())
    : [requiredPermissions.toLowerCase().trim()];

  if (perms.length === 0) return true;

  const normalizedRole = String(roleCodeOrId).toLowerCase().trim();

  // Query permissions attached to this role from database strictly
  const sql = `
    SELECT p.code
    FROM role_permissions rp
    JOIN permissions p ON rp.permissions_id = p.id_permissions
    JOIN roles r ON rp.roles_id = r.id_roles
    WHERE (LOWER(r.code) = LOWER(?) OR LOWER(r.name_roles) = LOWER(?) OR r.id_roles = ?)
      AND rp.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND r.deleted_at IS NULL
  `;

  const rows = await query<{ code: string }>(sql, [
    normalizedRole,
    normalizedRole,
    roleCodeOrId,
  ]);
  const userPermCodes = new Set(rows.map((r) => (r.code || "").toLowerCase()));

  // Check if at least one of the required permissions is granted (OR logic)
  return perms.some((p) => userPermCodes.has(p) || userPermCodes.has("*"));
}

export const requirePermission = (
  permissionOrPermissions: string | string[],
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        sendError(res, "Autentikasi diperlukan untuk mengakses rute ini", 401);
        return;
      }

      const roleCode = user.role_code || user.role || "user";
      const isAllowed = await hasRolePermission(
        roleCode,
        permissionOrPermissions,
      );

      if (!isAllowed) {
        const requiredStr = Array.isArray(permissionOrPermissions)
          ? permissionOrPermissions.join(" atau ")
          : permissionOrPermissions;

        sendError(
          res,
          `Akses ditolak: Anda tidak memiliki izin [${requiredStr}] untuk melakukan aksi ini`,
          403,
          { required_permission: permissionOrPermissions },
        );
        return;
      }

      next();
    } catch (error: any) {
      sendError(
        res,
        error.message || "Terjadi kesalahan saat memeriksa izin akses",
        500,
      );
    }
  };
};

export const resourcePermission = (resourceName: string) => ({
  index: requirePermission(`${resourceName}.index`),
  create: requirePermission([
    `${resourceName}.create`,
    `${resourceName}.store`,
  ]),
  show: requirePermission([`${resourceName}.show`, `${resourceName}.index`]),
  update: requirePermission([`${resourceName}.edit`, `${resourceName}.update`]),
  delete: requirePermission([
    `${resourceName}.delete`,
    `${resourceName}.destroy`,
  ]),
});
