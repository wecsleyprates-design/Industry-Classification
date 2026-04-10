import { Router } from "express";
import { validateUser, methodNotAllowed } from "#middlewares";
import { Utils, Workflows } from "@joinworth/types";
import { controller as api } from "./controller";

const router = Router();

router
	.route("/customers/:customerId/catalog")
	.get(validateUser, Utils.validateQuery(Workflows.Attributes.GetAttributeCatalogQuerySchema), api.getAttributeCatalog)
	.all(methodNotAllowed);

export default router;
