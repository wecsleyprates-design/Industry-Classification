import type { OpenAPIV3 } from "openapi-types";
import { SuccessResponse } from "./success-response";
import { BadRequest } from "./bad-request";
import { Unauthorized } from "./unauthorized";
import { Forbidden } from "./forbidden";
import { InternalServerError } from "./internal-server-error";
import { SamlMetadataXmlResponse } from "./saml-metadata";
import { SignInTokenResponse } from "./sign-in-token";

export const responses: OpenAPIV3.ResponsesObject = {
	SuccessResponse,
	BadRequest,
	Unauthorized,
	Forbidden,
	InternalServerError,
	SamlMetadataXmlResponse,
	SignInTokenResponse
};
