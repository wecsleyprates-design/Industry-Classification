import { type ApiResponse } from "./api";

export type BusinessApplicantConfigResponse =
	ApiResponse<BusinessApplicantConfigResponseData>;

export interface BusinessApplicantConfigResponseData {
	id: number;
	config: BusinessApplicantConfigResponseDataConfig[];
	is_enabled: boolean;
}

export interface BusinessApplicantConfigResponseDataConfig {
	message: string;
	urgency: "low" | "medium" | "high";
	threshold: number;
	allowed_case_status: number[];
}
