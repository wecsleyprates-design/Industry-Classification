import { logger } from "#helpers/logger";
import type { CaseData } from "#core/types";
import type { TriggerEvaluationLog, WorkflowTriggerCarrier } from "#core/trigger/types";
import { BaseEvaluator } from "./baseEvaluator";

export class TriggerEvaluator extends BaseEvaluator {
	/**
	 * Evaluates a workflow trigger against case data using JSON Logic format
	 * @param caseData - The case data to evaluate against
	 * @param workflow - The workflow containing the trigger expression
	 * @returns TriggerEvaluationLog
	 */
	static evaluateTrigger(caseData: CaseData, workflow: WorkflowTriggerCarrier): TriggerEvaluationLog {
		try {
			logger.debug(`Evaluating trigger for workflow ${workflow.id} against case ${caseData.id}`);

			const trigger = workflow.trigger;

			if (!trigger) {
				return {
					workflow_id: workflow.id,
					matched: false,
					error: "No trigger defined for workflow"
				};
			}

			const result = this.evaluateJsonLogic(trigger, caseData, undefined, "trigger");

			logger.debug(`Trigger evaluation result for workflow ${workflow.id}: ${result}`);

			return {
				workflow_id: workflow.id,
				matched: Boolean(result)
			};
		} catch (error) {
			logger.error({ error }, `Error evaluating trigger for workflow ${workflow.id}`);
			return {
				workflow_id: workflow.id,
				matched: false,
				error: error instanceof Error ? error.message : "Unknown error"
			};
		}
	}
}
