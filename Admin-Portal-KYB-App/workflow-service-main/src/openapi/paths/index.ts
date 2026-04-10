import workflowsOpenAPI from "#workflows/openapi";
import { auditOpenAPI } from "#api/v1/modules/audit";
import attributesOpenAPI from "#api/v1/modules/attributes/openapi";
import { sharedOpenAPI } from "#api/v1/modules/shared";

export const paths = {
	...workflowsOpenAPI,
	...auditOpenAPI,
	...attributesOpenAPI,
	...sharedOpenAPI
};
