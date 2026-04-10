import type { OpenAPIV3 } from "openapi-types";
import { SuccessResponseSchema } from "../schemas";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const SuccessResponse: OpenAPIV3.ResponseObject = {
	description: "Success",
	content: {
		"application/json": {
			schema: SuccessResponseSchema
		}
	}
};
