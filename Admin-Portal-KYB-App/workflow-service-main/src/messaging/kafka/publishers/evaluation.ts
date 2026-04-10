import { producer } from "#helpers/kafka";
import { KAFKA_MESSAGE_KEYS, KAFKA_TOPICS } from "#constants";
import { logger } from "#helpers/logger";
import type { SharedRulesEvaluationKafkaPayload } from "#types/workflow-dtos";
import type { PublishSharedRulesEvaluationParams } from "./types";

export type { PublishSharedRulesEvaluationParams } from "./types";

export async function publishSharedRulesEvaluationResult(params: PublishSharedRulesEvaluationParams): Promise<void> {
	const { businessId, customerId, result } = params;

	if (!businessId || String(businessId).trim() === "") {
		logger.error(
			{ evaluation_id: result.evaluation_id, resultCount: result.results?.length },
			"Shared rules evaluation: skipping Kafka publish — business_id is missing"
		);
		return;
	}

	await producer.init();

	const payload: SharedRulesEvaluationKafkaPayload = {
		event: KAFKA_MESSAGE_KEYS.SHARED_RULES_EVALUATION_EVENT,
		evaluation_id: result.evaluation_id ?? null,
		business_id: businessId,
		...(customerId !== undefined && { customer_id: customerId }),
		rule_evaluations: result.results.map(r => ({
			rule_id: r.rule_id,
			rule_name: r.rule_name,
			matched: r.matched
		}))
	};

	try {
		await producer.send({
			topic: KAFKA_TOPICS.WORKFLOWS_V1,
			messages: [
				{
					key: businessId,
					value: payload as unknown as { event: string; [key: string]: unknown }
				}
			]
		});
	} catch (error) {
		logger.error({ error }, "Failed to publish shared rules evaluation result to Kafka");
		throw error;
	}
}
