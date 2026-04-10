import type { OpenAPIV3 } from "openapi-types";
import { ErrorResponseSchema } from "../schemas";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BadRequest: OpenAPIV3.ResponseObject = {
	description: "Invalid Request",
	content: {
		"application/json": {
			schema: ErrorResponseSchema
		}
	}
};
