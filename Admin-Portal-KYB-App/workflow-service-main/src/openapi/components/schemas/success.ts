import type { OpenAPIV3 } from "openapi-types";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const SuccessResponseSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	properties: {
		message: { type: "string", example: "Success" },
		status: { type: "string", enum: ["success", "failure"], example: "success" }
	}
};
