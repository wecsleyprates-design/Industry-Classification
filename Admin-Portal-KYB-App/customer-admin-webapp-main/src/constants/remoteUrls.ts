export const remoteAppUrls = {
	case: import.meta.env.VITE_CASE_REMOTE_ENTRY_URL,
	dashboard: import.meta.env.VITE_DASHBOARD_REMOTE_ENTRY_URL,
	user: import.meta.env.VITE_USER_REMOTE_ENTRY_URL,
	customer: import.meta.env.VITE_CUSTOMER_REMOTE_ENTRY_URL,
};

export const remoteAppNames = {
	case: "case_app",
	dashboard: "dashboard_app",
	user: "user_app",
	customer: "customer_app",
};

type RemoteApp = {
	key: string;
	envKey: string; // environment variable name for remote entry
};

export const REMOTE_APPS: RemoteApp[] = [
	{ key: "case_app_version", envKey: "VITE_CASE_REMOTE_ENTRY_URL" },
	{ key: "dashboard_app_version", envKey: "VITE_DASHBOARD_REMOTE_ENTRY_URL" },
	{ key: "user_app_version", envKey: "VITE_USER_REMOTE_ENTRY_URL" },
	{ key: "customer_app_version", envKey: "VITE_CUSTOMER_REMOTE_ENTRY_URL" },
];
