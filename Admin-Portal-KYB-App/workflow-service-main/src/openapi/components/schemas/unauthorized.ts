import type { OpenAPIV3 } from "openapi-types";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const UnauthorizedResponseSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	properties: {
		message: { type: "string", example: "Unauthorized" },
		errorCode: { type: "string", example: "ERR_UNAUTHORIZED" }
	}
};
