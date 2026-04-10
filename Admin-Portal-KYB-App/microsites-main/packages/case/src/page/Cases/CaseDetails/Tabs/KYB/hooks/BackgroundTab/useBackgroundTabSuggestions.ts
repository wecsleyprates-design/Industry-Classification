import { useMemo } from "react";
import { getCurrencyDisplayValue } from "../../../../utils/fieldFormatters";
import {
	combineAlternatives,
	createSuggestionGroups,
	expandArrayAlternatives,
} from "../../../../utils/suggestionUtils";

interface BackgroundTabData {
	factsBusinessDetails?: any;
	getFactsKybData?: any;
	getFactsFinancialsData?: any;
}

/**
 * Hook that generates all suggestion groups for BackgroundTab fields.
 * Returns a map of fieldKey -> SuggestionGroup[] for easy lookup.
 */
export function useBackgroundTabSuggestions(data: BackgroundTabData) {
	const { factsBusinessDetails, getFactsKybData, getFactsFinancialsData } =
		data;

	// Business name suggestions - combines business_name and names_found
	const businessNameSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				combineAlternatives(
					factsBusinessDetails?.data?.business_name?.alternatives,
					getFactsKybData?.data?.names_found?.alternatives,
				),
				(val: unknown) => (Array.isArray(val) ? val[0] : String(val)),
			),
		[
			factsBusinessDetails?.data?.business_name?.alternatives,
			getFactsKybData?.data?.names_found?.alternatives,
		],
	);

	// Legal name suggestions - combines legal_name and names_found
	const legalNameSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				combineAlternatives(
					getFactsKybData?.data?.legal_name?.alternatives,
					getFactsKybData?.data?.names_found?.alternatives,
				),
				(val: unknown) => (Array.isArray(val) ? val[0] : String(val)),
			),
		[
			getFactsKybData?.data?.legal_name?.alternatives,
			getFactsKybData?.data?.names_found?.alternatives,
		],
	);

	// DBA suggestions - combines dba and dba_found
	// Note: dba_found alternatives may contain arrays of DBA names, so we expand them first
	const dbaSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				expandArrayAlternatives(
					combineAlternatives(
						factsBusinessDetails?.data?.dba?.alternatives,
						getFactsKybData?.data?.dba_found?.alternatives,
					),
				),
				(val: unknown) => String(val),
			),
		[
			factsBusinessDetails?.data?.dba?.alternatives,
			getFactsKybData?.data?.dba_found?.alternatives,
		],
	);

	// Address suggestions - combines addresses and addresses_found
	const addressSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				combineAlternatives(
					getFactsKybData?.data?.addresses?.alternatives,
					getFactsKybData?.data?.addresses_found?.alternatives,
				),
				(val: unknown) => (Array.isArray(val) ? val[0] : String(val)),
			),
		[
			getFactsKybData?.data?.addresses?.alternatives,
			getFactsKybData?.data?.addresses_found?.alternatives,
		],
	);

	// Phone number suggestions - combines business_phone and phone_found
	const phoneNumberSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				combineAlternatives(
					factsBusinessDetails?.data?.business_phone?.alternatives,
					getFactsKybData?.data?.phone_found?.alternatives,
				),
				(val: unknown) => (Array.isArray(val) ? val[0] : String(val)),
			),
		[
			factsBusinessDetails?.data?.business_phone?.alternatives,
			getFactsKybData?.data?.phone_found?.alternatives,
		],
	);

	// Number of employees suggestions
	const numEmployeesSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				factsBusinessDetails?.data?.num_employees?.alternatives,
				(val: unknown) => String(val),
			),
		[factsBusinessDetails?.data?.num_employees?.alternatives],
	);

	// Corporation type suggestions
	const corporationTypeSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				getFactsKybData?.data?.corporation?.alternatives,
			),
		[getFactsKybData?.data?.corporation?.alternatives],
	);

	// Revenue suggestions
	const revenueSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				getFactsFinancialsData?.data?.revenue?.alternatives,
				(val: unknown) => getCurrencyDisplayValue(val as number),
			),
		[getFactsFinancialsData?.data?.revenue?.alternatives],
	);

	// Net income suggestions
	const netIncomeSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				getFactsFinancialsData?.data?.net_income?.alternatives,
				(val: unknown) => getCurrencyDisplayValue(val as number),
			),
		[getFactsFinancialsData?.data?.net_income?.alternatives],
	);

	// Industry suggestions
	const industrySuggestions = useMemo(
		() =>
			createSuggestionGroups(
				factsBusinessDetails?.data?.industry?.alternatives,
				(val: unknown) =>
					(val as { name: string })?.name ?? String(val),
			),
		[factsBusinessDetails?.data?.industry?.alternatives],
	);

	// NAICS code suggestions
	const naicsCodeSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				factsBusinessDetails?.data?.naics_code?.alternatives,
				(val: unknown) => String(val),
			),
		[factsBusinessDetails?.data?.naics_code?.alternatives],
	);

	// MCC code suggestions
	const mccCodeSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				factsBusinessDetails?.data?.mcc_code?.alternatives,
				(val: unknown) => String(val),
			),
		[factsBusinessDetails?.data?.mcc_code?.alternatives],
	);

	// Return as a map for easy lookup
	return useMemo(
		() => ({
			business_name: businessNameSuggestions,
			legal_name: legalNameSuggestions,
			dba: dbaSuggestions,
			primary_address: addressSuggestions,
			mailing_address: addressSuggestions,
			business_phone: phoneNumberSuggestions,
			num_employees: numEmployeesSuggestions,
			corporation: corporationTypeSuggestions,
			revenue: revenueSuggestions,
			net_income: netIncomeSuggestions,
			industry: industrySuggestions,
			naics_code: naicsCodeSuggestions,
			mcc_code: mccCodeSuggestions,
		}),
		[
			businessNameSuggestions,
			legalNameSuggestions,
			dbaSuggestions,
			addressSuggestions,
			phoneNumberSuggestions,
			numEmployeesSuggestions,
			corporationTypeSuggestions,
			revenueSuggestions,
			netIncomeSuggestions,
			industrySuggestions,
			naicsCodeSuggestions,
			mccCodeSuggestions,
		],
	);
}
