import type { CaseData } from "#core/types";
import { ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW } from "#constants";

const DEFAULT_TIMESTAMPS = {
	created_at: new Date("2023-01-01T00:00:00Z"),
	updated_at: new Date("2023-01-01T00:00:00Z")
} as const;

/**
 * Builds a minimal CaseData object for tests (e.g. mocking caseService.getCaseById).
 * Defaults: custom_workflow decisioning, SUBMITTED status, fixed created_at/updated_at unless overridden.
 */
export function createMockCaseData(overrides: Partial<CaseData> & { id: string; customer_id: string }): CaseData {
	const { id, customer_id, ...rest } = overrides;
	return {
		id,
		customer_id,
		active_decisioning_type: ACTIVE_DECISIONING_TYPE_CUSTOM_WORKFLOW,
		status: "SUBMITTED",
		...DEFAULT_TIMESTAMPS,
		...rest
	};
}
