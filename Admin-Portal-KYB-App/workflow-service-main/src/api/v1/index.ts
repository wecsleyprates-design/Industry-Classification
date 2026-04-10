import { Router } from "express";
import workflowRoutes from "#workflows/routes";
import triggerRoutes from "./modules/triggers/routes";
import auditRoutes from "./modules/audit/routes";
import attributeRoutes from "./modules/attributes/routes";
import { sharedRoutes } from "./modules/shared";

const router = Router();

router.get("/", (req, res) => {
	res.jsend.success("Hello Workflow Service v1 API");
});

router.use("/workflows", workflowRoutes);
router.use("/triggers", triggerRoutes);
router.use("/audit", auditRoutes);
router.use("/attributes", attributeRoutes);
router.use("/shared", sharedRoutes);

export default router;
