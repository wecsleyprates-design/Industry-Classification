/**
 * Maps Case Results (onboarding result) row IDs to the integration-service rerun API filters.
 * Used so "Re-verify Data Now" sends fact_names and/or platform_codes that match what is
 * visible in the UI, satisfying the backend requirement of at least one filter.
 *
 * Fact names and platform codes must match integration-service:
 * - fact_names: @see backend integration-service lib/facts/types/FactName.ts and rerun adapters
 * - platform_codes: @see backend INTEGRATION_ID keys (e.g. VERDATA, TRULIOO, PLAID_IDV)
 */

import type { RerunIntegrationsRequestBody } from "@/types/integrations";
import type { OnboardingResultRowId } from "./caseDecisioningResults";

/** Per-row filter: fact_names trigger adapter-based platforms; platform_codes trigger specific integrations (e.g. VERDATA has no factNames). */
const ROW_ID_TO_RERUN_FILTER: Partial<
	Record<
		OnboardingResultRowId,
		{ fact_names?: string[]; platform_codes?: string[] }
	>
> = {
	tin_business_registration: { fact_names: ["tin"] },
	business_address_business_registration: {
		fact_names: ["primary_address", "business_addresses_submitted"],
	},
	business_address_google_profile: {
		fact_names: ["primary_address", "google_place_id"],
	},
	business_name: { fact_names: ["business_name"] },
	website_parked_domain: { fact_names: ["website"] },
	website_status: { fact_names: ["website"] },
	watchlist_hits: {
		fact_names: [
			"business_name",
			"dba",
			"primary_address",
			"addresses",
			"tin",
		],
	},
	idv_verification: { fact_names: ["owners"] },
	google_profile: {
		fact_names: ["business_name", "dba", "primary_address", "addresses"],
	},
	bankruptcies: { platform_codes: ["VERDATA"] },
	judgements: { platform_codes: ["VERDATA"] },
	liens: { platform_codes: ["VERDATA"] },
	complaints: {
		fact_names: [
			"primary_address",
			"google_place_id",
			"review_rating",
			"count_of_complaints_all_time",
		],
	},
	adverse_media: { platform_codes: ["ADVERSE_MEDIA"] },
};

/**
 * Builds the rerun request body from the set of visible/enabled row IDs in the UI.
 * Ensures at least one of fact_names or platform_codes is present so the backend accepts the request.
 * If no visible rows map to any filter, returns a fallback that triggers common case-result integrations.
 */
export function buildRerunBodyFromVisibleRows(
	enabledRowIds:
		| Set<OnboardingResultRowId>
		| ReadonlySet<OnboardingResultRowId>
		| null
		| undefined,
): RerunIntegrationsRequestBody {
	const factNamesSet = new Set<string>();
	const platformCodesSet = new Set<string>();

	if (enabledRowIds && enabledRowIds.size > 0) {
		for (const rowId of enabledRowIds) {
			const filter = ROW_ID_TO_RERUN_FILTER[rowId];
			if (filter?.fact_names)
				filter.fact_names.forEach((f) => factNamesSet.add(f));
			if (filter?.platform_codes)
				filter.platform_codes.forEach((p) => platformCodesSet.add(p));
		}
	}

	const fact_names =
		factNamesSet.size > 0 ? Array.from(factNamesSet) : undefined;
	const platform_codes =
		platformCodesSet.size > 0 ? Array.from(platformCodesSet) : undefined;

	if (fact_names?.length ?? platform_codes?.length) {
		return {
			...(fact_names?.length && { fact_names }),
			...(platform_codes?.length && { platform_codes }),
		};
	}

	// Fallback: at least one filter required by backend. Rerun common case-result sources.
	return {
		fact_names: ["business_name", "primary_address", "website", "tin"],
		platform_codes: ["VERDATA"],
	};
}
