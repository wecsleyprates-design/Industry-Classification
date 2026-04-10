import { logger } from "#helpers/logger";
import type { CaseData } from "#core/types";
import type { WorkflowAction } from "#core/actions/types";
import { ACTION_TYPES } from "#constants";
import { ActionStrategy } from "./actionStrategy";
import { SetFieldStrategy } from "./setFieldStrategy";

export class ActionProcessor {
	private strategies: Map<string, ActionStrategy> = new Map();

	constructor() {
		this.registerStrategies();
	}

	private registerStrategies(): void {
		this.strategies.set(ACTION_TYPES.SET_FIELD, new SetFieldStrategy());
		// Add other strategies here
	}

	async processActions(actions: WorkflowAction[], caseData: CaseData): Promise<void> {
		logger.debug(`Processing ${actions.length} actions for case ${caseData.id}`);

		for (const action of actions) {
			await this.processAction(action, caseData);
		}
	}

	private async processAction(action: WorkflowAction, caseData: CaseData): Promise<void> {
		logger.debug(`Processing action for case ${caseData.id}:`, action);

		const strategy = this.strategies.get(action.type);
		if (!strategy) {
			logger.warn(`Unknown action type: ${action.type} for case ${caseData.id}`);
			return;
		}

		try {
			await strategy.execute(action.parameters, caseData);
			logger.debug(`Action ${action.type} executed successfully for case ${caseData.id}`);
		} catch (error) {
			logger.error({ error }, `Error executing action ${action.type} for case ${caseData.id}`);
			throw error;
		}
	}
}

export const actionProcessor = new ActionProcessor();
