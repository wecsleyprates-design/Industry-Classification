import { useMemo } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useFlags } from "launchdarkly-react-client-sdk";
import { capitalize } from "@/lib/helper";
import {
	useGetBusinessPublicRecords,
	useGetFactsBusinessBJL,
} from "@/services/queries/integration.query";

import FEATURE_FLAGS from "@/constants/FeatureFlags";

// Extend dayjs with UTC plugin
dayjs.extend(utc);

/**
 * Hook that handles all data fetching and extraction for PublicFilingsTab.
 * Returns original values for editable fields, loading states, and raw data.
 */
export function usePublicFilingsTabData(businessId: string, caseId: string) {
	const flags = useFlags();
	const isProxyFlag = flags[FEATURE_FLAGS.BEST_65_PROXY_FACT];

	// Fetch BJL data (judgements, liens, bankruptcies)
	const { data: getFactsBusinessBJLData, isLoading: isLoadingBJL } =
		useGetFactsBusinessBJL(businessId, isProxyFlag);

	// Fetch complaint data
	const { data: publicRecordsData, isLoading: isLoadingComplaints } =
		useGetBusinessPublicRecords({ businessId, caseId });

	const bjlData = getFactsBusinessBJLData?.data;
	const complaintStats =
		publicRecordsData?.data?.public_records?.complaint_statistics;

	// Extract original values from BJL data
	const originalValues = useMemo(() => {
		// Helper function to format date for form (YYYY-MM-DD format for date input)
		const formatDateForForm = (
			dateValue: Date | string | null | undefined,
		): string => {
			if (!dateValue) return "";
			return dayjs.utc(dateValue).format("YYYY-MM-DD");
		};

		// Helper to format currency amounts (convert to string without currency symbol for editing)
		const formatAmountForForm = (
			amount: number | null | undefined,
		): string => {
			if (amount === null || amount === undefined) return "";
			return String(amount);
		};

		// Helper to format status (capitalize first letter)
		const formatStatus = (status: string | null | undefined): string => {
			if (!status) return "";
			return capitalize(status);
		};

		return {
			// Judgements
			numJudgements:
				bjlData?.num_judgements?.value != null
					? String(bjlData.num_judgements.value)
					: "",
			judgementsMostRecent: formatDateForForm(
				bjlData?.judgements?.value?.most_recent,
			),
			judgementsMostRecentStatus: formatStatus(
				bjlData?.judgements?.value?.most_recent_status,
			),
			judgementsMostRecentAmount: formatAmountForForm(
				bjlData?.judgements?.value?.most_recent_amount,
			),
			judgementsTotalAmount: formatAmountForForm(
				bjlData?.judgements?.value?.total_judgement_amount,
			),

			// Liens
			numLiens:
				bjlData?.num_liens?.value != null
					? String(bjlData.num_liens.value)
					: "",
			liensMostRecent: formatDateForForm(
				bjlData?.liens?.value?.most_recent,
			),
			liensMostRecentStatus: formatStatus(
				bjlData?.liens?.value?.most_recent_status,
			),
			liensMostRecentAmount: formatAmountForForm(
				bjlData?.liens?.value?.most_recent_amount,
			),
			liensTotalAmount: formatAmountForForm(
				bjlData?.liens?.value?.total_open_lien_amount,
			),

			// Bankruptcies
			numBankruptcies:
				bjlData?.num_bankruptcies?.value != null
					? String(bjlData.num_bankruptcies.value)
					: "",
			bankruptciesMostRecent: formatDateForForm(
				bjlData?.bankruptcies?.value?.most_recent,
			),
			bankruptciesMostRecentStatus: formatStatus(
				bjlData?.bankruptcies?.value?.most_recent_status,
			),
		};
	}, [bjlData]);

	return {
		// Raw data sources
		data: {
			bjlData,
			complaintStats,
			publicRecordsData,
		},
		// Loading states
		loadingStates: {
			bjl: isLoadingBJL,
			complaints: isLoadingComplaints,
		},
		// Original values for form fields
		originalValues,
	};
}
