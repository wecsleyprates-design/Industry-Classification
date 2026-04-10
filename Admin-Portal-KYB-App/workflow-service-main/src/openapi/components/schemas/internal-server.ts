import type { OpenAPIV3 } from "openapi-types";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const InternalServerErrorSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	properties: {
		message: { type: "string", example: "Internal Server Error" },
		errorCode: { type: "string", example: "ERR_INTERNAL_SERVER" }
	}
};
