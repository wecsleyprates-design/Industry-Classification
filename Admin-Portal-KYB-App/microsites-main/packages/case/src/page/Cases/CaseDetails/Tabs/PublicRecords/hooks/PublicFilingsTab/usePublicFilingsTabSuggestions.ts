import { useMemo } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { capitalize } from "@/lib/helper";
import { getCurrencyDisplayValue } from "../../../../utils/fieldFormatters";
import { createSuggestionGroups } from "../../../../utils/suggestionUtils";

// Extend dayjs with UTC plugin
dayjs.extend(utc);

interface PublicFilingsTabData {
	bjlData?: any;
}

/**
 * Hook that generates all suggestion groups for PublicFilingsTab fields.
 * Returns a map of fieldKey -> SuggestionGroup[] for easy lookup.
 *
 * Suggestions are generated from the alternatives array in each BJL field.
 */
export function usePublicFilingsTabSuggestions(data: PublicFilingsTabData) {
	const { bjlData } = data;

	// ================================
	// Judgements Suggestions
	// ================================

	// Number of judgements suggestions
	const numJudgementsSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.num_judgements?.alternatives,
				(val: unknown) => String(val),
			),
		[bjlData?.num_judgements?.alternatives],
	);

	// Judgements most recent date suggestions
	const judgementsMostRecentSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.judgements?.alternatives?.map(
					(alt: {
						value: { most_recent?: Date | string };
						source: number;
					}) => ({
						value: alt.value?.most_recent,
						source: alt.source,
					}),
				),
				(val: unknown) =>
					val
						? dayjs.utc(val as Date | string).format("YYYY-MM-DD")
						: "",
			),
		[bjlData?.judgements?.alternatives],
	);

	// Judgements most recent status suggestions
	const judgementsMostRecentStatusSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.judgements?.alternatives?.map(
					(alt: {
						value: { most_recent_status?: string };
						source: number;
					}) => ({
						value: alt.value?.most_recent_status,
						source: alt.source,
					}),
				),
				(val: unknown) => (val ? capitalize(String(val)) : ""),
			),
		[bjlData?.judgements?.alternatives],
	);

	// Judgements most recent amount suggestions
	const judgementsMostRecentAmountSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.judgements?.alternatives?.map(
					(alt: {
						value: { most_recent_amount?: number };
						source: number;
					}) => ({
						value: alt.value?.most_recent_amount,
						source: alt.source,
					}),
				),
				(val: unknown) => getCurrencyDisplayValue(val as number),
			),
		[bjlData?.judgements?.alternatives],
	);

	// Judgements total amount suggestions
	const judgementsTotalAmountSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.judgements?.alternatives?.map(
					(alt: {
						value: { total_judgement_amount?: number };
						source: number;
					}) => ({
						value: alt.value?.total_judgement_amount,
						source: alt.source,
					}),
				),
				(val: unknown) => getCurrencyDisplayValue(val as number),
			),
		[bjlData?.judgements?.alternatives],
	);

	// ================================
	// Liens Suggestions
	// ================================

	// Number of liens suggestions
	const numLiensSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.num_liens?.alternatives,
				(val: unknown) => String(val),
			),
		[bjlData?.num_liens?.alternatives],
	);

	// Liens most recent date suggestions
	const liensMostRecentSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.liens?.alternatives?.map(
					(alt: {
						value: { most_recent?: Date | string };
						source: number;
					}) => ({
						value: alt.value?.most_recent,
						source: alt.source,
					}),
				),
				(val: unknown) =>
					val
						? dayjs.utc(val as Date | string).format("YYYY-MM-DD")
						: "",
			),
		[bjlData?.liens?.alternatives],
	);

	// Liens most recent status suggestions
	const liensMostRecentStatusSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.liens?.alternatives?.map(
					(alt: {
						value: { most_recent_status?: string };
						source: number;
					}) => ({
						value: alt.value?.most_recent_status,
						source: alt.source,
					}),
				),
				(val: unknown) => (val ? capitalize(String(val)) : ""),
			),
		[bjlData?.liens?.alternatives],
	);

	// Liens most recent amount suggestions
	const liensMostRecentAmountSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.liens?.alternatives?.map(
					(alt: {
						value: { most_recent_amount?: number };
						source: number;
					}) => ({
						value: alt.value?.most_recent_amount,
						source: alt.source,
					}),
				),
				(val: unknown) => getCurrencyDisplayValue(val as number),
			),
		[bjlData?.liens?.alternatives],
	);

	// Liens total amount suggestions
	const liensTotalAmountSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.liens?.alternatives?.map(
					(alt: {
						value: { total_open_lien_amount?: number };
						source: number;
					}) => ({
						value: alt.value?.total_open_lien_amount,
						source: alt.source,
					}),
				),
				(val: unknown) => getCurrencyDisplayValue(val as number),
			),
		[bjlData?.liens?.alternatives],
	);

	// ================================
	// Bankruptcies Suggestions
	// ================================

	// Number of bankruptcies suggestions
	const numBankruptciesSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.num_bankruptcies?.alternatives,
				(val: unknown) => String(val),
			),
		[bjlData?.num_bankruptcies?.alternatives],
	);

	// Bankruptcies most recent date suggestions
	const bankruptciesMostRecentSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.bankruptcies?.alternatives?.map(
					(alt: {
						value: { most_recent?: Date | string };
						source: number;
					}) => ({
						value: alt.value?.most_recent,
						source: alt.source,
					}),
				),
				(val: unknown) =>
					val
						? dayjs.utc(val as Date | string).format("YYYY-MM-DD")
						: "",
			),
		[bjlData?.bankruptcies?.alternatives],
	);

	// Bankruptcies most recent status suggestions
	const bankruptciesMostRecentStatusSuggestions = useMemo(
		() =>
			createSuggestionGroups(
				bjlData?.bankruptcies?.alternatives?.map(
					(alt: {
						value: { most_recent_status?: string };
						source: number;
					}) => ({
						value: alt.value?.most_recent_status,
						source: alt.source,
					}),
				),
				(val: unknown) => (val ? capitalize(String(val)) : ""),
			),
		[bjlData?.bankruptcies?.alternatives],
	);

	// Return as a map for easy lookup
	return useMemo(
		() => ({
			// Judgements
			num_judgements: numJudgementsSuggestions,
			judgements_most_recent: judgementsMostRecentSuggestions,
			judgements_most_recent_status:
				judgementsMostRecentStatusSuggestions,
			judgements_most_recent_amount:
				judgementsMostRecentAmountSuggestions,
			judgements_total_amount: judgementsTotalAmountSuggestions,
			// Liens
			num_liens: numLiensSuggestions,
			liens_most_recent: liensMostRecentSuggestions,
			liens_most_recent_status: liensMostRecentStatusSuggestions,
			liens_most_recent_amount: liensMostRecentAmountSuggestions,
			liens_total_amount: liensTotalAmountSuggestions,
			// Bankruptcies
			num_bankruptcies: numBankruptciesSuggestions,
			bankruptcies_most_recent: bankruptciesMostRecentSuggestions,
			bankruptcies_most_recent_status:
				bankruptciesMostRecentStatusSuggestions,
		}),
		[
			numJudgementsSuggestions,
			judgementsMostRecentSuggestions,
			judgementsMostRecentStatusSuggestions,
			judgementsMostRecentAmountSuggestions,
			judgementsTotalAmountSuggestions,
			numLiensSuggestions,
			liensMostRecentSuggestions,
			liensMostRecentStatusSuggestions,
			liensMostRecentAmountSuggestions,
			liensTotalAmountSuggestions,
			numBankruptciesSuggestions,
			bankruptciesMostRecentSuggestions,
			bankruptciesMostRecentStatusSuggestions,
		],
	);
}
