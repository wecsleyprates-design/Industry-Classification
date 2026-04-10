import type { EvaluateRulesResponse } from "#types/workflow-dtos";

export type PublishSharedRulesEvaluationParams = {
	businessId?: string;
	customerId?: string;
	result: EvaluateRulesResponse;
};
