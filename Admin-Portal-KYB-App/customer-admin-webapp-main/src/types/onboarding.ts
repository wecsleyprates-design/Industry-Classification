import { type UUID } from "crypto";

export interface GetOnboardingSetupResponse {
	status: string;
	message: string;
	data: GetOnboardingSetupResponseData[];
}

export interface GetOnboardingSetupResponseData {
	setup_id: number;
	is_enabled: boolean;
	code:
		| "lightning_verification_setup"
		| "modify_pages_fields_setup"
		| "white_label_setup"
		| "onboarding_setup"
		| "equifax_credit_score_setup"
		| "post_submission_editing_setup";
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

export interface GetCustomerOnboardingStagesResponse {
	status: string;
	message: string;
	data: Stage[];
}

export interface Stage {
	stage_id: UUID;
	stage: string;
	stage_code: string;
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

export interface GetAllStagesResponse {
	status: string;
	message: string;
	data: StageName[];
}

export interface GetCustomerCountriesResponse {
	status: string;
	message: string;
	data: CustomerCountry[];
}

export interface CustomerCountry {
	jurisdiction_code: string;
	jurisdiction_name?: string;
	is_selected?: boolean;
	is_enabled?: boolean;
}
