import { isObjectWithKeys } from "#utils";
import { WorthInternalOrder } from "../types";

export const isVerdataOrder = (order: unknown): order is WorthInternalOrder => {
	return isObjectWithKeys(
		order,
		"business_id",
		"name",
		"address_line_1",
		// "address_line_2", optional field
		"city",
		"state",
		"zip5"
		// "ein", optional field
		// "phone", optional field
		// "name_dba", optional field
	);
};
