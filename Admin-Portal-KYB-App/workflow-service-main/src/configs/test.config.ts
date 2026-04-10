// Test configuration for Kafka
export const testKafkaConfig = {
	brokers: ["localhost:9092"],
	clientId: "workflow-service-test",
	connectionTimeout: 1000,
	requestTimeout: 5000,
	retry: {
		maxRetryTime: 5000,
		initialRetryTime: 100,
		retries: 1,
		factor: 0.2,
		multiplier: 2,
		logLevel: "ERROR" as const
	}
};

export const testConsumerConfig = {
	groupId: "workflow-service-test-group",
	metadataMaxAge: 300000,
	sessionTimeout: 30000,
	rebalanceTimeout: 60000,
	heartbeatInterval: 3000,
	maxBytesPerPartition: 1048576,
	minBytes: 1,
	maxBytes: 10485760,
	maxWaitTimeInMs: 5000,
	retry: {
		maxRetryTime: 5000,
		initialRetryTime: 100,
		retries: 1,
		factor: 0.2,
		multiplier: 2
	},
	allowAutoTopicCreation: false,
	maxInFlightRequests: undefined,
	readUncommitted: false
};

export const testProducerConfig = {
	retry: {
		maxRetryTime: 5000,
		initialRetryTime: 100,
		retries: 1,
		factor: 0.2,
		multiplier: 2
	},
	metadataMaxAge: 300000,
	allowAutoTopicCreation: false,
	idempotent: false,
	maxInFlightRequests: undefined,
	createPartitioner: "LegacyPartitioner" as const
};
