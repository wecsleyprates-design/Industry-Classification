import { Router } from "express";
import { validateUser, throttleMiddleware } from "#middlewares";
import { Utils, Workflows } from "@joinworth/types";
import { controller as api } from "./controller";

const router = Router();

// Execution logs export endpoint - throttle to 10 requests per minute for CSV export
router
	.route("/customers/:customerId/execution-logs")
	.get(
		validateUser,
		throttleMiddleware({ maxRequests: 10, windowMs: 60000, endpointKey: "execution-logs" }),
		Utils.validateQuery(Workflows.Audits.ExportExecutionLogsQuerySchema),
		api.exportExecutionLogs
	);

// Workflow changes logs export endpoint - throttle to 10 requests per minute for CSV export
router
	.route("/customers/:customerId/workflow-changes")
	.get(
		validateUser,
		throttleMiddleware({ maxRequests: 10, windowMs: 60000, endpointKey: "workflow-changes" }),
		Utils.validateQuery(Workflows.Audits.ExportWorkflowChangesLogsQuerySchema),
		api.exportWorkflowChangesLogs
	);

router
	.route("/executions/latest")
	.get(
		validateUser,
		Utils.validateQuery(Workflows.Audits.GetCaseExecutionDetailsQuerySchema),
		api.getCaseExecutionDetails
	);

export default router;
