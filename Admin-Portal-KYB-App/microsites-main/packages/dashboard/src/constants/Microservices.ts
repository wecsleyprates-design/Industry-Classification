import { envConfig } from "@/config/envConfig";

const MICROSERVICE = {
	AUTH: envConfig.VITE_SERVICE_AUTH || "/auth/api/v1",
	CASE: envConfig.VITE_SERVICE_CASE || "/case/api/v1",
	INTEGRATION: envConfig.VITE_SERVICE_INTEGRATION || "/integration/api/v1",
	SCORE: envConfig.VITE_SERVICE_SCORE || "/score/api/v1",
	NOTIFICATION: "/notification/api/v1",
	REPORT: envConfig.VITE_SERVICE_REPORT || "/report/api/v1",
};
export default MICROSERVICE;
