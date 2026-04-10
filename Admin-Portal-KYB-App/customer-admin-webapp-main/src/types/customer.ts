export interface CustomerBrandingSettingRequestBody {
	domain?: string;
	primaryCompanyLogo?: File | null | string;
	buttonColor?: string;
	buttonTextColor?: string;
	onboardingEmailBody?: string;
	onboardingEmailButtonText?: string;
	welcomeBackgroundImage?: File | null | string;
	primaryBackgroundColor?: string;
	progressBarColor?: string;
	termsAndConditions?: string | null;
	privacyPolicyLink?: string | null;
	companySupportEmailAddress?: string;
	companySupportPhoneNumber?: string;
	thankYouMessageTitle?: string;
	thankYouMessageBodyText?: string;
	lightningVerifyEmailButtonText?: string | null;
	lightningVerifyEmailBody?: string | null;
	lightningVerifyEmailSubject?: string | null;
	customURL?: string | null; // ask to remove
}

export interface CustomerUpdateSettingRequestBody {
	customerId: string;
	body: CustomerBrandingSettingRequestBody;
}

export interface UploadCustomerSettingFileRequestBody {
	customerId: string;
	body: {
		file: File;
		type: "primaryCompanyLogo" | "welcomeBackgroundImage";
		domain: string;
	};
}

export interface DeleteCustomerSettingFileRequestBody {
	customerId: string;
	body: {
		file_names: string[];
	};
}

export type FeatureKeyType = "case_management_v2"; // Add more feature keys when new settings are introduced

export interface UpdateCustomerBetaSettingsRequestBody {
	customerId: string;
	body: {
		feature: FeatureKeyType;
		is_enabled?: boolean;
		prompt_seen_status?: boolean;
	};
}

export interface GetCustomerBetaSettingsResponse {
	status: string;
	message: string;
	data: SettingData[];
}

export interface SettingData {
	feature: FeatureKeyType;
	is_enabled: boolean;
	prompt_seen_status: boolean;
}
export interface CoreBeaSettingsResponse {
	status: string;
	message: string;
	data: Datum[];
}

export interface Datum {
	code: string;
	is_enabled: boolean;
}
