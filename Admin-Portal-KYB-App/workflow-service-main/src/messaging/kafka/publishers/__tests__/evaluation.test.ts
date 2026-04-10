import { logger } from "#helpers/logger";
import { producer } from "#helpers/kafka";
import { KAFKA_MESSAGE_KEYS, KAFKA_TOPICS } from "#constants";
import { publishSharedRulesEvaluationResult } from "#messaging/kafka/publishers/evaluation";

jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn()
	}
}));

jest.mock("#helpers/kafka", () => ({
	producer: {
		init: jest.fn().mockResolvedValue(undefined),
		send: jest.fn().mockResolvedValue(undefined)
	}
}));

describe("publishSharedRulesEvaluationResult", () => {
	const baseResult = {
		evaluation_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		results: [
			{
				rule_id: "r1",
				rule_name: "N1",
				matched: true,
				conditions: {},
				true_conditions: [],
				false_conditions: []
			}
		]
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("does not publish when business_id is missing", async () => {
		await publishSharedRulesEvaluationResult({ result: baseResult });
		expect(producer.send).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalled();
	});

	it("publishes to workflows.v1 with business_id as key", async () => {
		await publishSharedRulesEvaluationResult({
			businessId: "7b3e9c2a-4d1f-4e8b-9c6a-2f8e1d0b7c55",
			customerId: "c0ffee00-0000-4000-8000-000000000001",
			result: baseResult
		});

		expect(producer.init).toHaveBeenCalled();
		expect(producer.send).toHaveBeenCalledWith({
			topic: KAFKA_TOPICS.WORKFLOWS_V1,
			messages: [
				{
					key: "7b3e9c2a-4d1f-4e8b-9c6a-2f8e1d0b7c55",
					value: expect.objectContaining({
						event: KAFKA_MESSAGE_KEYS.SHARED_RULES_EVALUATION_EVENT,
						business_id: "7b3e9c2a-4d1f-4e8b-9c6a-2f8e1d0b7c55",
						customer_id: "c0ffee00-0000-4000-8000-000000000001",
						evaluation_id: baseResult.evaluation_id,
						rule_evaluations: [{ rule_id: "r1", rule_name: "N1", matched: true }]
					})
				}
			]
		});
	});

	it("does not publish when business_id is only whitespace", async () => {
		await publishSharedRulesEvaluationResult({
			businessId: "   \t  ",
			result: baseResult
		});
		expect(producer.send).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalled();
	});

	it("propagates when producer.send rejects", async () => {
		const kafkaError = new Error("broker down");
		(producer.send as jest.Mock).mockRejectedValueOnce(kafkaError);

		await expect(
			publishSharedRulesEvaluationResult({
				businessId: "7b3e9c2a-4d1f-4e8b-9c6a-2f8e1d0b7c55",
				result: baseResult
			})
		).rejects.toThrow("broker down");

		expect(logger.error).toHaveBeenCalledWith(
			{ error: kafkaError },
			"Failed to publish shared rules evaluation result to Kafka"
		);
	});

	it("sends evaluation_id null when result has no evaluation_id", async () => {
		await publishSharedRulesEvaluationResult({
			businessId: "7b3e9c2a-4d1f-4e8b-9c6a-2f8e1d0b7c55",
			result: { results: baseResult.results }
		});

		expect(producer.send).toHaveBeenCalledWith({
			topic: KAFKA_TOPICS.WORKFLOWS_V1,
			messages: [
				{
					key: "7b3e9c2a-4d1f-4e8b-9c6a-2f8e1d0b7c55",
					value: expect.objectContaining({
						evaluation_id: null,
						business_id: "7b3e9c2a-4d1f-4e8b-9c6a-2f8e1d0b7c55"
					})
				}
			]
		});
	});
});
