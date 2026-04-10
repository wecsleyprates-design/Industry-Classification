import type { OpenAPIV3 } from "openapi-types";
import { UnauthorizedResponseSchema } from "../schemas";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Unauthorized: OpenAPIV3.ResponseObject = {
	description: "Unauthorized",
	content: {
		"application/json": {
			schema: UnauthorizedResponseSchema
		}
	}
};
