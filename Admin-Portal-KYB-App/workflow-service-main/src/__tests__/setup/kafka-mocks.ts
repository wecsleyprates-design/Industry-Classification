/**
 * Kafka Mocks for Jest Tests
 *
 * This file contains mocks for kafkajs and the Kafka helper to ensure
 * tests can run without requiring actual Kafka infrastructure.
 *
 * It mocks:
 * - kafkajs library (Kafka, Consumer, Producer, Admin)
 * - #helpers/kafka module
 * - Sets up test environment variables
 */

import { KAFKA_TOPICS } from "#constants/kafka.constants";
import { envConfig } from "#configs/env.config";

// Mock kafkajs
jest.mock("kafkajs", () => ({
	Kafka: jest.fn().mockImplementation(() => ({
		consumer: jest.fn().mockReturnValue({
			connect: jest.fn().mockResolvedValue(Promise.resolve()),
			subscribe: jest.fn().mockResolvedValue(Promise.resolve()),
			run: jest.fn().mockResolvedValue(Promise.resolve()),
			commitOffsets: jest.fn().mockResolvedValue(Promise.resolve()),
			disconnect: jest.fn().mockResolvedValue(Promise.resolve())
		}),
		producer: jest.fn().mockReturnValue({
			connect: jest.fn().mockResolvedValue(Promise.resolve()),
			send: jest.fn().mockResolvedValue(Promise.resolve()),
			disconnect: jest.fn().mockResolvedValue(Promise.resolve())
		}),
		admin: jest.fn().mockReturnValue({
			connect: jest.fn().mockResolvedValue(Promise.resolve()),
			listTopics: jest.fn().mockResolvedValue([KAFKA_TOPICS.CASES_V1]),
			createTopics: jest.fn().mockResolvedValue(Promise.resolve()),
			disconnect: jest.fn().mockResolvedValue(Promise.resolve())
		})
	})),
	logLevel: {
		ERROR: "ERROR",
		WARN: "WARN",
		INFO: "INFO",
		DEBUG: "DEBUG"
	},
	Partitioners: {
		LegacyPartitioner: "LegacyPartitioner"
	}
}));

// Mock Kafka helper
jest.mock("#helpers/kafka", () => ({
	consumer: {
		init: jest.fn().mockResolvedValue(Promise.resolve()),
		run: jest.fn().mockResolvedValue(Promise.resolve()),
		commitOffsets: jest.fn().mockResolvedValue(Promise.resolve())
	},
	producer: {
		init: jest.fn().mockResolvedValue(Promise.resolve()),
		send: jest.fn().mockResolvedValue(Promise.resolve())
	},
	confirmKafkaTopicsExist: jest.fn().mockResolvedValue(Promise.resolve())
}));

// Set test environment
process.env.NODE_ENV = "test";
process.env.CONFIG_KAFKA_BROKERS = envConfig.KAFKA_BROKERS ?? "localhost:9092";
process.env.CONFIG_KAFKA_CLIENT_ID = envConfig.KAFKA_CLIENT_ID ?? "workflow-service-test";
process.env.CONFIG_KAFKA_GROUP_ID = envConfig.KAFKA_GROUP_ID ?? "workflow-service-test-group";
process.env.CONFIG_KAFKA_SSL_ENABLED = String(envConfig.KAFKA_SSL_ENABLED || false);

export {};
