import React, { useMemo } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import { useGetCaseDetails } from "@/hooks";
import { capitalize } from "@/lib/helper";
import { useGetFactsKyb } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import {
	WatchlistHitCard,
	WatchlistHitLoadingCard,
	WatchlistHitNullState,
	WatchlistsScannedCard,
} from "./components";
import {
	getKybMiddeskNamesSubmitted,
	getKybMiddeskPeopleNames,
	groupWatchlistHitsByEntityName,
	mapWatchlistValueMetadatumToWatchlistHitItemProps,
} from "./util";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import FEATURE_FLAGS from "@/constants/FeatureFlags";
export interface WatchlistsTabProps {
	caseId: string;
}

export const WatchlistsTab: React.FC<WatchlistsTabProps> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;
	const flags = useFlags();
	const isProxyFlag = flags[FEATURE_FLAGS.BEST_65_PROXY_FACT];
	const { data: getFactsKybData, isLoading: getKybFactsLoading } =
		useGetFactsKyb(businessId, isProxyFlag);

	// NOTE: The backend now consolidates all watchlist hits (business + person)
	// into watchlist.value.metadata via trulioo_advanced_watchlist_results.
	// No separate endpoint is needed for individual person watchlist data.

	const groupedWatchlistHits = useMemo(() => {
		const kybData = getFactsKybData?.data;
		const businessNames = getKybMiddeskNamesSubmitted(
			kybData?.names_submitted,
		);
		const peopleNames = getKybMiddeskPeopleNames(kybData?.people);

		// When names_submitted has no data (e.g. Trulioo-only countries like PR/AU/NZ),
		// fall back to the business name from the case to ensure the entity card renders.
		const effectiveBusinessNames =
			businessNames.length > 0
				? businessNames
				: caseData?.data?.business?.name
					? [{ name: caseData.data.business.name }]
					: [];

		// watchlist.value.metadata now contains ALL hits (business + person consolidated)
		const allHits = kybData?.watchlist?.value?.metadata ?? [];

		// Group all hits by entity_name, pre-populating with scanned entities
		return groupWatchlistHitsByEntityName(
			allHits,
			effectiveBusinessNames,
			peopleNames,
		);
	}, [getFactsKybData?.data, caseData?.data?.business?.name]);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				{getKybFactsLoading ? (
					<WatchlistHitLoadingCard />
				) : (
					<>
						{/* Render all watchlist hits grouped by entity */}
						{Object.keys(groupedWatchlistHits).length > 0 &&
							Object.entries(groupedWatchlistHits).map(
								([entityName, hits]) => (
									<WatchlistHitCard
										key={`watchlist-hit-card-entity-${entityName}`}
										entity={capitalize(entityName)}
										hits={hits.map(
											mapWatchlistValueMetadatumToWatchlistHitItemProps,
										)}
									/>
								),
							)}

						{/* Show null state when no entities found */}
						{Object.keys(groupedWatchlistHits).length === 0 && (
							<WatchlistHitNullState
								businessName={
									caseData?.data?.business.name ??
									VALUE_NOT_AVAILABLE
								}
							/>
						)}
					</>
				)}
			</div>

			<div className="col-span-1 lg:col-span-5">
				<WatchlistsScannedCard />
			</div>
		</div>
	);
};
