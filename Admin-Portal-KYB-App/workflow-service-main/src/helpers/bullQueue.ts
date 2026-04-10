import Bull from "bull";
import { createRedisConnection } from "./redis";
import { logger } from "./logger";

const generateQueueOptions = (): Partial<Bull.QueueOptions> => {
	return createRedisConnection({ prefix: "{bull}" }) as Partial<Bull.QueueOptions>;
};

export class BullQueue<T = unknown> {
	public queue: Bull.Queue<T>;
	private isClosed = false;

	constructor(queueName: string, _options?: Partial<Bull.QueueOptions>) {
		this.queue = new Bull(queueName, generateQueueOptions());
		this.queue.on("error", (error: Error) => {
			logger.error("🐂⚠️ Bull queue error", { err: error, queue: queueName, event: "error" });
		});
	}

	async close(): Promise<void> {
		if (!this.isClosed) {
			await this.queue.close();
			this.isClosed = true;
		}
	}

	get isQueueClosed(): boolean {
		return this.isClosed;
	}
}
