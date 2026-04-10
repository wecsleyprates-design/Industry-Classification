import { consumer, confirmKafkaTopicsExist } from "#helpers/kafka";
import { logger } from "#helpers/logger";
import { KAFKA_SUBSCRIBE_TOPICS, KAFKA_PUSH_TOPICS } from "#constants";
import { handler } from "./consumers";

/**
 * Initialize Kafka handler
 * @param connectOnly - If true, only verify connection without consuming messages.
 *                      Used in health check mode to verify Kafka connectivity
 *                      without actually processing any messages.
 */
export const initKafkaHandler = async (connectOnly = false): Promise<void> => {
	try {
		logger.info("Initializing KAFKA Handler...");

		// Verify topics exist (uses admin connection to validate Kafka access)
		const topics = [...new Set([...KAFKA_SUBSCRIBE_TOPICS, ...KAFKA_PUSH_TOPICS])];
		await confirmKafkaTopicsExist(topics);

		// Initialize consumer (connects to brokers, validates credentials)
		await consumer.init();

		if (connectOnly) {
			logger.info("Kafka connection verified (health-check mode - not consuming messages)");
			return;
		}

		// Normal mode: subscribe to topics and start consuming messages
		await consumer.run(KAFKA_SUBSCRIBE_TOPICS, handler);
		logger.info(`✔ KAFKA Handler initialized and listening on topics: ${KAFKA_SUBSCRIBE_TOPICS.join(", ")}`);
	} catch (error) {
		logger.error({ error }, "Failed to initialize KAFKA Handler");
		throw error;
	}
};
