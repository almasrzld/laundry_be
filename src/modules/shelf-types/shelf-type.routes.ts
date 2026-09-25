import { Router } from "express";
import { ShelfTypeController } from "./shelf-type.controller";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../middleware/auth.middleware";
import { resourcePermission } from "../../middleware/permission.middleware";

const router = Router();
const controller = new ShelfTypeController();
const perm = resourcePermission("jenis-rak");

router.get("/", optionalAuthMiddleware, controller.getShelfTypes);
router.get("/:id", optionalAuthMiddleware, controller.getShelfTypeById);
router.post("/", authMiddleware, perm.create, controller.createShelfType);
router.put("/:id", authMiddleware, perm.update, controller.updateShelfType);
router.delete("/:id", authMiddleware, perm.delete, controller.deleteShelfType);

export default router;
