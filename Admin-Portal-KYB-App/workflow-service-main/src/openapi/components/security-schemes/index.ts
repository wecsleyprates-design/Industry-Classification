import type { OpenAPIV3 } from "openapi-types";
import { bearerAuth } from "./bearer-token";

export const securitySchemes: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SecuritySchemeObject> = {
	bearerAuth
};
