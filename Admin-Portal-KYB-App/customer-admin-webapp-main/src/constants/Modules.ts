import { type TAccessType, type TCodeModule } from "@/types/common";

export const MODULES = {
	CASES: "case" as TCodeModule,
	ARCHIVED: "archived" as TCodeModule,
	CUSTOMER_USER: "customer_user" as TCodeModule,
	REPORT: "report" as TCodeModule,
	SETTINGS: "profile" as TCodeModule,
	INSIGHTS: "insights" as TCodeModule,
	BRAND_SETTING: "brand_settings" as TCodeModule,
	BUSINESS: "businesses" as TCodeModule,
	CRO: "cro_dashboard" as TCodeModule,
	ONBOARDING: "onboarding_module" as TCodeModule,
	WHITE_LABELING: "white_labeling" as TCodeModule,
	RISK_MONITORING_MODULE: "risk_monitoring_module" as TCodeModule,
	EMAIL_NOTIFICATIONS: "email_notifications" as TCodeModule,
	ROLES: "roles" as TCodeModule,
};

export const ACCESS = {
	READ: "read" as TAccessType,
	WRITE: "write" as TAccessType,
	CREATE: "create" as TAccessType,
};
