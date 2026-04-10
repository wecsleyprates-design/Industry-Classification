import { envConfig } from "#configs";
import { logger } from "#helpers/logger";
import { BulkImportFileHandler } from "./bulkImportFileHandler";
import { normalizeS3EventFileKey } from "./s3EventKey";
import type { FileUploadEvent } from "./types";

export * from "./bulkImportFileHandler";
export * from "./fileHandler";
export * from "./s3EventKey";
export * from "./types";

/* Route to the right implementation by bucket */
export const processEventByBucket = async (event: FileUploadEvent) => {
	const normalizedEvent: FileUploadEvent = {
		...event,
		fileKey: normalizeS3EventFileKey(event.fileKey)
	};
	const { bucketName } = normalizedEvent;
	const { AWS_CUSTOMER_UPLOAD_BUCKET } = envConfig;
	logger.info("Processing event by bucket: " + bucketName + " | " + AWS_CUSTOMER_UPLOAD_BUCKET);
	if (bucketName === AWS_CUSTOMER_UPLOAD_BUCKET) {
		await BulkImportFileHandler.processEvent(normalizedEvent);
	}
};
