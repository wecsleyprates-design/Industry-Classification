import type { Request } from "express";
import { convertCsvToJson, convertFileToJson } from "#utils/csvToJson";
import { businesses } from "../businesses";
import { BulkCreateBusinessMap } from "../maps/bulkCreateBusinessMap";
import { BulkUpdateBusinessMap } from "../maps/bulkUpdateBusinessMap";
import type { Mapper } from "../mapper";
import { Owners } from "../owners";
import { progressionStages, OWNERSHIP_FIELD_NAMES } from "#constants";
import type { BulkBusinessMapOptions } from "#types/mapper";

export const parseBulkProcessBody = async (req: Request) => {
	const contentType = req.get("content-type") ?? "";
	let { body } = req;
	if (body && contentType.startsWith("text")) {
		body = await convertCsvToJson(body);
	} else if (req.file?.path) {
		// Convert the uploaded file to JSON
		body = await convertFileToJson(req.file.path);
	}
	return body;
};

export const normalizeBulkRows = (body: Array<Record<string, any>>) =>
	body.map(row => {
		const cleanedRow: Record<string, any> = {};
		for (const key in row) {
			if (typeof row[key] === "string" && row[key].trim() !== "") {
				cleanedRow[key] = row[key].trim();
			} else if (typeof row[key] === "number" && !isNaN(row[key])) {
				cleanedRow[key] = row[key];
			} else if (typeof row[key] === "boolean" && [true, false].includes(row[key])) {
				cleanedRow[key] = row[key];
			} else if (typeof row[key] === "object" && Object.keys(row[key] ?? {}).length > 0) {
				cleanedRow[key] = row[key];
			} else if (row[key] === null) {
				cleanedRow[key] = null;
			}
		}
		return cleanedRow;
	});

export const initMapper = (
	input: Map<string, any>, 
	mode: "create" | "update", 
	runId?: string, 
	options?: BulkBusinessMapOptions
): Mapper => {
	if (mode === "create") {
		return new BulkCreateBusinessMap(input, runId, options);
	} else if (mode === "update") {
		return new BulkUpdateBusinessMap(input, runId, options);
	} else {
		throw new Error("invalid mode");
	}
};

// Retrieves a customer's onboarding settings and builds an object containing options to be used when building business maps
export const getBusinessMapOptions = async (customerID: string): Promise<BulkBusinessMapOptions> => {
	let businessMapOptions: BulkBusinessMapOptions = {};
	const progressionConfig = await businesses.getProgressionConfig(customerID);
	const extendedOwnershipSetting = businesses.getFieldFromProgressionConfig(
		progressionConfig,
		progressionStages.OWNERSHIP,
		OWNERSHIP_FIELD_NAMES.EXTENDED_OWNERSHIP
	);

	if (extendedOwnershipSetting?.status) {
		const ownerLimits = await Owners.getExtendedOwnershipLimits(extendedOwnershipSetting.sub_fields);
		businessMapOptions = {
			extendedOwnership: {
				maxTotalOwners: ownerLimits?.maxTotalOwners ?? null,
				maxControlOwners: ownerLimits?.maxControlOwners ?? null,
				maxBeneficialOwners: ownerLimits?.maxBeneficialOwners ?? null
			}
		};
	}

	return businessMapOptions;
}