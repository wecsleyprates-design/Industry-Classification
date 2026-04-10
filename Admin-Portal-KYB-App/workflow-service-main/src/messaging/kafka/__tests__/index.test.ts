import { initKafkaHandler } from "../index";
import { consumer, confirmKafkaTopicsExist } from "#helpers/kafka";
import { logger } from "#helpers/logger";
import { KAFKA_SUBSCRIBE_TOPICS, KAFKA_PUSH_TOPICS } from "#constants";
import { handler } from "../consumers";

// Mock dependencies
jest.mock("#helpers/kafka");
jest.mock("#helpers/logger");
jest.mock("../consumers");

describe("initKafkaHandler", () => {
	const mockConsumer = consumer as jest.Mocked<typeof consumer>;
	const mockConfirmKafkaTopicsExist = confirmKafkaTopicsExist as jest.MockedFunction<typeof confirmKafkaTopicsExist>;
	const mockLogger = logger as jest.Mocked<typeof logger>;
	const mockHandler = handler as jest.MockedFunction<typeof handler>;

	const topicsToEnsure = [...new Set([...KAFKA_SUBSCRIBE_TOPICS, ...KAFKA_PUSH_TOPICS])];

	beforeEach(() => {
		jest.clearAllMocks();
		mockConfirmKafkaTopicsExist.mockResolvedValue(undefined);
		mockConsumer.init.mockResolvedValue(undefined);
		mockConsumer.run.mockResolvedValue(undefined);
	});

	it("should initialize Kafka handler successfully", async () => {
		await initKafkaHandler();

		expect(mockLogger.info).toHaveBeenCalledWith("Initializing KAFKA Handler...");
		expect(mockConfirmKafkaTopicsExist).toHaveBeenCalledWith(topicsToEnsure);
		expect(mockConsumer.init).toHaveBeenCalled();
		expect(mockConsumer.run).toHaveBeenCalledWith(KAFKA_SUBSCRIBE_TOPICS, mockHandler);
		expect(mockLogger.info).toHaveBeenCalledWith(
			`✔ KAFKA Handler initialized and listening on topics: ${KAFKA_SUBSCRIBE_TOPICS.join(", ")}`
		);
	});

	it("should handle topic confirmation failure", async () => {
		const error = new Error("Topic confirmation failed");
		mockConfirmKafkaTopicsExist.mockRejectedValue(error);

		await expect(initKafkaHandler()).rejects.toThrow("Topic confirmation failed");
		expect(mockLogger.error).toHaveBeenCalledWith({ error }, "Failed to initialize KAFKA Handler");
		expect(mockConsumer.init).not.toHaveBeenCalled();
		expect(mockConsumer.run).not.toHaveBeenCalled();
	});

	it("should handle consumer init failure", async () => {
		const error = new Error("Consumer init failed");
		mockConfirmKafkaTopicsExist.mockResolvedValue(undefined);
		mockConsumer.init.mockRejectedValue(error);

		await expect(initKafkaHandler()).rejects.toThrow("Consumer init failed");
		expect(mockLogger.error).toHaveBeenCalledWith({ error }, "Failed to initialize KAFKA Handler");
		expect(mockConsumer.run).not.toHaveBeenCalled();
	});

	it("should handle consumer run failure", async () => {
		const error = new Error("Consumer run failed");
		mockConfirmKafkaTopicsExist.mockResolvedValue(undefined);
		mockConsumer.init.mockResolvedValue(undefined);
		mockConsumer.run.mockRejectedValue(error);

		await expect(initKafkaHandler()).rejects.toThrow("Consumer run failed");
		expect(mockLogger.error).toHaveBeenCalledWith({ error }, "Failed to initialize KAFKA Handler");
	});

	it("should verify mock is working", async () => {
		const testError = new Error("Test error");
		mockConfirmKafkaTopicsExist.mockReset();
		mockConfirmKafkaTopicsExist.mockRejectedValue(testError);

		await expect(initKafkaHandler()).rejects.toThrow("Test error");
		expect(mockLogger.error).toHaveBeenCalledWith({ error: testError }, "Failed to initialize KAFKA Handler");
	});
});
