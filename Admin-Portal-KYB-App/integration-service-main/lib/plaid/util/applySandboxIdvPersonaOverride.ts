import {
	IdentityVerificationGetResponse,
	IdentityVerificationStatus,
	MatchSummaryCode,
	RiskCheckEmail,
	RiskCheckEmailIsDeliverableStatus,
	RiskLevel
} from "plaid";

// sandbox-only IDV overrides keyed by `given_name|family_name`.
type SandboxIdvPersonaTemplate = {
	nameMatch: MatchSummaryCode;
	emailDeliverable: RiskCheckEmailIsDeliverableStatus;
	identityAbuseScore: number;
	identityAbuseRiskLevel: RiskLevel;
	verificationStatus: IdentityVerificationStatus;
};

const SANDBOX_IDV_PERSONA_BY_FULL_NAME: Record<string, SandboxIdvPersonaTemplate> = {
	"Jeremy|Jamm": {
		nameMatch: MatchSummaryCode.Match,
		emailDeliverable: RiskCheckEmailIsDeliverableStatus.No,
		identityAbuseScore: 95,
		identityAbuseRiskLevel: RiskLevel.High,
		verificationStatus: IdentityVerificationStatus.Failed
	},
	"April|Ludgate": {
		nameMatch: MatchSummaryCode.PartialMatch,
		emailDeliverable: RiskCheckEmailIsDeliverableStatus.Yes,
		identityAbuseScore: 55,
		identityAbuseRiskLevel: RiskLevel.Medium,
		verificationStatus: IdentityVerificationStatus.Success
	},
	"Ron|Swanson": {
		nameMatch: MatchSummaryCode.Match,
		emailDeliverable: RiskCheckEmailIsDeliverableStatus.Yes,
		identityAbuseScore: 15,
		identityAbuseRiskLevel: RiskLevel.Low,
		verificationStatus: IdentityVerificationStatus.Success
	}
};

function applySandboxIdvPersonaFromTemplate(
	result: IdentityVerificationGetResponse,
	template: SandboxIdvPersonaTemplate
): IdentityVerificationGetResponse {
	if (!result.risk_check || !result.kyc_check) {
		return result;
	}

	const {
		nameMatch,
		emailDeliverable,
		identityAbuseScore,
		identityAbuseRiskLevel,
		verificationStatus
	} = template;

	return {
		...result,
		kyc_check: {
			...result.kyc_check,
			name: {
				...result.kyc_check.name,
				summary: nameMatch
			},
			date_of_birth: {
				...result.kyc_check.date_of_birth,
				summary: MatchSummaryCode.Match
			},
			id_number: {
				...result.kyc_check.id_number,
				summary: MatchSummaryCode.Match
			},
			address: {
				...result.kyc_check.address,
				summary: MatchSummaryCode.Match
			},
			phone_number: {
				...result.kyc_check.phone_number,
				summary: MatchSummaryCode.Match
			}
		},
		risk_check: {
			...result.risk_check,
			email: {
				...result.risk_check.email,
				is_deliverable: emailDeliverable
			} as RiskCheckEmail,
			identity_abuse_signals: {
				...result.risk_check.identity_abuse_signals,
				stolen_identity: {
					...result.risk_check.identity_abuse_signals?.stolen_identity,
					score: identityAbuseScore,
					risk_level: identityAbuseRiskLevel
				},
				synthetic_identity: {
					...result.risk_check.identity_abuse_signals?.synthetic_identity,
					score: identityAbuseScore,
					risk_level: identityAbuseRiskLevel
				}
			}
		},
		status: verificationStatus
	};
}

// sandbox-only: replace actual Plaid IDV response with hardcoded values for specific test personas
// we cannot configure actual "leslie knope" style IDV responses in Plaid, so we must perform overrides here
// will only perform overrides for 3 specific first/last name combinations, not for all sandbox customers
export function applySandboxIdvPersonaOverride(
	data: IdentityVerificationGetResponse
): IdentityVerificationGetResponse {
	const given = data.user?.name?.given_name;
	const family = data.user?.name?.family_name;
	if (!given || !family) {
		return data;
	}

	const template = SANDBOX_IDV_PERSONA_BY_FULL_NAME[`${given}|${family}`];
	if (!template) {
		return data;
	}

	return applySandboxIdvPersonaFromTemplate(data, template);
}
