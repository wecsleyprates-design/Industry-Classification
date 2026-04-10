/**
 * Subrole constants matching backend workflow-service
 * Used for workflow permissions checking in customer microsite
 */
export const SUBROLES = {
	OWNER: "owner",
	CRO: "cro",
	RISK_ANALYST: "risk_analyst",
	APPLICANT: "applicant",
	USER: "user",
} as const;

/**
 * Type for subrole codes - exported for potential future use in type definitions
 */
export type Subrole = (typeof SUBROLES)[keyof typeof SUBROLES];
