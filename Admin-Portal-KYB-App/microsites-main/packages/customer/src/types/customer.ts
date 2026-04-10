export type BackendMode = "PRODUCTION" | "SANDBOX" | "MOCK";
export type BackendStatus = "ACTIVE" | "INACTIVE";

export interface FeaturesSettingsForm {
	settings: Record<string, IntegrationPayloadSetting>;
}

export interface CustomerEntitlementsPayload {
	enabled: boolean;
}
export interface CustomerIntegrationSettingsDataPayload {
	customerID: string;
	settings: CustomerIntegrationSettingsDataPayloadData;
}

export interface IntegrationSetting {
	status: "ACTIVE" | "INACTIVE";
	code: string;
	label: string;
	description: string;
	mode: "SANDBOX" | "PRODUCTION" | "MOCK";
	options: Array<"PRODUCTION" | "SANDBOX" | "MOCK" | "DISABLE">;
}

export interface IntegrationPayloadSetting {
	status: "ACTIVE" | "INACTIVE";
	mode: "SANDBOX" | "PRODUCTION" | "MOCK";
}
export interface CustomerIntegrationSettingsDataPayloadData {
	bjl?: IntegrationPayloadSetting;
	equifax?: IntegrationPayloadSetting;
	gverify?: IntegrationPayloadSetting;
	gauthenticate?: IntegrationPayloadSetting;
	website?: IntegrationPayloadSetting;
	npi?: IntegrationPayloadSetting;
	identity_verification?: IntegrationPayloadSetting;
	adverse_media?: IntegrationPayloadSetting;
	advanced_watchlist?: IntegrationPayloadSetting;
}

export interface CustomerIntegrationSettingResponse {
	status: string;
	message: string;
	data: CustomerIntegrationSettingResponseData;
}

export interface CustomerIntegrationSettingResponseData {
	customer_id: string;
	settings: CustomerIntegrationSettingResponseDataSettings;
}

export interface CustomerIntegrationSettingResponseDataSettings {
	[key: string]: IntegrationSetting | undefined;
	bjl?: IntegrationSetting;
	equifax?: IntegrationSetting;
	gverify?: IntegrationSetting;
	gauthenticate?: IntegrationSetting;
	website?: IntegrationSetting;
	npi?: IntegrationSetting;
	identity_verification?: IntegrationSetting;
	adverse_media?: IntegrationSetting;
	advanced_watchlist?: IntegrationSetting;
}

export interface CustomerData {
	id?: string;
	first_name?: string;
	last_name?: string;
	status?: string;
	created_at?: string | Date;
	customer_details: {
		id: string;
		name?: string;
		customer_type?: "PRODUCTION" | "SANDBOX";
	};
	company_name?: string;
	domain?: string;
	email?: string;
}

export interface CustomersResponse {
	data: {
		records: CustomerData[];
	};
}

export interface EnhancementForm {
	enhancedKYB: boolean;
	enhancedPublicRecords: boolean;
	identityDataPrefill: boolean;
	internationalKYB: boolean;
	isPostSubmissionEditingEnabled: boolean;
	processorOrchestration: boolean;
	riskMonitoring: boolean;
	advancedWatchlist: boolean;
}

export interface getCustomerIntegrationResponseData {
	integration_status_id: string;
	integration_code: string;
	integration_label: string;
	status: string;
}

export interface updateCustomerIntegrationStatusBody {
	customerId: string;
	payload: Array<{
		integrationStatusId: string;
		newStatus: "ENABLED" | "DISABLED";
	}>;
}

export interface getCustomerIntegrationResponse {
	status: string;
	message: string;
	data: getCustomerIntegrationResponseData[];
}

export interface getMonthlyLimitResponse {
	status: string;
	message: string;
	data: getMonthlyLimitResponseData;
}

export interface getMonthlyLimitResponseData {
	id: string;
	customer_id: string;
	onboarding_limit: number;
	current_count: number;
	easyflow_count: number;
	purged_businesses_count: number;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	reset_at: string;
	updated_by: string;
}

export type CustomerStatusVariant =
	| "invited"
	| "active"
	| "invite-expired"
	| "inactive";

export interface CustomerDetailsResponseData {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	mobile: null;
	is_email_verified: boolean;
	is_first_login: boolean;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	is_tc_accepted: boolean;
	tc_accepted_at: null;
	status: string;
	company_details: CompanyDetails;
	subrole: Subrole;
	settings: Settings;
}

export interface CompanyDetails {
	id: string;
	name: string;
	contact_number: null;
	is_active: boolean;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	customer_type: string;
	parent_id: null;
	parent_name: null;
	parent_customer_type: null;
}

export interface Settings {
	onboarding: boolean;
	white_label_onboarding: boolean;
	risk_monitoring: boolean;
	email_notifications: boolean;
}

export interface Subrole {
	id: string;
	code: string;
	label: string;
	role_id: number;
}

export interface UpdateCustomerByIdPayload {
	customerId: string;
	body: { settings: { risk_monitoring: boolean } };
}
