export interface RiskAlertConfigurationResponse {
	status: string;
	message: string;
	data: {
		customer: Data;
		admin: Data;
	};
}

export interface Data {
	score_config: ScoreConfig;
	equifax_credit_score: EquifaxCreditScore;
	new_lien: New;
	new_judgement: New;
	new_bankruptcy: New;
	worth_score_change: WorthScoreChange;
	risk_alert_statuses: RiskAlertStatuses;
}

export interface RiskAlertStatuses {
	risk_alerts_status: boolean;
	score_risk_tier_transition_status: boolean;
	new_bankruptcy_lien_judgement_status: boolean;
	worth_score_change_status: boolean;
	credit_score_config_status: boolean;
	new_adverse_media: boolean;
}

export interface EquifaxCreditScore {
	MODERATE: Moderate;
}

export interface WorthScoreChange {
	HIGH: {
		measurement_config: {
			threshold: number;
		};
	};
}

export interface Moderate {
	id: string;
	risk_alert_config_id: number;
	measurement_config: PurpleMeasurementConfig;
	risk_level: string;
	customer_id: null;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	measurement_operation: string;
	risk_type_code: string;
	risk_sub_type_code: string;
}

export interface PurpleMeasurementConfig {
	threshold: number;
}

export interface New {
	HIGH: Moderate;
}

export interface ScoreConfig {
	HIGH: High;
	MODERATE: High;
	LOW: High;
}

export interface High {
	id: string;
	risk_alert_config_id: number;
	measurement_config: LOWMeasurementConfig;
	risk_level: string;
	customer_id: null;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	measurement_operation: string;
	risk_type_code: string;
	risk_sub_type_code: string;
}

export interface LOWMeasurementConfig {
	min: number;
	max: number;
}

export interface RiskAlertConfigBody {
	customer_id?: string;
	score_config?: Array<{
		risk_level: "HIGH" | "MODERATE" | "LOW";
		min: number;
		max: number;
	}>;
	credit_score_config?: Array<{
		risk_level: "HIGH" | "MODERATE" | "LOW";
		drop_percentage: number;
	}>;
	worth_score_change_config?: Array<{
		risk_level: "HIGH" | "MODERATE" | "LOW";
		drop_value: number;
	}>;
	risk_alert_statuses?: {
		risk_alerts_status: boolean; // Universal
		score_risk_tier_transition_status: boolean;
		new_bankruptcy_lien_judgement_status: boolean;
		worth_score_change_status: boolean;
		credit_score_config_status: boolean;
		new_adverse_media: boolean;
	};
}

export interface IScoreRangesForm {
	HIGHmin: number;
	HIGHmax: number;
	MODERATEmin: number;
	MODERATEmax: number;
	LOWmin: number;
	LOWmax: number;
	agingThreshold: boolean;
	agingThresholdLOW: number;
	agingThresholdMEDIUM: number;
	agingThresholdHIGH: number;
	creditScoreChange: number;
	worthScoreChange: number;
	scoreRiskTierTransitionStatus: boolean;
	newBankruptcyLienJudgementStatus: boolean;
	worthScoreStatus: boolean;
	creditScoreStatus: boolean;
	riskAlertsStatus: boolean;
	newAdverseMediaStatus: boolean;
}
