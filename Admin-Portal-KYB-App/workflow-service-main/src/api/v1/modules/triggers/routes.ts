import { Router } from "express";
import { methodNotAllowed } from "#middlewares";
import { controller as api } from "./controller";

const router = Router();

// Get triggers endpoint
router.route("/").get(api.getTriggers).all(methodNotAllowed);

export default router;
