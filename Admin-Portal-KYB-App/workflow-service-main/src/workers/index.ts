import { logger } from "#helpers";
import { initWorkflowWorker } from "./workflowWorker";
import { workflowManager } from "../core";

export const initWorkers = async () => {
	logger.info("Initializing Workflow Service Workers...");

	// Validate evaluation engine setup
	const setupValid = await workflowManager.validateSetup();
	if (!setupValid) {
		logger.error("Evaluation engine setup validation failed, workers will not start");
	}

	// Initialize workflow worker (Bull Queue based)
	initWorkflowWorker();

	logger.info("✔ Workflow Service Workers initialized");
};
