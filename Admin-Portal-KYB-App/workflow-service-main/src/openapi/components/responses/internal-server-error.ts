import type { OpenAPIV3 } from "openapi-types";
import { InternalServerErrorSchema } from "../schemas";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const InternalServerError: OpenAPIV3.ResponseObject = {
	description: "Internal Server Error",
	content: {
		"application/json": {
			schema: InternalServerErrorSchema
		}
	}
};
