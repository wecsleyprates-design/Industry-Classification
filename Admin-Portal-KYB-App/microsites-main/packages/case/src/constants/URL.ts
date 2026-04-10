export const URL = {
	ROOT: "/",
	CASES: "/cases",
	CASES_NEW: "/cases_new",
	CASE_DETAILS: "/cases/:id/:mainTab?/:subTab?",
	CUSTOMER_DETAILS: "/customers/:slug",
	CUSTOMER_APPLICANT_CASE_DETAILS:
		"/customers/:slug/cases/:id/:mainTab?/:subTab?",
	STANDALONE_CASES: "/cases/standalone",
	STANDALONE_CASE_DETAILS: "/cases/standalone/:id/:mainTab?/:subTab?",
	LOGIN: "/",
	AUTH_ERROR: "/autherror",
	BUSINESS_CASES: "/businesses/:slug",
	BUSINESS_APPLICANT_CASE_DETAILS:
		"/businesses/:businessId/cases/:id/:mainTab?/:subTab?",
	SETTINGS_WORKFLOWS: "/settings/workflows",
	NOT_FOUND: "/not-found",
	CUSTOMER_BUSINESS_TABLE: "/customers/:slug/businesses",
	BUSINESS_DETAILS: "/businesses/:id",
};
