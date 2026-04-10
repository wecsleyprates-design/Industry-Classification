import { stringify } from "csv-stringify/sync";
import { logger } from "#helpers/logger";

export interface CsvOptions {
	headers?: boolean;
	delimiter?: string;
}

export function convertToCSV(data: unknown[], options: CsvOptions = {}): string {
	try {
		if (!Array.isArray(data) || data.length === 0) {
			logger.debug("Empty data array provided, returning empty CSV");
			return "";
		}

		const csvOptions: CsvOptions = {
			headers: options.headers ?? true,
			delimiter: options.delimiter ?? ","
		};

		const csv = stringify(data as Array<Record<string, unknown>>, {
			header: csvOptions.headers,
			delimiter: csvOptions.delimiter
		});

		const BOM = "\uFEFF";
		const csvWithBOM = BOM + csv;

		logger.debug(`Converted ${data.length} records to CSV`);
		return csvWithBOM;
	} catch (error) {
		logger.error({ error }, "Error converting data to CSV");
		throw new Error("Failed to convert data to CSV format");
	}
}
