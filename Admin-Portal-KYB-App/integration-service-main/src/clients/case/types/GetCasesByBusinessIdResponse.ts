import type { UUID } from "crypto";

export type GetCasesByBusinessIdResponse = {
	id: UUID;
	applicant_id: UUID;
	created_at: string;
	business_name: string;
	status_label: string;
	case_type: number;
	applicant: {
		first_name: string;
		last_name: string;
	};
	status: {
		id: number;
		code: string;
		label: string;
	};
};
