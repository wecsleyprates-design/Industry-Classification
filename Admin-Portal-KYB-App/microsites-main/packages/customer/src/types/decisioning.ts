export interface DecisioningConfigurationResponse {
	status: string;
	message: string;
	data: {
		active_decisioning_type: "worth_score" | "custom_workflow";
	};
}

export interface UpdateDecisioningConfigurationPayload {
	customer_id: string;
	decisioning_type: "worth_score" | "custom_workflow";
}
