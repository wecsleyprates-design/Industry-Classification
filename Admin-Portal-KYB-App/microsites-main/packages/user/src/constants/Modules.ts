export const MODULES = {
	CASES: "case",
	ARCHIVED: "archived",
	CUSTOMER_USER: "customer_user",
	REPORT: "report",
	SETTINGS: "profile",
	INSIGHTS: "insights",
	BRAND_SETTING: "brand_settings",
	BUSINESS: "businesses",
	CRO: "cro_dashboard",
	ONBOARDING: "onboarding_module",
	WHITE_LABELING: "white_labeling",
	RISK_MONITORING_MODULE: "risk_monitoring_module",
	EMAIL_NOTIFICATIONS: "email_notifications",
	ROLES: "roles",

	// worth admin modules
	CUSTOMER: "customer",
	USER: "user",
	TENANTS: "tenants",
} as const;

export const ACCESS = {
	READ: "read",
	WRITE: "write",
	CREATE: "create",
} as const;

export type CodeModule = (typeof MODULES)[keyof typeof MODULES];
export type AccessType = (typeof ACCESS)[keyof typeof ACCESS];
