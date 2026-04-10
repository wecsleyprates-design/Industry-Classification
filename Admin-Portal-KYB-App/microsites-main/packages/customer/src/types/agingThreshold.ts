export interface CustomerApplicantConfigResponse {
	status: string;
	message: string;
	data: CustomerApplicantConfigResponseData;
}

export interface CustomerApplicantConfigResponseData {
	id: number;
	config: CustomerApplicantConfigResponseDataConfig[];
	is_enabled: boolean;
}

export interface CustomerApplicantConfigResponseDataConfig {
	message: string;
	urgency: "low" | "medium" | "high";
	threshold: number;
	allowed_case_status: number[];
}

export interface ApplicantConfigBody {
	customer_id?: string;
	is_enabled?: boolean;
}

export interface ApplicantDaysConfigBody {
	customer_id?: string;
	payload?: CustomerApplicantConfigResponseDataConfig[];
}

export interface ApplicantDaysConfigPreBody {
	customer_id?: string;
	payload?: {
		low: number;
		medium: number;
		high: number;
	};
}
