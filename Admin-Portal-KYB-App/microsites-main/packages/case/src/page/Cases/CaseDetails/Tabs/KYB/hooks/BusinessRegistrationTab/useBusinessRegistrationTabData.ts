import { useMemo } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import {
	useGetFactsBusinessDetails,
	useGetFactsKyb,
} from "@/services/queries/integration.query";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import FEATURE_FLAGS from "@/constants/FeatureFlags";

/**
 * Hook that handles all data fetching and extraction for BusinessRegistrationTab.
 * Returns original values, loading states, and derived data.
 */
export function useBusinessRegistrationTabData(
	businessId: string,
	caseData: any,
) {
	const flags = useFlags();
	const isProxyFlag = flags[FEATURE_FLAGS.BEST_65_PROXY_FACT];

	// Data fetching hooks
	const {
		data: getFactsKybData,
		isLoading: isLoadingKyb,
		error: getFactsKybError,
	} = useGetFactsKyb(businessId, isProxyFlag);
	const {
		data: factsBusinessDetails,
		isLoading: isLoadingBusinessDetails,
		error: getFactsBusinessDetailsError,
	} = useGetFactsBusinessDetails(businessId, isProxyFlag);

	// Guest owner edits aggregation
	const guestOwnerEdits = useMemo(
		() => [
			...new Set([
				...(caseData?.data?.guest_owner_edits ?? []),
				...(getFactsKybData?.data?.guest_owner_edits ?? []),
			]),
		],
		[
			caseData?.data?.guest_owner_edits,
			getFactsKybData?.data?.guest_owner_edits,
		],
	);

	// Extract original values
	const originalValues = useMemo(() => {
		const businessName =
			getFactsKybData?.data?.legal_name?.value ?? VALUE_NOT_AVAILABLE;
		const tin = getFactsKybData?.data?.tin?.value ?? VALUE_NOT_AVAILABLE;

		return {
			businessName,
			tin,
		};
	}, [getFactsKybData?.data]);

	// Country code for TIN validation
	const countryCode =
		getFactsKybData?.data.countries?.value?.[0] ?? VALUE_NOT_AVAILABLE;

	return {
		// Raw data sources
		data: {
			getFactsKybData,
			factsBusinessDetails,
		},
		// Loading states
		loadingStates: {
			kyb: isLoadingKyb,
			businessDetails: isLoadingBusinessDetails,
		},
		// Error states
		errors: {
			getFactsKybError,
			getFactsBusinessDetailsError,
		},
		// Original values
		originalValues,
		// Derived data
		derivedData: {
			guestOwnerEdits,
			countryCode,
		},
	};
}
