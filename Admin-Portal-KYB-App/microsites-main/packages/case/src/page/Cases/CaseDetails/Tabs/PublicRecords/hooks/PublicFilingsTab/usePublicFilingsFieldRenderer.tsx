import type { ReactNode } from "react";
import { useMemo } from "react";
import type { SuggestionGroup } from "@/components/EditableField";
import { EditableField } from "@/components/EditableField";
import type { FieldConfig } from "../../config/PublicFilingsTab/fieldConfigs";
import { PUBLIC_FILINGS_TAB_FIELD_CONFIGS } from "../../config/PublicFilingsTab/fieldConfigs";
import type { PublicFilingsTabFieldKey } from "../../schemas/PublicFilingsTab/publicFilingsTabSchema";
import { getFieldValidationRules } from "../../utils/validation";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Skeleton } from "@/ui/skeleton";

type Detail = {
	label: ReactNode;
	value: ReactNode;
};

interface UsePublicFilingsFieldRendererParams {
	originalValues: Record<string, string>;
	isLoading: boolean;
	canEdit: boolean;
	getSaveStatus: (fieldKey: string) => "idle" | "saving" | "saved" | "error";
	handleEditComplete: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
	suggestions: Record<string, SuggestionGroup[]>;
	data?: any;
}

/**
 * Hook that renders field configurations into Details arrays for each section.
 * This is the core rendering logic that converts declarative configs into UI.
 *
 * Uses EditableField which integrates with react-hook-form for:
 * - Automatic dirty state tracking
 * - Form-level validation
 * - Unified form state management
 */
export function usePublicFilingsFieldRenderer({
	originalValues,
	isLoading,
	canEdit,
	getSaveStatus,
	handleEditComplete,
	suggestions,
}: UsePublicFilingsFieldRendererParams) {
	const renderField = useMemo(
		() =>
			(config: FieldConfig): Detail => {
				const loading = isLoading;
				const originalValue = config.getOriginalValue(originalValues);
				const saveStatus = getSaveStatus(config.fieldKey);
				const suggestionGroups = config.suggestionKey
					? suggestions[config.suggestionKey] || []
					: undefined;

				// Render loading skeleton for non-editable fields only
				// (editable fields handle their own loading state via EditableField)
				if (loading && (!config.editable || config.getDisplayValue)) {
					return {
						label: config.label,
						value: (
							<Skeleton
								className={`h-4 ${config.skeletonWidth}`}
							/>
						),
					};
				}

				// Render read-only field
				if (!config.editable || config.getDisplayValue) {
					const displayValue = config.getDisplayValue
						? config.getDisplayValue(originalValues)
						: originalValue || VALUE_NOT_AVAILABLE;
					return {
						label: config.label,
						value: displayValue,
					};
				}

				// Render standard editable field using EditableField
				const labelText =
					typeof config.label === "string" ? config.label : "Field";

				// Get validation rules for this field (if any)
				const validationRules = getFieldValidationRules(
					config.fieldKey as PublicFilingsTabFieldKey,
				);

				return {
					label: config.label,
					value: (
						<EditableField
							name={config.fieldKey as PublicFilingsTabFieldKey}
							inputType={
								config.inputType === "currency"
									? "text"
									: (config.inputType ?? "text")
							}
							onEditComplete={handleEditComplete}
							editingEnabled={canEdit}
							saveStatus={saveStatus}
							placeholder={config.placeholder}
							label={labelText}
							suggestionGroups={suggestionGroups}
							suggestions={config.suggestions}
							formatDisplayValue={config.formatDisplayValue}
							originalValue={originalValue}
							rules={validationRules}
							isLoading={loading}
							skeletonWidth={config.skeletonWidth}
							{...config.additionalProps}
						/>
					),
				};
			},
		[
			originalValues,
			isLoading,
			canEdit,
			getSaveStatus,
			handleEditComplete,
			suggestions,
		],
	);

	// Render judgements section
	const judgementsDetails = useMemo(
		() =>
			PUBLIC_FILINGS_TAB_FIELD_CONFIGS.filter(
				(config) => config.section === "judgements",
			).map(renderField),
		[renderField],
	);

	// Render liens section
	const liensDetails = useMemo(
		() =>
			PUBLIC_FILINGS_TAB_FIELD_CONFIGS.filter(
				(config) => config.section === "liens",
			).map(renderField),
		[renderField],
	);

	// Render bankruptcies section
	const bankruptciesDetails = useMemo(
		() =>
			PUBLIC_FILINGS_TAB_FIELD_CONFIGS.filter(
				(config) => config.section === "bankruptcies",
			).map(renderField),
		[renderField],
	);

	return {
		judgementsDetails,
		liensDetails,
		bankruptciesDetails,
	};
}
