import { Router } from "express";
import { routeNotFound } from "#middlewares/index";
import { getHealth } from "./health";
import v1Routes from "./v1";

const router = Router();

router.get("/", (req, res) => {
	res.jsend.success("Hello Workflow Service API");
});

router.get("/health", getHealth);
router.use("/v1", v1Routes);
router.use(routeNotFound);

export default router;
