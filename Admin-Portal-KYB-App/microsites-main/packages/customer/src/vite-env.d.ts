/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_ENDPOINT: string;
	readonly VITE_GOOGLE_MAPS_API_KEY: string;
	readonly VITE_USERPILOT_APP_TOKEN: string;
	readonly VITE_DATADOG_RUM_APPLICATION_ID: string;
	readonly VITE_DATADOG_RUM_CLIENT_TOKEN: string;
	readonly VITE_NODE_ENV: string;
	readonly VITE_DATADOG_RUM_SERVICE: string;
	readonly VITE_DATADOG_RUM_ENV: string;
	readonly VITE_S3_BUCKET_FOR_TESTING_VERIFICATION_UPLOADS: string;
	readonly VITE_LD_CLIENT_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
