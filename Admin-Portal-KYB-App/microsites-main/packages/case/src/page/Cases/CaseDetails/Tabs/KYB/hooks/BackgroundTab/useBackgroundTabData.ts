import { useMemo } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import { type CountryCode } from "libphonenumber-js";
import { useIsNPIEnabled } from "@/hooks/useIsNPIEnabled";
import { formatAddress } from "@/lib/utils";
import { useGetBusinessById } from "@/services/queries/businesses.query";
import { useGeocoding } from "@/services/queries/geocoding.query";
import {
	useGetBusinessNpi,
	useGetBusinessVerificationDetails,
	useGetFactsBusinessDetails,
	useGetFactsBusinessFinancials,
	useGetFactsKyb,
} from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { getBooleanDisplayValue } from "../../../../utils/fieldFormatters";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import {
	extractGeocodingDetails,
	getPrimaryBusinessAddress,
	mapToBusinessLocation,
} from "@/helpers/business";

/**
 * Hook that handles all data fetching and extraction for BackgroundTab.
 * Returns original values, loading states, and derived data.
 */
export function useBackgroundTabData(businessId: string, caseData: any) {
	const { customerId } = useAppContextStore();
	const flags = useFlags();
	const isProxyFlag = flags[FEATURE_FLAGS.BEST_65_PROXY_FACT];

	// Data fetching hooks
	const { data: factsBusinessDetails, isLoading: isLoadingBusinessDetails } =
		useGetFactsBusinessDetails(businessId, isProxyFlag);
	const { data: businessApiData, isLoading: isLoadingBusinessApi } =
		useGetBusinessById({
			businessId: businessId ?? "",
			fetchOwnerDetails: true,
		});
	const { data: getFactsKybData, isLoading: isLoadingKyb } = useGetFactsKyb(
		businessId,
		isProxyFlag,
	);
	const { data: getFactsFinancialsData, isLoading: isLoadingFinancials } =
		useGetFactsBusinessFinancials(businessId, isProxyFlag);
	const {
		data: businessVerificationDetails,
		isLoading: isLoadingVerification,
	} = useGetBusinessVerificationDetails(businessId);

	// Address sources for fallback
	const addressSources =
		businessVerificationDetails?.data?.addressSources ?? [];

	// Guest owner edits aggregation
	const guestOwnerEdits = useMemo(
		() => [
			...new Set([
				...(caseData?.data?.guest_owner_edits ?? []),
				...(factsBusinessDetails?.data?.guest_owner_edits ?? []),
				...(businessApiData?.data?.guest_owner_edits ?? []),
				...(getFactsKybData?.data?.guest_owner_edits ?? []),
			]),
		],
		[
			caseData?.data?.guest_owner_edits,
			factsBusinessDetails?.data?.guest_owner_edits,
			businessApiData?.data?.guest_owner_edits,
			getFactsKybData?.data?.guest_owner_edits,
		],
	);

	// Extract original values with all fallbacks preserved
	const originalValues = useMemo(() => {
		const businessName =
			factsBusinessDetails?.data?.business_name?.value ??
			caseData?.data?.business?.name ??
			"";
		const legalName = getFactsKybData?.data?.legal_name?.value ?? "";
		// Display only the first (primary) DBA from the array
		// Other DBAs remain accessible via the facts API for future features
		const dba = Array.isArray(factsBusinessDetails?.data?.dba?.value)
			? (factsBusinessDetails.data.dba.value[0] ?? "")
			: (factsBusinessDetails?.data?.dba?.value ?? "");
		const businessAddress =
			formatAddress(factsBusinessDetails?.data?.primary_address?.value) ??
			getPrimaryBusinessAddress(addressSources) ??
			"";

		// Get mailing address from businessDetails facts
		const mailingAddress =
			formatAddress(
				factsBusinessDetails?.data?.mailing_address?.value?.[0],
			) ?? "";
		const phoneNumber =
			factsBusinessDetails?.data?.business_phone?.value ??
			caseData?.data?.business?.mobile ??
			"";
		const formationDate =
			getFactsKybData?.data?.formation_date?.value ?? "";
		const annualRevenue =
			getFactsFinancialsData?.data?.revenue?.value != null
				? String(getFactsFinancialsData.data.revenue.value)
				: "";
		const netIncome =
			getFactsFinancialsData?.data?.net_income?.value != null
				? String(getFactsFinancialsData.data.net_income.value)
				: "";
		const corporationType = getFactsKybData?.data?.corporation?.value ?? "";
		// Get num_employees - allow null/undefined to be empty, but preserve actual values including 0
		const numEmployeesRaw =
			factsBusinessDetails?.data?.num_employees?.value ??
			businessVerificationDetails?.data?.businessEntityVerification
				?.number_of_employees;
		const numEmployees =
			numEmployeesRaw != null ? String(numEmployeesRaw) : "";
		const minorityOwned = getBooleanDisplayValue(
			getFactsKybData?.data?.minority_owned?.value,
		);
		const womanOwned = getBooleanDisplayValue(
			getFactsKybData?.data?.woman_owned?.value,
		);
		const veteranOwned = getBooleanDisplayValue(
			getFactsKybData?.data?.veteran_owned?.value,
		);
		const industryName =
			factsBusinessDetails?.data?.industry?.value?.name ?? "";
		const naicsCode =
			factsBusinessDetails?.data?.naics_code?.value?.toString() ?? "";
		const mccCode =
			factsBusinessDetails?.data?.mcc_code?.value?.toString() ?? "";
		const businessEmail = getFactsKybData?.data?.email?.value ?? "";
		const npiNumberForForm = getFactsKybData?.data?.npi?.value ?? "";

		return {
			businessName,
			legalName,
			dba,
			businessAddress,
			mailingAddress,
			phoneNumber,
			formationDate,
			annualRevenue,
			netIncome,
			corporationType,
			numEmployees,
			minorityOwned,
			womanOwned,
			veteranOwned,
			industryName,
			naicsCode,
			mccCode,
			businessEmail,
			npiNumber: npiNumberForForm,
		};
	}, [
		factsBusinessDetails?.data,
		getFactsKybData?.data,
		businessApiData?.data,
		getFactsFinancialsData?.data,
		businessVerificationDetails?.data,
		caseData?.data?.business,
		addressSources,
	]);

	// Country code calculation
	const country = getFactsKybData?.data.countries?.value?.[0];
	let countryCode: CountryCode = "US";
	switch (country) {
		case "US":
		case "USA":
			countryCode = "US";
			break;
		case "CA":
		case "CAN":
			countryCode = "CA";
			break;
		case "UK":
			countryCode = "GB";
			break;
	}

	// Geocoding and location
	const { data: geocodingDetails, isInitialLoading: isLoadingAddress } =
		useGeocoding(originalValues.businessAddress);
	const formattedAddress = geocodingDetails
		? extractGeocodingDetails(geocodingDetails)
		: null;
	const location = useMemo(
		() =>
			mapToBusinessLocation(
				formattedAddress,
				originalValues.businessName,
				originalValues.businessAddress,
			),
		[
			formattedAddress,
			originalValues.businessName,
			originalValues.businessAddress,
		],
	);

	// NPI data
	const isNPIEnabled = useIsNPIEnabled(customerId);
	const { data: npiDetails, isLoading: isLoadingNpi } = useGetBusinessNpi(
		isNPIEnabled ? businessId : "",
	);
	const npiNumber = getFactsKybData?.data?.npi?.value ?? undefined;

	return {
		// Raw data sources
		data: {
			factsBusinessDetails,
			businessApiData,
			getFactsKybData,
			getFactsFinancialsData,
			businessVerificationDetails,
			geocodingDetails,
			npiDetails,
		},
		// Loading states
		loadingStates: {
			businessDetails: isLoadingBusinessDetails,
			businessApi: isLoadingBusinessApi,
			kyb: isLoadingKyb,
			financials: isLoadingFinancials,
			verification: isLoadingVerification,
			address: isLoadingAddress,
			npi: isLoadingNpi,
		},
		// Original values
		originalValues,
		// Derived data
		derivedData: {
			guestOwnerEdits,
			formattedAddress,
			location,
			isNPIEnabled,
		},
		// NPI number from KYB facts
		npiNumber,
		// Country code for phone formatting
		countryCode,
		// Phone number for display (combines facts and case data)
		phoneNumber:
			factsBusinessDetails?.data?.business_phone?.value ??
			caseData?.data?.business?.mobile,
	};
}
