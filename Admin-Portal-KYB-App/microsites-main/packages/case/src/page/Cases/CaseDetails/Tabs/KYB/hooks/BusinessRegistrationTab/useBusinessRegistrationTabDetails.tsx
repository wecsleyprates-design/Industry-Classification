import React, { type ReactNode, useMemo } from "react";
import { capitalizeStringArray } from "@/lib/helper";
import { getTaxIdLabel, isUSCountry } from "@/lib/taxIdLabels";
import { formatSourceDate } from "@/lib/utils/formatSourceDate";
import { type KYBSosFilingValue } from "@/types/integrations";
import type { FieldSource } from "../../../../components/fieldSource.types";
import {
	extractOverride,
	resolveFieldSource,
} from "../../../../components/fieldSource.utils";
import { CorporateOfficers } from "../../components/BusinessRegistrationTab/CorporateOfficers";
import { EntityJurisdictionCell } from "../../components/BusinessRegistrationTab/EntityJurisdictionCell";

import { VALUE_NOT_AVAILABLE } from "@/constants";

const ENTITY_JURISDICTION_TYPE_TOOLTIP = (
	<>
		• <strong>Domestic</strong> – This business was originally formed in
		this state.{"\n"}• <strong>Foreign</strong> – This business was formed
		in another state and is registered to operate in this state.
	</>
);

export type TaxDetail = {
	label: string;
	value: ReactNode;
	fieldSource?: FieldSource;
};

export type EnhancedSOSFilingDetail = {
	sosFiling: KYBSosFilingValue | undefined;
	rows: Array<{
		label: string;
		value: ReactNode;
		labelTooltip?: ReactNode;
	}>;
};

export type ShareholderDocument = {
	id: string;
	url: string;
	fileName: string;
};

interface UseBusinessRegistrationTabDetailsParams {
	getFactsKybData: any;
	countryCode: string;
	guestOwnerEdits: string[];
	/** True while case integrations are running / re-run in flight (hide SOS block). */
	shouldHideSosForIntegration: boolean;
	hasDirtyBusinessRegistrationFields: boolean;
	userNameMap?: Map<string, string>;
}

/**
 * Hook that generates tax details and enhanced SOS filings details
 * for the Business Registration tab.
 */
export function useBusinessRegistrationTabDetails({
	getFactsKybData,
	countryCode,
	guestOwnerEdits,
	shouldHideSosForIntegration,
	hasDirtyBusinessRegistrationFields,
	userNameMap = new Map(),
}: UseBusinessRegistrationTabDetailsParams): {
	taxDetails: TaxDetail[];
	enhancedSosFilingsDetails: EnhancedSOSFilingDetail[];
	shareholderDocument: ShareholderDocument | null;
} {
	const taxDetails = useMemo<TaxDetail[]>(() => {
		return [
			{
				label: "Business Name",
				value:
					getFactsKybData?.data?.legal_name?.value ??
					VALUE_NOT_AVAILABLE,
				fieldSource: resolveFieldSource(
					guestOwnerEdits.includes("name"),
					extractOverride(getFactsKybData?.data?.legal_name),
					userNameMap,
				),
			},
			{
				label: getTaxIdLabel(countryCode, "long"),
				value: getFactsKybData?.data?.tin?.value ?? VALUE_NOT_AVAILABLE,
				fieldSource: resolveFieldSource(
					guestOwnerEdits.includes("tin"),
					extractOverride(getFactsKybData?.data?.tin),
					userNameMap,
				),
			},
		];
	}, [getFactsKybData, countryCode, guestOwnerEdits, userNameMap]);

	const shareholderDocument = useMemo<ShareholderDocument | null>(() => {
		if (!getFactsKybData?.data?.shareholder_document?.value) {
			return null;
		}
		return {
			id: getFactsKybData.data.shareholder_document.value.id,
			url: getFactsKybData.data.shareholder_document.value.url,
			fileName: getFactsKybData.data.shareholder_document.value.file_name,
		};
	}, [getFactsKybData]);

	const enhancedSosFilingsDetails = useMemo<EnhancedSOSFilingDetail[]>(() => {
		if (shouldHideSosForIntegration) {
			return [];
		}

		const sosFilings = getFactsKybData?.data?.sos_filings?.value ?? [];
		const usBusiness = isUSCountry(countryCode);

		// If business registration fields are dirty (being edited), show SOS fields as blank
		if (hasDirtyBusinessRegistrationFields) {
			// If there are existing SOS filings, preserve the structure but show blank values
			if (sosFilings.length > 0) {
				return sosFilings.map((sosFiling: KYBSosFilingValue) => {
					const rows = [
						{
							label: "Filing Status",
							value: VALUE_NOT_AVAILABLE,
						},
						...(usBusiness
							? [
									{
										label: "Entity Jurisdiction Type",
										value: React.createElement(
											EntityJurisdictionCell,
											{ foreignDomestic: undefined },
										),
										labelTooltip:
											ENTITY_JURISDICTION_TYPE_TOOLTIP,
									},
									{
										label: "State",
										value: VALUE_NOT_AVAILABLE,
									},
								]
							: []),
						{
							label: "Registration Date",
							value: VALUE_NOT_AVAILABLE,
						},
						{
							label: "Entity Type",
							value: VALUE_NOT_AVAILABLE,
						},
						{
							label: "Corporate Officers",
							value: React.createElement(CorporateOfficers, {
								people: undefined,
							}),
						},
						{
							label: "Legal Entity Name",
							value: VALUE_NOT_AVAILABLE,
						},
					];
					return {
						sosFiling: undefined,
						rows,
					};
				});
			}
			// If no existing SOS filings, return a single entry with blank values
			return [
				{
					sosFiling: undefined,
					rows: [
						{
							label: "Filing Status",
							value: VALUE_NOT_AVAILABLE,
						},
						...(usBusiness
							? [
									{
										label: "Entity Jurisdiction Type",
										value: React.createElement(
											EntityJurisdictionCell,
											{ foreignDomestic: undefined },
										),
										labelTooltip:
											ENTITY_JURISDICTION_TYPE_TOOLTIP,
									},
									{
										label: "State",
										value: VALUE_NOT_AVAILABLE,
									},
								]
							: []),
						{
							label: "Registration Date",
							value: VALUE_NOT_AVAILABLE,
						},
						{
							label: "Entity Type",
							value: VALUE_NOT_AVAILABLE,
						},
						{
							label: "Corporate Officers",
							value: React.createElement(CorporateOfficers, {
								people: undefined,
							}),
						},
						{
							label: "Legal Entity Name",
							value: VALUE_NOT_AVAILABLE,
						},
					],
				},
			];
		}

		// Normal case: show actual SOS filing data
		return sosFilings.map((sosFiling: KYBSosFilingValue) => {
			const rows = [
				{
					label: "Filing Status",
					value: sosFiling.active ? "Active" : "Inactive",
				},
				...(usBusiness
					? [
							{
								label: "Entity Jurisdiction Type",
								value: React.createElement(
									EntityJurisdictionCell,
									{
										foreignDomestic:
											sosFiling.foreign_domestic,
									},
								),
								labelTooltip: ENTITY_JURISDICTION_TYPE_TOOLTIP,
							},
							{
								label: "State",
								value: sosFiling.state ?? VALUE_NOT_AVAILABLE,
							},
						]
					: []),
				{
					label: "Registration Date",
					value:
						formatSourceDate(sosFiling.filing_date, "MM/DD/YYYY") ??
						VALUE_NOT_AVAILABLE,
				},
				{
					label: "Entity Type",
					value: sosFiling?.entity_type
						? capitalizeStringArray(sosFiling.entity_type)
						: VALUE_NOT_AVAILABLE,
				},
				{
					label: "Corporate Officers",
					value: React.createElement(CorporateOfficers, {
						people: sosFiling.officers,
					}),
				},
				{
					label: "Legal Entity Name",
					value: sosFiling.filing_name ?? VALUE_NOT_AVAILABLE,
				},
			];
			return {
				sosFiling,
				rows,
			};
		});
	}, [
		getFactsKybData,
		countryCode,
		shouldHideSosForIntegration,
		hasDirtyBusinessRegistrationFields,
	]);

	return {
		taxDetails,
		enhancedSosFilingsDetails,
		shareholderDocument,
	};
}
