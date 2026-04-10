import { type RiskAlertConfigurationResponse } from "@/types/riskAlerts";

export const getRiskConfigData = (
	type: "customer" | "admin",
	riskConfigData: RiskAlertConfigurationResponse,
) => ({
	HIGH: {
		min: Number(
			riskConfigData?.data?.[type]?.score_config?.HIGH?.measurement_config
				?.min ??
				riskConfigData?.data?.admin?.score_config?.HIGH?.measurement_config
					?.min ??
				0,
		),
		max: Number(
			riskConfigData?.data?.[type]?.score_config?.HIGH?.measurement_config
				?.max ??
				riskConfigData?.data?.admin?.score_config?.HIGH?.measurement_config
					?.max ??
				0,
		),
	},
	MODERATE: {
		min: Number(
			riskConfigData?.data?.[type]?.score_config?.MODERATE?.measurement_config
				?.min ??
				riskConfigData?.data?.admin?.score_config?.MODERATE?.measurement_config
					?.min ??
				0,
		),
		max: Number(
			riskConfigData?.data?.[type]?.score_config?.MODERATE?.measurement_config
				?.max ??
				riskConfigData?.data?.admin?.score_config?.MODERATE?.measurement_config
					?.max ??
				0,
		),
	},
	LOW: {
		min: Number(
			riskConfigData?.data?.[type]?.score_config?.LOW?.measurement_config
				?.min ??
				riskConfigData?.data?.admin?.score_config?.LOW?.measurement_config
					?.min ??
				0,
		),
		max: Number(
			riskConfigData?.data?.[type]?.score_config?.LOW?.measurement_config
				?.max ??
				riskConfigData?.data?.admin?.score_config?.LOW?.measurement_config
					?.max ??
				0,
		),
	},
	creditScoreChange: Number(
		riskConfigData?.data?.[type]?.equifax_credit_score?.MODERATE
			?.measurement_config?.threshold ?? 0,
	),
	worthScoreChange: Number(
		riskConfigData?.data?.[type]?.worth_score_change?.HIGH?.measurement_config
			?.threshold ?? 0,
	),
	creditScoreStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses
			?.credit_score_config_status,
	worthScoreStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses
			?.worth_score_change_status,
	scoreRiskTierTransitionStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses
			?.score_risk_tier_transition_status,
	newBankruptcyLienJudgementStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses
			?.new_bankruptcy_lien_judgement_status,
	riskAlertsStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses?.risk_alerts_status,

	newAdverseMediaStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses?.new_adverse_media,
});
