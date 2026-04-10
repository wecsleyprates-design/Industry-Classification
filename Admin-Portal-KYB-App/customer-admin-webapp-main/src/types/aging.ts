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
