import { useEffect, useMemo } from "react";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import type { FieldSource } from "../../../components/fieldSource.types";
import { extractOverride } from "../../../components/fieldSource.utils";
import { useFactOverrideHandler } from "../../../hooks/useFactOverrideHandler";
import { useFieldSaveStatus } from "../../../hooks/useFieldSaveStatus";
import type { ProcessingHistoryFieldKey } from "../schemas/processingHistorySchema";

export type FieldSourceMap = Record<string, FieldSource>;

interface FactValue {
	value: any;
	override?: {
		value: any;
		timestamp?: string;
		userID?: string;
	} | null;
}

export type ProcessingHistoryFactsData = Record<
	string,
	FactValue | string[] | undefined
>;

/**
 * Card data structures expected by read-only cards
 */
interface CardSectionData {
	annual_volume?: number;
	monthly_volume?: number;
	average_ticket_size?: number;
	high_ticket_size?: number;
	desired_limit?: number;
	guest_owner_edits?: string[];
	fieldSources?: FieldSourceMap;
}

interface SeasonalSectionData {
	high_volume_months?: string[];
	explanation_of_high_volume_months?: string;
	guest_owner_edits?: string[];
	fieldSources?: FieldSourceMap;
}

interface PointOfSaleSectionData {
	swiped_cards?: number;
	typed_cards?: number;
	e_commerce?: number;
	mail_telephone?: number;
	guest_owner_edits?: string[];
	fieldSources?: FieldSourceMap;
}

export interface ProcessingHistoryCardData {
	general_data?: CardSectionData;
	seasonal_data?: SeasonalSectionData;
	card_data?: CardSectionData;
	american_express_data?: CardSectionData;
	point_of_sale_data?: PointOfSaleSectionData;
}

/** Mapping of factKey → fieldKey for each section, defined once */
const SECTION_FIELD_MAPPINGS: Record<string, Array<[string, string]>> = {
	general: [
		["general_annual_volume", "annual_volume"],
		["general_monthly_volume", "monthly_volume"],
		["general_average_volume", "average_ticket_size"],
		["general_high_ticket", "high_ticket_size"],
		["general_desired_limit", "desired_limit"],
	],
	seasonal: [
		["seasonal_high_volume_months", "high_volume_months"],
		[
			"seasonal_explanation_of_high_volume_months",
			"explanation_of_high_volume_months",
		],
	],
	card: [
		["card_annual_volume", "annual_volume"],
		["card_monthly_volume", "monthly_volume"],
		["card_average_volume", "average_ticket_size"],
		["card_high_ticket", "high_ticket_size"],
		["card_desired_limit", "desired_limit"],
	],
	amex: [
		["amex_annual_volume", "annual_volume"],
		["amex_monthly_volume", "monthly_volume"],
		["amex_average_volume", "average_ticket_size"],
		["amex_high_ticket", "high_ticket_size"],
		["amex_desired_limit", "desired_limit"],
	],
	pos: [
		["pos_card_swiped", "swiped_cards"],
		["pos_card_typed", "typed_cards"],
		["pos_ecommerce", "e_commerce"],
		["pos_mail_telephone", "mail_telephone"],
	],
};

/**
 * Converts facts-endpoint guest_owner_edits (e.g. "generalData.annualVolume")
 * to a Set of fact keys (e.g. "general_annual_volume").
 */
const GUEST_EDIT_SECTION_PREFIX: Record<string, string> = {
	generalData: "general",
	cardData: "card",
	americanExpressData: "amex",
	seasonalData: "seasonal",
	pointOfSaleData: "pos",
};

export function buildApplicantFactKeySet(
	guestOwnerEdits: string[] | undefined,
): Set<string> {
	const result = new Set<string>();
	if (!guestOwnerEdits) return result;
	for (const edit of guestOwnerEdits) {
		const dotIndex = edit.indexOf(".");
		if (dotIndex === -1) continue;
		const section = edit.slice(0, dotIndex);
		const field = edit.slice(dotIndex + 1);
		const prefix = GUEST_EDIT_SECTION_PREFIX[section];
		if (!prefix) continue;
		const snakeField = field.replace(/([A-Z])/g, "_$1").toLowerCase();
		result.add(`${prefix}_${snakeField}`);
	}
	return result;
}

/**
 * Build values, guest_owner_edits, and fieldSources for a section from its field mappings.
 */
function buildSectionData(
	pairs: Array<[string, string]>,
	factsData: ProcessingHistoryFactsData,
	userNameMap: Map<string, string>,
	applicantFactKeys: Set<string> = new Set(),
): {
	values: Record<string, unknown>;
	guest_owner_edits?: string[];
	fieldSources?: FieldSourceMap;
} {
	const values: Record<string, unknown> = {};
	const edits: string[] = [];
	const sourceEntries: Array<[string, FieldSource]> = [];

	for (const [factKey, fieldKey] of pairs) {
		const fact = factsData[factKey];
		const isFactObject =
			fact && typeof fact === "object" && "value" in fact;

		values[fieldKey] = isFactObject
			? ((fact as FactValue).value ?? undefined)
			: undefined;

		if (isFactObject && (fact as FactValue).override != null) {
			edits.push(fieldKey);
		}

		const override = extractOverride(fact);
		if (override) {
			sourceEntries.push([
				fieldKey,
				{
					type: "internal" as const,
					userName: userNameMap.get(override.userID),
					timestamp: override.timestamp,
				},
			]);
		} else if (applicantFactKeys.has(factKey)) {
			sourceEntries.push([fieldKey, { type: "applicant" as const }]);
		}
	}

	return {
		values,
		guest_owner_edits: edits.length > 0 ? edits : undefined,
		fieldSources:
			sourceEntries.length > 0
				? Object.fromEntries(sourceEntries)
				: undefined,
	};
}

/**
 * Build a flat map from factKey → FieldSource for the editable path,
 * where factKey matches the form field key (e.g. "seasonal_high_volume_months").
 */
export function buildFactFieldSourceMap(
	factsData: ProcessingHistoryFactsData | undefined,
	userNameMap: Map<string, string> = new Map(),
	applicantFactKeys: Set<string> = new Set(),
): FieldSourceMap {
	if (!factsData) return {};

	const result: FieldSourceMap = {};
	for (const pairs of Object.values(SECTION_FIELD_MAPPINGS)) {
		for (const [factKey] of pairs) {
			const override = extractOverride(factsData[factKey]);
			if (override) {
				result[factKey] = {
					type: "internal" as const,
					userName: userNameMap.get(override.userID),
					timestamp: override.timestamp,
				};
			} else if (applicantFactKeys.has(factKey)) {
				result[factKey] = { type: "applicant" as const };
			}
		}
	}
	return result;
}

/**
 * Transform facts data to the format expected by read-only cards.
 * Maps fact names to section-specific data structures.
 */
export function transformFactsToCardData(
	factsData: ProcessingHistoryFactsData | undefined,
	userNameMap: Map<string, string> = new Map(),
	applicantFactKeys: Set<string> = new Set(),
): ProcessingHistoryCardData {
	if (!factsData) {
		return {};
	}

	const section = (key: string): ReturnType<typeof buildSectionData> =>
		buildSectionData(
			SECTION_FIELD_MAPPINGS[key],
			factsData,
			userNameMap,
			applicantFactKeys,
		);

	const general = section("general");
	const seasonal = section("seasonal");
	const card = section("card");
	const amex = section("amex");
	const pos = section("pos");

	return {
		general_data: {
			...general.values,
			guest_owner_edits: general.guest_owner_edits,
			fieldSources: general.fieldSources,
		} as CardSectionData,
		seasonal_data: {
			...seasonal.values,
			guest_owner_edits: seasonal.guest_owner_edits,
			fieldSources: seasonal.fieldSources,
		} as SeasonalSectionData,
		card_data: {
			...card.values,
			guest_owner_edits: card.guest_owner_edits,
			fieldSources: card.fieldSources,
		} as CardSectionData,
		american_express_data: {
			...amex.values,
			guest_owner_edits: amex.guest_owner_edits,
			fieldSources: amex.fieldSources,
		} as CardSectionData,
		point_of_sale_data: {
			...pos.values,
			guest_owner_edits: pos.guest_owner_edits,
			fieldSources: pos.fieldSources,
		} as PointOfSaleSectionData,
	};
}

/**
 * Extract values and override info from facts response
 * Returns form values with overrides applied and the latest override timestamp
 */
export function extractValuesFromFacts(
	factsData: ProcessingHistoryFactsData | undefined,
): {
	values: Record<ProcessingHistoryFieldKey, any>;
	latestOverrideTimestamp: string | null;
} {
	const values: Record<string, any> = {};
	let latestOverrideTimestamp: string | null = null;

	if (!factsData) {
		return {
			values: values as Record<ProcessingHistoryFieldKey, any>,
			latestOverrideTimestamp,
		};
	}

	for (const [factName, factData] of Object.entries(factsData)) {
		// Skip if not a fact object (could be guest_owner_edits array)
		if (
			!factData ||
			typeof factData !== "object" ||
			!("value" in factData)
		) {
			continue;
		}

		values[factName] = factData.value ?? null;

		// Track latest override timestamp
		if (factData.override?.timestamp) {
			if (
				!latestOverrideTimestamp ||
				new Date(factData.override.timestamp) >
					new Date(latestOverrideTimestamp)
			) {
				latestOverrideTimestamp = factData.override.timestamp;
			}
		}
	}

	return {
		values: values as Record<ProcessingHistoryFieldKey, any>,
		latestOverrideTimestamp,
	};
}

interface ProcessingHistoryData {
	processingHistoryData?: any;
	factsData?: ProcessingHistoryFactsData;
}

/**
 * Hook that manages edit state for Processing History Tab.
 */
export function useProcessingHistoryEditState(
	caseId: string,
	businessId: string,
	data: ProcessingHistoryData,
) {
	const { getSaveStatus, setSaveStatus } = useFieldSaveStatus();
	const { setLastAutoSavedAt } = useInlineEditStore(caseId);

	const latestOverrideTimestamp = useMemo(() => {
		// Extract latest override timestamp from facts data (preferred)
		if (data.factsData) {
			const { latestOverrideTimestamp } = extractValuesFromFacts(
				data.factsData,
			);
			return latestOverrideTimestamp;
		}
		return null;
	}, [data.factsData]);

	useEffect(() => {
		if (latestOverrideTimestamp) {
			setLastAutoSavedAt(new Date(latestOverrideTimestamp));
		}
	}, [latestOverrideTimestamp, setLastAutoSavedAt]);

	const handleEditComplete = useFactOverrideHandler(
		caseId,
		businessId,
		setSaveStatus,
	);

	return {
		getSaveStatus,
		handleEditComplete,
		latestOverrideTimestamp,
	};
}
