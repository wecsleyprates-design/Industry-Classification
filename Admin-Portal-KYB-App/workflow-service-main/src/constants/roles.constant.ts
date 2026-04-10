export enum ROLES {
	ADMIN = "admin",
	CUSTOMER = "customer",
	APPLICANT = "applicant"
}

export enum ROLE_ID {
	ADMIN = 1,
	CUSTOMER = 2,
	APPLICANT = 3
}

export const SUBROLES = {
	OWNER: "owner",
	CRO: "cro",
	RISK_ANALYST: "risk_analyst",
	APPLICANT: "applicant",
	USER: "user"
} as const;
