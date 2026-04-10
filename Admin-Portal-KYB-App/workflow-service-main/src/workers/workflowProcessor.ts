import { logger } from "#helpers/logger";
import { type WorkflowResult } from "#core/workflow/types";
import { workflowManager } from "../core";
import type { WorkflowAnnotations } from "#core/types";

export class WorkflowProcessor {
	async processWorkflow(
		caseId: string,
		customerId: string,
		enqueuedAt: string,
		annotations?: WorkflowAnnotations,
		previousStatus?: string
	): Promise<WorkflowResult> {
		logger.info(`Processing workflow for case ${caseId}, customer ${customerId}...`);
		logger.info(`Job was enqueued at: ${enqueuedAt}${previousStatus ? `, previous_status: ${previousStatus}` : ""}`);

		try {
			// Use EvaluationEngine to process the case
			logger.info(`Workflow processing started for case ${caseId}...`);

			// Process the case using the evaluation engine
			await workflowManager.processCaseEvent(caseId, { customerId, annotations, previous_status: previousStatus });

			logger.info(`✔ Workflow processing completed for case ${caseId}`);

			return {
				case_id: caseId,
				customer_id: customerId,
				status: "completed",
				processed_at: new Date().toISOString(),
				enqueued_at: enqueuedAt
			};
		} catch (error) {
			logger.error({ error }, `✗ Error processing workflow for case ${caseId}`);
			throw error;
		}
	}
}
