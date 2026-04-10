import { useMemo } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import {
	useGetBusinessWebsite,
	useGetFactsBusinessDetails,
} from "@/services/queries/integration.query";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { formatUrl } from "@/helpers";

/**
 * Hook that handles all data fetching and extraction for WebsiteTab.
 * Returns original values, loading states, and derived data.
 */
export function useWebsiteTabData(businessId: string, caseData: any) {
	const flags = useFlags();
	const isProxyFlag = flags[FEATURE_FLAGS.BEST_65_PROXY_FACT];

	// Data fetching hooks
	const {
		data: factsBusinessDetails,
		isLoading: isLoadingFactsBusinessDetails,
	} = useGetFactsBusinessDetails(businessId, isProxyFlag);
	const { data: businessWebsiteData, isLoading: isLoadingBusinessWebsite } =
		useGetBusinessWebsite({ businessId });

	// Guest owner edits aggregation
	const guestOwnerEdits = useMemo(
		() => [
			...new Set([
				...(caseData?.data?.guest_owner_edits ?? []),
				...(factsBusinessDetails?.data?.guest_owner_edits ?? []),
			]),
		],
		[
			caseData?.data?.guest_owner_edits,
			factsBusinessDetails?.data?.guest_owner_edits,
		],
	);

	// Extract original values
	const originalValues = useMemo(() => {
		const website = formatUrl(
			businessWebsiteData?.data?.url ??
				factsBusinessDetails?.data?.website?.value,
		);

		return {
			website: website || "",
		};
	}, [
		businessWebsiteData?.data?.url,
		factsBusinessDetails?.data?.website?.value,
	]);

	// Loading states
	const loadingStates = useMemo(
		() => ({
			websiteDetails:
				isLoadingFactsBusinessDetails || isLoadingBusinessWebsite,
		}),
		[isLoadingFactsBusinessDetails, isLoadingBusinessWebsite],
	);

	return {
		data: {
			factsBusinessDetails,
			businessWebsiteData,
		},
		loadingStates,
		originalValues,
		guestOwnerEdits,
	};
}
