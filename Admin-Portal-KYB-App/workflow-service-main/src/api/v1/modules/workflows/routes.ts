import { Router } from "express";
import { validateSchema, validateUser, validateIdParam, validateRole, validateSubroleForWrite } from "#middlewares";
import { Utils, Workflows } from "@joinworth/types";
import { ROLES } from "#constants";
import { createWorkflowDraftSchema, addRulesSchema, previewEvaluationSchema, updateWorkflowSchema } from "./schema";
import { controller as api } from "./controller";

const router = Router();

router
	.route("/customers/:customerId/workflows")
	.post(validateUser, validateSubroleForWrite, validateSchema(createWorkflowDraftSchema), api.createWorkflow);

router
	.route("/customers/:customerId/workflows")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		Utils.validateQuery(Workflows.Workflows.GetWorkflowsListQuerySchema),
		api.getWorkflowsList
	);

router
	.route("/:id/rules")
	.put(validateUser, validateSubroleForWrite, validateIdParam, validateSchema(addRulesSchema), api.addRules);

router
	.route("/:id/priority")
	.put(
		validateUser,
		validateSubroleForWrite,
		validateIdParam,
		Utils.validateBody(Workflows.Workflows.ChangePriorityRequestSchema),
		api.changePriority
	);

router
	.route("/:id")
	.put(
		validateUser,
		validateSubroleForWrite,
		validateIdParam,
		validateSchema(updateWorkflowSchema),
		api.updateWorkflow
	);

router.route("/versions/:id/publish").post(validateUser, validateSubroleForWrite, validateIdParam, api.publishWorkflow);

router.route("/:id").delete(validateUser, validateSubroleForWrite, api.deleteDraftWorkflow);

router
	.route("/:id/preview")
	.post(validateUser, validateIdParam, validateSchema(previewEvaluationSchema), api.previewEvaluation);

router
	.route("/:id/status")
	.patch(
		validateUser,
		validateSubroleForWrite,
		validateIdParam,
		Utils.validateBody(Workflows.Workflows.UpdateWorkflowStatusRequestSchema),
		api.updateWorkflowStatus
	);

router.route("/:id").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateIdParam, api.getWorkflowById);

export default router;
