import { logger } from "#helpers/logger";
import { EachMessagePayload } from "kafkajs";
import { KAFKA_TOPICS } from "#constants";
import { notificationsEventsHandler } from "./notifications";
import { businessEventsHandler } from "./business";
import { withTimeout, withTimer } from "@joinworth/worth-core-utils";
import { consumerConfig } from "#configs/index";

// Use defaults when config is undefined (e.g. in tests with mocked configs)
const sessionTimeout = consumerConfig?.sessionTimeout ?? 90000;
const heartbeatInterval = consumerConfig?.heartbeatInterval ?? 25000;
const HANDLER_TIMEOUT = sessionTimeout - 10000; // 80s with 90s session
const SLOW_HANDLER_THRESHOLD = sessionTimeout / 2; // 45s
const HEARTBEAT_INTERVAL = Math.min(heartbeatInterval - 500, 10000); // 10s

export const handler = async ({ topic, partition, message, heartbeat }: EachMessagePayload): Promise<void> => {
	const heartbeatIntervalId = setInterval(() => {
		heartbeat().catch((error: Error) => {
			logger.error({ error }, "Error sending heartbeat");
		});
	}, HEARTBEAT_INTERVAL);

	try {
		const payload = JSON.parse(message.value?.toString() ?? "{}");
		const event = payload.event ?? message.key?.toString() ?? "";
		const value = message.value?.toString() ?? "";

		logger.info(`Processing topic ${topic}`);

		if (!value) {
			clearInterval(heartbeatIntervalId);
			logger.warn(`Empty message value for event: ${event}`);
			return;
		}

		const result = (() => {
			switch (topic) {
				case KAFKA_TOPICS.NOTIFICATIONS_V1:
					return notificationsEventsHandler(event, value);
				case KAFKA_TOPICS.BUSINESS_V1:
					return businessEventsHandler(event, value);
				default:
					return null;
			}
		})();

		// Wrap the business logic in a timer and log the results to identify slow handlers
		const timedHandlerPromise = withTimer(Promise.resolve(result))
			.then(({ value: handlerValue, durationMs }) => {
				const logContext = { topic, partition, offset: message.offset, durationMs };
				const logMessage = `Processed topic ${topic} in ${durationMs}ms`;
				if (durationMs > SLOW_HANDLER_THRESHOLD) {
					logger.warn(logMessage, logContext);
				} else {
					logger.debug(logMessage, logContext);
				}
				return handlerValue;
			})
			.catch(err => {
				logger.error({ error: err }, `Error processing topic ${topic}`);
				throw err;
			});

		// Top level timeout guardrail to prevent the consumer from hanging indefinitely
		await withTimeout(timedHandlerPromise, HANDLER_TIMEOUT).finally(() => {
			clearInterval(heartbeatIntervalId);
		});
	} catch (error) {
		logger.error(
			{
				error,
				topic,
				partition,
				offset: message.offset
			},
			"Error processing KAFKA message"
		);
	} finally {
		clearInterval(heartbeatIntervalId);
	}
};
