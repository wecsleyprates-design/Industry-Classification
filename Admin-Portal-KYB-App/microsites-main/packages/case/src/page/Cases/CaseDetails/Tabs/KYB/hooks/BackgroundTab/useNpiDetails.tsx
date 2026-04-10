import React, { useMemo } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { EditableField } from "@/components/EditableField";
import type { BusinessNpiResponse } from "@/types/integrations";
import type { FieldSource } from "../../../../components/fieldSource.types";
import { SYSTEM_SOURCE } from "../../../../components/fieldSource.types";
import type { BackgroundTabFormValues } from "../../schemas/BackgroundTab/backgroundTabSchema";
import { validateNPI } from "../../utils/BackgroundTab/validation";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { getNpiProvider } from "@/helpers";
import { VerificationBadge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";

type Detail = {
	label: React.ReactNode;
	value: React.ReactNode;
	fieldSource?: FieldSource;
};

type Details = Detail[];

interface UseNpiDetailsParams {
	/** NPI data from useBackgroundTabData */
	npiData: BusinessNpiResponse | undefined;
	/** NPI number from KYB facts (primary source) */
	factsNpiNumber?: string | null | undefined;
	/** Whether NPI data is loading */
	isLoading: boolean;
	/** Whether NPI feature is enabled */
	isNPIEnabled: boolean;
	/** Whether editing is allowed */
	canEdit: boolean;
	/** Get save status for a field */
	getSaveStatus: (fieldKey: string) => "idle" | "saving" | "saved" | "error";
	/** Handle edit completion */
	handleEditComplete: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
	/** Child fields that should be cleared (parent was edited) */
	clearedChildFields?: string[];
}

/**
 * Hook that formats NPI data for display.
 * NPI data is now passed in from useBackgroundTabData (single source of truth).
 * Returns formatted NPI details array ready for rendering in DetailsCard.
 */
export function useNpiDetails({
	npiData,
	factsNpiNumber,
	isLoading: isNpiLoading,
	isNPIEnabled,
	canEdit,
	getSaveStatus,
	handleEditComplete,
	clearedChildFields = [],
}: UseNpiDetailsParams) {
	// Check if NPI child fields should be cleared (NPI number was edited)
	const npiChildFieldsCleared = clearedChildFields.some((f) =>
		f.startsWith("npi_"),
	);

	const formattedNpiDetails: Details | null = useMemo(() => {
		// Return null only if NPI not enabled, or not loading AND no data
		if (!isNPIEnabled) return null;
		if (
			!npiData?.data &&
			!isNpiLoading &&
			(factsNpiNumber == null || factsNpiNumber === "")
		)
			return null;

		const data = npiData?.data;
		const metadata = data?.metadata ?? {};
		const submittedNpi =
			factsNpiNumber != null && factsNpiNumber !== ""
				? factsNpiNumber
				: (data?.submitted_npi ?? "");

		// Helper to render loading skeleton, cleared (N/A), or actual value
		const renderValue = (value: React.ReactNode) => {
			if (isNpiLoading) return <Skeleton className="h-4 w-24" />;
			// If NPI number was edited, child fields show N/A until refresh
			if (npiChildFieldsCleared) return VALUE_NOT_AVAILABLE;
			return value;
		};

		// Get provider value with proper null check
		const providerValue = data ? getNpiProvider(data) : null;

		const entityTypeCode = metadata["entity type code"];
		const npiType =
			entityTypeCode === 2
				? "NPI-2 Organization"
				: entityTypeCode === 1
					? "NPI-1 Individual"
					: null;

		// Determine entity name and value based on NPI type
		const { entityName, entityValue } =
			npiType === "NPI-2 Organization"
				? {
						entityName: "Organization",
						entityValue: data?.provider_organization_name,
					}
				: {
						entityName: "Provider",
						entityValue: providerValue,
					};

		return [
			{
				label: entityName,
				value: renderValue(entityValue ?? VALUE_NOT_AVAILABLE),
				fieldSource: SYSTEM_SOURCE,
			},
			{
				label: "NPI Type",
				value: renderValue(npiType ?? VALUE_NOT_AVAILABLE),
				fieldSource: SYSTEM_SOURCE,
			},
			{
				label: "NPI Number",
				value: (
					<EditableField<BackgroundTabFormValues>
						name="npi_number"
						inputType="text"
						onEditComplete={(fieldKey, originalValue, newValue) => {
							handleEditComplete("npi", originalValue, newValue);
						}}
						editingEnabled={canEdit}
						saveStatus={getSaveStatus("npi")}
						placeholder="Enter 10-digit NPI number"
						label="NPI Number"
						originalValue={submittedNpi}
						rules={{ validate: validateNPI }}
						isLoading={isNpiLoading}
						skeletonWidth="w-28"
						renderDisplayValue={(value) => {
							// Hyperlink to NPI registry if value exists and NPI was matched
							if (
								value &&
								value !== VALUE_NOT_AVAILABLE &&
								data?.is_matched
							) {
								return (
									<a
										href={`https://npiregistry.cms.hhs.gov/provider-view/${value}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:underline flex gap-1"
										onClick={(e) => {
											// Stop propagation to prevent triggering edit mode when clicking the link
											// User can still edit by clicking elsewhere on the field
											e.stopPropagation();
										}}
									>
										{value}
										<ArrowTopRightOnSquareIcon className="w-4 h-4" />
									</a>
								);
							}
							// Return plain text otherwise, either unmatched NPI or N/A
							return value === VALUE_NOT_AVAILABLE || !value
								? VALUE_NOT_AVAILABLE
								: value;
						}}
					/>
				),
				fieldSource: SYSTEM_SOURCE,
			},
			{
				label: "Status",
				value: renderValue(
					data?.is_matched ? (
						<VerificationBadge
							variant="success"
							className="text-xs"
						>
							Active
						</VerificationBadge>
					) : (
						<VerificationBadge variant="error" className="text-xs">
							No records found
						</VerificationBadge>
					),
				),
				fieldSource: SYSTEM_SOURCE,
			},
			{
				label: "Primary Taxonomy",
				value: renderValue(
					metadata["healthcare provider taxonomy code_1"] ??
						VALUE_NOT_AVAILABLE,
				),
				fieldSource: SYSTEM_SOURCE,
			},
			{
				label: "State #1 License Issuer",
				value: renderValue(
					metadata["provider license number state code_1"] ??
						VALUE_NOT_AVAILABLE,
				),
				fieldSource: SYSTEM_SOURCE,
			},
			{
				label: "State #1 License Number",
				value: renderValue(
					metadata["provider license number_1"] ??
						VALUE_NOT_AVAILABLE,
				),
				fieldSource: SYSTEM_SOURCE,
			},
			{
				label: "Last Updated",
				value: renderValue(
					data?.updated_at
						? dayjs(data.updated_at).format("MM/DD/YYYY")
						: VALUE_NOT_AVAILABLE,
				),
				fieldSource: SYSTEM_SOURCE,
			},
		];
	}, [
		npiData,
		factsNpiNumber,
		isNpiLoading,
		isNPIEnabled,
		canEdit,
		getSaveStatus,
		handleEditComplete,
		npiChildFieldsCleared,
	]);

	return {
		npiDetails: npiData,
		formattedNpiDetails,
	};
}
