import { Router } from "express";
import { ServiceController } from "./service.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { resourcePermission } from "../../middleware/permission.middleware";

const router = Router();
const controller = new ServiceController();
const perm = resourcePermission("service");

router.get("/", authMiddleware, perm.index, controller.getServices);
router.get("/:id", authMiddleware, perm.show, controller.getServiceById);
router.post("/", authMiddleware, perm.create, controller.createService);
router.put("/:id", authMiddleware, perm.update, controller.updateService);
router.delete("/:id", authMiddleware, perm.delete, controller.deleteService);

export default router;
