import { consumer, producer, confirmKafkaTopicsExist } from "#helpers/kafka";

jest.mock("kafkajs", () => {
	const mockConsumer = {
		connect: jest.fn().mockResolvedValue(undefined),
		subscribe: jest.fn().mockResolvedValue(undefined),
		run: jest.fn().mockResolvedValue(undefined),
		commitOffsets: jest.fn().mockResolvedValue(undefined),
		disconnect: jest.fn().mockResolvedValue(undefined)
	};

	const mockProducer = {
		connect: jest.fn().mockResolvedValue(undefined),
		send: jest.fn().mockResolvedValue(undefined),
		disconnect: jest.fn().mockResolvedValue(undefined)
	};

	const mockAdmin = {
		connect: jest.fn().mockResolvedValue(undefined),
		listTopics: jest.fn().mockResolvedValue([]),
		createTopics: jest.fn().mockResolvedValue(undefined),
		disconnect: jest.fn().mockResolvedValue(undefined)
	};

	return {
		Kafka: jest.fn().mockImplementation(() => ({
			consumer: jest.fn().mockReturnValue(mockConsumer),
			producer: jest.fn().mockReturnValue(mockProducer),
			admin: jest.fn().mockReturnValue(mockAdmin)
		}))
	};
});

jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	}
}));

jest.mock("#configs/env.config", () => ({
	envConfig: {
		ENV: "development"
	}
}));

describe("Kafka Helper", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Consumer", () => {
		it("should initialize consumer", async () => {
			await consumer.init();
			expect(consumer.init).toHaveBeenCalled();
		});

		it("should run consumer with topics and handler", async () => {
			const topics = ["test-topic"];
			const handler = jest.fn();

			await consumer.run(topics, handler);

			expect(consumer.run).toHaveBeenCalledWith(topics, handler);
		});

		it("should commit offsets", async () => {
			const offsets = [{ topic: "test-topic", partition: 0, offset: "100" }];

			await consumer.commitOffsets(offsets);

			expect(consumer.commitOffsets).toHaveBeenCalledWith(offsets);
		});
	});

	describe("Producer", () => {
		it("should initialize producer", async () => {
			await producer.init();
			expect(producer.init).toHaveBeenCalled();
		});

		it("should send message successfully", async () => {
			const messageData = {
				topic: "test-topic",
				messages: [
					{
						key: "test-key",
						value: {
							event: "test-event",
							data: "test-value"
						}
					}
				]
			};

			await producer.send(messageData);

			expect(producer.send).toHaveBeenCalledWith(messageData);
		});
	});

	describe("confirmKafkaTopicsExist", () => {
		it("should be callable", async () => {
			await expect(confirmKafkaTopicsExist(["topic1"])).resolves.not.toThrow();
		});
	});
});
