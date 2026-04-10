import { useFlags } from "launchdarkly-react-client-sdk";
import { useGetNpiDoctors } from "@/services/queries/integration.query";

import FEATURE_FLAGS from "@/constants/FeatureFlags";

interface UseDoctorsDetailsParams {
	businessId: string;
	isNPIEnabled: boolean;
	hasFormattedNpiDetails: boolean;
}

/**
 * Hook that handles doctors list data fetching and display logic.
 * Returns doctors data and computed display flags.
 */
export function useDoctorsDetails({
	businessId,
	isNPIEnabled,
	hasFormattedNpiDetails,
}: UseDoctorsDetailsParams) {
	const flags = useFlags();
	const isDoctorsFeatureEnabled =
		flags[FEATURE_FLAGS.DOS_445_VERDATA_DOCTORS_RESULT];

	const { data: npiDoctorsResponse } = useGetNpiDoctors(
		businessId,
		isDoctorsFeatureEnabled,
	);

	const doctorsList = npiDoctorsResponse?.data ?? [];
	const hasDoctors = doctorsList.length > 0;
	const hasExistingNpi = isNPIEnabled && hasFormattedNpiDetails;

	// Show existing NPI if:
	// 1. Has existing NPI and no doctors list, OR
	// 2. Doctors feature flag is disabled
	const showExistingNpi =
		(hasExistingNpi && !hasDoctors) || !isDoctorsFeatureEnabled;

	// Show doctors result if:
	// 1. Has doctors AND
	// 2. Doctors feature flag is enabled
	const showDoctorsResult = hasDoctors && isDoctorsFeatureEnabled;

	return {
		doctorsList,
		hasDoctors,
		showExistingNpi,
		showDoctorsResult,
		isDoctorsFeatureEnabled,
	};
}
