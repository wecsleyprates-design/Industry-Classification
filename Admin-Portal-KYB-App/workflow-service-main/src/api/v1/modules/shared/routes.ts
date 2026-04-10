import { Router } from "express";
import { validateUser, validateIdParam, createValidateSubroleForWrite } from "#middlewares";
import { ROLES } from "#constants";
import { Utils, Workflows } from "@joinworth/types";
import { controller as api } from "./controller";

const validateSharedRulesWrite = createValidateSubroleForWrite([ROLES.ADMIN, ROLES.CUSTOMER] as const, "shared rules");

const router = Router();

router.post(
	"/internal/rules/details",
	Utils.validateBody(Workflows.Shared.Rules.GetSharedRuleDetailsBatchRequestSchema),
	api.getRuleDetailsBatch
);

router.post(
	"/rules/evaluate",
	validateUser,
	validateSharedRulesWrite,
	Utils.validateBody(Workflows.Shared.Evaluations.EvaluateRulesRequestSchema, {
		unrecognizedKeys: "loose",
		mutate: true
	}),
	api.evaluateRules
);

router
	.route("/internal/rules")
	.post(Utils.validateBody(Workflows.Shared.Rules.CreateSharedRuleRequestSchema), api.createRule);

router
	.route("/internal/rules/:id")
	.put(validateIdParam, Utils.validateBody(Workflows.Shared.Rules.UpdateSharedRuleRequestSchema), api.updateRule);

export default router;
