import { envConfig } from "@/config/envConfig";

interface Microservice {
	AUTH: string;
	AUTH_V2: string;
	CASE: string;
	INTEGRATION: string;
	SCORE: string;
	NOTIFICATION: string;
	REPORT: string;
}

const MICROSERVICE: Microservice = {
	AUTH: envConfig.VITE_SERVICE_AUTH || "/auth/api/v1",
	AUTH_V2: envConfig.VITE_SERVICE_AUTH_V2 || "/auth/api/v2",
	CASE: envConfig.VITE_SERVICE_CASE || "/case/api/v1",
	INTEGRATION: envConfig.VITE_SERVICE_INTEGRATION || "/integration/api/v1",
	SCORE: envConfig.VITE_SERVICE_SCORE || "/score/api/v1",
	NOTIFICATION: envConfig.VITE_SERVICE_NOTIFICATION || "/notification/api/v1",
	REPORT: envConfig.VITE_SERVICE_REPORT || "/report/api/v1",
};

export default MICROSERVICE;
