import type { OpenAPIV3 } from "openapi-types";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ForbiddenResponseSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	properties: {
		message: { type: "string", example: "Forbidden" },
		errorCode: { type: "string", example: "ERR_FORBIDDEN" }
	}
};
