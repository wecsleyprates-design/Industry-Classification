import { RerunVerdataTaskMetadata } from "../types/RerunVerdataTaskMetadata";
import { isVerdataOrder } from "./isVerdataOrder";

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export const isCompleteVerdataOrder = (metadata: unknown): metadata is Required<RerunVerdataTaskMetadata> => {
	return (
		isVerdataOrder(metadata) &&
		isNonEmptyString(metadata.business_id) &&
		isNonEmptyString(metadata.name) &&
		isNonEmptyString(metadata.address_line_1) &&
		isNonEmptyString(metadata.city) &&
		isNonEmptyString(metadata.state) &&
		isNonEmptyString(metadata.zip5)
	);
};
