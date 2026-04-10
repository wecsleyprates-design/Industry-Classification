import { type UUID } from "crypto";
import { type ApiResponse } from "@/types/api";

export type GetOnboardingSetupResponse = ApiResponse<
	GetOnboardingSetupResponseData[]
>;

export interface GetOnboardingSetupResponseData {
	setup_id: number;
	is_enabled: boolean;
	code:
		| "lightning_verification_setup"
		| "modify_pages_fields_setup"
		| "white_label_setup"
		| "onboarding_setup"
		| "equifax_credit_score_setup"
		| "post_submission_editing_setup"
		| "international_business_setup";
	label: string;
}

export interface UpdateOnboardingPayload {
	customerId: string;
	body: UpdateOnboardingRequestBody;
}

export interface UpdateOnboardingRequestBody {
	setups: Setup[];
}

export interface Setup {
	setup_id: number;
	is_enabled: boolean;
}

export interface UpdateCustomerOnboardingStagesPayload {
	customerId: string;
	body: UpdateCustomerOnboardingStagesRequestBody;
}

export interface UpdateCustomerOnboardingStagesRequestBody {
	setupType: "modify_pages_fields_setup" | "lightning_verification_setup";
	stages: CustomerOnboardingStage[];
}

export interface CustomerOnboardingStage {
	stage_id: UUID;
	stage: string;
	is_skippable: boolean;
	is_enabled: boolean;
	config: {
		fields?: ConfigItem[];
		interations?: ConfigItem[];
		additional_settings?: ConfigItem[];
	};
}

export interface ConfigItem {
	name: string;
	status?: string | boolean;
	section_name?: string;
	is_enabled?: boolean;
}

export const STAGES = {
	LOGIN: {
		code: "login",
		label: "Login",
	},
	GET_STARTED: {
		code: "get_started",
		label: "Get Started",
	},
	COMPANY: {
		code: "company",
		label: "Company",
	},
	BANKING: {
		code: "banking",
		label: "Banking",
	},
	OWNERSHIP: {
		code: "ownership",
		label: "Ownership",
	},
	ACCOUNTING: {
		code: "accounting",
		label: "Accounting",
	},
	BUSINESS_TAXES: {
		code: "tax_consent",
		label: "Business Taxes",
	},
	PROCESSING_HISTORY: {
		code: "processing_history",
		label: "Processing History",
	},
	CUSTOM_FIELDS: {
		code: "custom_fields",
		label: "Custom Fields",
	},
	REVIEW: {
		code: "review",
		label: "Review & eSign",
	},
} as const;

// Derive types from STAGES constant
export type StageLabel = (typeof STAGES)[keyof typeof STAGES]["label"];
export type StageCode = (typeof STAGES)[keyof typeof STAGES]["code"];

export type GetCustomerOnboardingStagesResponse = ApiResponse<Stage[]>;

export interface Stage {
	stage_id: UUID;
	stage: StageLabel;
	stage_code: StageCode;
	completion_weightage: number;
	is_enabled: boolean;
	is_skippable: boolean;
	is_orderable: boolean;
	is_removable: boolean;
	allow_back_nav: boolean;
	next_stage: UUID;
	prev_stage: UUID;
	priority_order: number;
	config: {
		fields: StageConfigItem[];
		integrations: StageConfigItem[];
		additional_settings: StageConfigItem[];
	};
	settingsCount?: number;
	modifiedConfig?: DynamicConfig | null | undefined;
}

export type DynamicConfig = Record<string, StageConfigItem[]>;

export interface StageConfigItem {
	name: string;
	status?: string | boolean;
	description?: string;
	status_data_type?: "Boolean" | "Dropdown" | "Toggle" | "Checkbox";
	section_name?: string;
	is_enabled?: boolean;
	sub_fields?: StageConfigSubField[];
}

export interface StageConfigSubField {
	name: string;
	description?: string;
	is_enabled?: boolean;
	status?: string | boolean;
	status_data_type: "Boolean" | "Dropdown" | "Toggle" | "Checkbox";
}

export interface StageName {
	id: UUID;
	stage: string;
	label: string;
	priority_order: number;
	visibility?: string;
}

export type GetAllStagesResponse = ApiResponse<StageName[]>;
