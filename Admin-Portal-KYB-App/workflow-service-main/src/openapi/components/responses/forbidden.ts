import type { OpenAPIV3 } from "openapi-types";
import { ForbiddenResponseSchema } from "../schemas";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Forbidden: OpenAPIV3.ResponseObject = {
	description: "Forbidden",
	content: {
		"application/json": {
			schema: ForbiddenResponseSchema
		}
	}
};
