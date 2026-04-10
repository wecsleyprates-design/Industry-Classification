import { BullQueue } from "#helpers/bullQueue";
import { QUEUES, EVENTS } from "#constants";
import { logger } from "#helpers/logger";
import { workflowConfig } from "#configs";
import { WorkflowProcessor } from "./workflowProcessor";
import { type WorkflowJobData, type WorkflowResult } from "#core/workflow/types";
import type { Job } from "bull";

export const workflowQueue = new BullQueue<WorkflowJobData>(QUEUES.WORKFLOW_PROCESSING, {
	defaultJobOptions: {
		removeOnComplete: workflowConfig.processingQueue.removeOnComplete,
		removeOnFail: workflowConfig.processingQueue.removeOnFail,
		attempts: workflowConfig.processingQueue.retry.attempts,
		backoff: {
			type: workflowConfig.processingQueue.retry.backoffType,
			delay: workflowConfig.processingQueue.retry.backoffDelay
		}
	}
});

export const initWorkflowWorker = () => {
	// Define the job processor for the workflow processing queue
	void workflowQueue.queue.process(EVENTS.PROCESS_WORKFLOW, async (job: Job<WorkflowJobData>) => {
		const {
			case_id: caseId,
			customer_id: customerId,
			enqueued_at: enqueuedAt,
			annotations,
			previous_status: previousStatus
		} = job.data;
		const attemptNumber = job.attemptsMade;
		const maxAttempts = job.opts.attempts ?? 1;

		logger.info(
			`Workflow Worker: Processing case ${caseId} for customer ${customerId} (attempt ${attemptNumber + 1}/${maxAttempts})${previousStatus ? `, previous_status=${previousStatus}` : ""}`
		);

		try {
			const processor = new WorkflowProcessor();
			const result = await processor.processWorkflow(caseId, customerId, enqueuedAt, annotations, previousStatus);

			logger.info(`✔ Workflow Worker: Completed case ${caseId}`, result);
			return result;
		} catch (error) {
			if (attemptNumber < maxAttempts) {
				logger.warn(
					`⚠ Workflow Worker: Failed case ${caseId} (attempt ${attemptNumber + 1}/${maxAttempts}), will retry`,
					error
				);
			} else {
				logger.error({ error }, `✗ Workflow Worker: Failed case ${caseId} after ${maxAttempts} attempts`);
			}
			throw error;
		}
	});

	// Handle queue events
	workflowQueue.queue.on("completed", (job: Job<WorkflowJobData>, result: WorkflowResult) => {
		logger.info(`✔ Workflow completed: ${job.id}`, result);
	});

	workflowQueue.queue.on("failed", (job: Job<WorkflowJobData>, err: Error) => {
		logger.error({ err }, `✗ Workflow failed: ${job.id}`);
	});

	workflowQueue.queue.on("stalled", (job: Job<WorkflowJobData>) => {
		logger.warn(`⚠ Workflow stalled: ${job.id}`);
	});

	workflowQueue.queue.on("retrying", (job: Job<WorkflowJobData>, err: Error) => {
		logger.warn(`⚠ Workflow retrying: ${job.id} (attempt ${job.attemptsMade}/${job.opts.attempts})`, err);
	});
};
