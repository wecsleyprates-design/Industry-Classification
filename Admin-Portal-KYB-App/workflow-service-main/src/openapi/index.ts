import type { OpenAPIV3 } from "openapi-types";
import { securitySchemes } from "./components/security-schemes";
import { responses } from "./components/responses";
import { paths } from "./paths/index";

const openapiBase = (serverUrl: string): OpenAPIV3.Document => ({
	openapi: "3.1.0",
	info: {
		title: "Workflow Service",
		version: "1.0.0",
		description: "API documentation for Workflow Service"
	},
	servers: [
		{
			url: serverUrl,
			description: "Environment-specific server"
		}
	],
	components: {
		securitySchemes,
		responses
	},
	paths,
	security: []
});

export default openapiBase;
