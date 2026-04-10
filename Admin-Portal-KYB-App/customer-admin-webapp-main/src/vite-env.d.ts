/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly DEV?: boolean;
	readonly MODE: string;
	readonly PROD: boolean;
	readonly SSR: boolean;
	readonly VITE_API_ENDPOINT?: string;
	readonly VITE_CASE_REMOTE_ENTRY_URL?: string;
	readonly VITE_CUSTOMER_REMOTE_ENTRY_URL?: string;
	readonly VITE_DASHBOARD_REMOTE_ENTRY_URL?: string;
	readonly VITE_DATADOG_RUM_APPLICATION_ID?: string;
	readonly VITE_DATADOG_RUM_CLIENT_TOKEN?: string;
	readonly VITE_DATADOG_RUM_ENV?: string;
	readonly VITE_DATADOG_RUM_SERVICE?: string;
	readonly VITE_DECRYPTION_PUBLIC_KEY?: string;
	readonly VITE_ELECTRONIC_CONSENT?: string;
	readonly VITE_GOOGLE_MAPS_API_KEY?: string;
	readonly VITE_LD_CLIENT_KEY?: string;
	readonly VITE_NODE_ENV?: string;
	readonly VITE_PORT?: string;
	readonly VITE_REMOTE_DASHBOARD?: string;
	readonly VITE_SERVICE_AUTH?: string;
	readonly VITE_SERVICE_AUTH_V2?: string;
	readonly VITE_SERVICE_CASE?: string;
	readonly VITE_SERVICE_INTEGRATION?: string;
	readonly VITE_SERVICE_NOTIFICATION?: string;
	readonly VITE_SERVICE_REPORT?: string;
	readonly VITE_SERVICE_SCORE?: string;
	readonly VITE_USER_REMOTE_ENTRY_URL?: string;
	readonly VITE_USERPILOT_APP_TOKEN?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
