import { consumerConfig, kafkaConfig, producerConfig, envConfig } from "#configs/index";
import { Kafka, Consumer as KafkaConsumer, KafkaJSError, Producer as KafkaProducer, EachMessageHandler } from "kafkajs";
import { ENVIRONMENTS } from "#constants";
import { logger } from "./logger";

// Lazy initialization to avoid issues in tests
let kafkaClient: Kafka | null = null;

const getKafkaClient = (): Kafka => {
	kafkaClient ??= new Kafka(kafkaConfig);
	return kafkaClient;
};

class Consumer {
	private consumer: KafkaConsumer;
	constructor() {
		this.consumer = getKafkaClient().consumer(consumerConfig);
	}
	async init() {
		await this.consumer.connect();
	}
	async run(topics: string[], handler: EachMessageHandler) {
		await this.consumer.subscribe({ topics, fromBeginning: true });
		const partitionsConsumedConcurrently = Number(process.env.KAFKA_PARTITIONS_CONSUMED_CONCURRENTLY) || 3;
		await this.consumer.run({
			autoCommit: true,
			partitionsConsumedConcurrently: partitionsConsumedConcurrently,
			eachMessage: handler
		});
	}

	async commitOffsets(offsets: Array<{ topic: string; partition: number; offset: string }>) {
		await this.consumer.commitOffsets(offsets);
	}
}

class Producer {
	private producer: KafkaProducer;
	constructor() {
		this.producer = getKafkaClient().producer(producerConfig);
	}
	async init() {
		await this.producer.connect();
	}

	/**
	 * Sends messages to Kafka topic
	 * @param {String} topic - The Kafka topic name
	 * @param {Array} messages - Array of message objects with the following properties:
	 *   - key: (string) - Entity identifier for partitioning (e.g., businessId, caseId)
	 *   - value: (object) - Message payload containing 'event' property for routing
	 * @returns {Promise<void>}
	 *
	 * @example
	 * await producer.send({
	 *   topic: 'business.v1',
	 *   messages: [{
	 *     key: 'business-123',  // Entity ID for partitioning
	 *     value: {
	 *       event: 'BUSINESS_INVITED',  // Event type for routing (required)
	 *       case_id: '123',
	 *       business_id: 'business-123'
	 *     }
	 *   }]
	 * });
	 */
	async send({
		topic,
		messages
	}: {
		topic: string;
		messages: Array<{
			key: string;
			value: { event: string; [key: string]: any };
		}>;
	}): Promise<void> {
		const serializedMessages = messages.map(msg => ({
			key: msg.key,
			value: JSON.stringify(msg.value)
		}));

		try {
			await this.producer.send({ topic, messages: serializedMessages });
		} catch (error) {
			if ((error as KafkaJSError).message === "The producer is disconnected") {
				await this.init();
				await this.producer.send({ topic, messages: serializedMessages });
				return;
			}
			throw error;
		}
	}
}

export const consumer = new Consumer();
export const producer = new Producer();

export const confirmKafkaTopicsExist = async (topics: string[]) => {
	const admin = getKafkaClient().admin();

	try {
		await admin.connect();

		const existing = await admin.listTopics();

		const missing = topics.filter(t => !existing.includes(t));

		const isDev = envConfig.ENV === ENVIRONMENTS.DEVELOPMENT;

		if (missing.length > 0) {
			if (isDev) {
				await admin.createTopics({
					topics: missing.map(topic => ({
						topic,
						numPartitions: 1,
						replicationFactor: 1
					})),
					waitForLeaders: true
				});

				missing.forEach(topic => {
					logger.info(`Created Kafka topic: ${topic}`);
				});
			} else {
				throw new Error(`Missing required Kafka topics: ${missing.join(", ")}`);
			}
		} else {
			logger.debug("All required Kafka topics exist");
		}
	} catch (err) {
		logger.error({ error: err }, "confirmKafkaTopicsExist failed");
		throw err;
	} finally {
		await admin.disconnect().catch(err => {
			logger.warn("Kafka admin disconnect failed", err as Error);
		});
	}
};
