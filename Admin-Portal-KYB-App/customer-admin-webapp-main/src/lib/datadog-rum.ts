import { datadogRum } from "@datadog/browser-rum";

import { envConfig } from "@/config/envConfig";

export const datadogRUMInit = () => {
	datadogRum.init({
		applicationId: envConfig.VITE_DATADOG_RUM_APPLICATION_ID ?? "",
		clientToken: envConfig.VITE_DATADOG_RUM_CLIENT_TOKEN ?? "",
		// `site` refers to the Datadog site parameter of your organization
		// see https://docs.datadoghq.com/getting_started/site/
		site: "datadoghq.com",
		service: envConfig.VITE_DATADOG_RUM_SERVICE ?? "",
		env: envConfig.VITE_DATADOG_RUM_ENV ?? "",
		allowedTracingUrls: [
			// matches to backend API endpoints
			(url) => url.startsWith(envConfig.VITE_API_ENDPOINT ?? ""),
		],
		// Specify a version number to identify the deployed version of your application in Datadog
		// version: '1.0.0',
		sessionSampleRate: 100,
		sessionReplaySampleRate: 100,
		trackUserInteractions: true,
		trackResources: true,
		trackLongTasks: true,
		defaultPrivacyLevel: "mask-user-input",
	});
};
