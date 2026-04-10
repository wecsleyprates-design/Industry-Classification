import type { UUID } from "crypto";
import type { Business } from "@joinworth/types/dist/types/cases";

export type GetBusinessByIdResponse = {
	data: Business.BusinessRecord & { customer_id: UUID };
};
