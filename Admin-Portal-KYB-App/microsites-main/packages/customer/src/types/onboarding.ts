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
