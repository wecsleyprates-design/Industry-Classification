import type { OpenAPIV3 } from "openapi-types";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ErrorResponseSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	properties: {
		message: { type: "string", example: "Error occurred" },
		errorCode: { type: "string", example: "ERR_INTERNAL_SERVER" }
	}
};
