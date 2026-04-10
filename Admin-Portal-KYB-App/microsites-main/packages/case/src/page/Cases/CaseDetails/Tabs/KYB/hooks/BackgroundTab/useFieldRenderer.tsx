import type { ReactNode } from "react";
import { useMemo } from "react";
import type { SuggestionGroup } from "@/components/EditableField";
import { EditableField } from "@/components/EditableField";
import type { FieldSource } from "../../../../components/fieldSource.types";
import { resolveFieldSource } from "../../../../components/fieldSource.utils";
import type {
	FieldConfig,
	FieldRenderProps,
	LoadingStateKey,
} from "../../config/BackgroundTab/fieldConfigs";
import { BACKGROUND_TAB_FIELD_CONFIGS } from "../../config/BackgroundTab/fieldConfigs";
import type { BackgroundTabFieldKey } from "../../schemas/BackgroundTab/backgroundTabSchema";
import { getFieldValidationRules } from "../../utils/BackgroundTab/validation";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Skeleton } from "@/ui/skeleton";

type Detail = {
	label: ReactNode;
	value: ReactNode;
	fieldSource?: FieldSource;
};

interface UseFieldRendererParams {
	originalValues: Record<string, string>;
	loadingStates: Record<LoadingStateKey | "address" | "npi", boolean>;
	canEdit: boolean;
	getSaveStatus: (fieldKey: string) => "idle" | "saving" | "saved" | "error";
	handleEditComplete: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
	suggestions: Record<string, SuggestionGroup[]>;
	guestOwnerEdits: string[];
	data?: any;
	countryCode?: string;
	phoneNumber?: string | null;
	/** Check if a field is dirty (from react-hook-form) */
	isFieldDirty?: (fieldKey: BackgroundTabFieldKey) => boolean;
	/** Get original value for a field (from react-hook-form) */
	getOriginalValue?: (fieldKey: BackgroundTabFieldKey) => string;
	/** Child fields that should be cleared (parent was edited) */
	clearedChildFields?: string[];
	/** Map of override userIDs to display names (from useOverrideUsers) */
	userNameMap?: Map<string, string>;
}

/**
 * Hook that renders field configurations into Details arrays for each section.
 * This is the core rendering logic that converts declarative configs into UI.
 *
 * Now uses EditableField which integrates with react-hook-form for:
 * - Automatic dirty state tracking
 * - Form-level validation
 * - Unified form state management
 */
export function useFieldRenderer({
	originalValues,
	loadingStates,
	canEdit,
	getSaveStatus,
	handleEditComplete,
	suggestions,
	guestOwnerEdits,
	data,
	countryCode,
	phoneNumber,
	isFieldDirty,
	getOriginalValue,
	clearedChildFields = [],
	userNameMap = new Map(),
}: UseFieldRendererParams) {
	const getFieldSource = (config: FieldConfig): FieldSource | undefined =>
		resolveFieldSource(
			config.getInternallyProvided(guestOwnerEdits),
			config.getFieldOverride?.(data) ?? null,
			userNameMap,
		);

	const renderField = useMemo(
		() =>
			(config: FieldConfig): Detail => {
				const loading = loadingStates[config.loadingStateKey];
				const originalValue = config.getOriginalValue(
					originalValues,
					data,
				);
				const saveStatus = getSaveStatus(config.fieldKey);
				const suggestionGroups = config.suggestionKey
					? suggestions[config.suggestionKey] || []
					: undefined;
				const fieldSource = getFieldSource(config);

				if (loading && (!config.editable || config.getDisplayValue)) {
					return {
						label: config.label,
						value: (
							<Skeleton
								className={`h-4 ${config.skeletonWidth}`}
							/>
						),
						fieldSource,
					};
				}

				if (!config.editable || config.getDisplayValue) {
					const isCleared = clearedChildFields.includes(
						config.fieldKey,
					);
					const displayValue = isCleared
						? VALUE_NOT_AVAILABLE
						: config.getDisplayValue
							? config.getDisplayValue(data)
							: originalValue || VALUE_NOT_AVAILABLE;
					return {
						label: config.label,
						value: displayValue,
						fieldSource,
					};
				}

				if (config.customRenderer) {
					const renderProps: FieldRenderProps = {
						fieldConfig: config,
						originalValue,
						loading,
						canEdit,
						saveStatus,
						handleEditComplete,
						suggestionGroups,
						suggestions: config.suggestions,
						countryCode,
						phoneNumber,
						skeletonWidth: config.skeletonWidth,
					};
					return {
						label: config.label,
						value: config.customRenderer(renderProps),
						fieldSource,
					};
				}

				const labelText =
					typeof config.label === "string" ? config.label : "Field";

				const validationRules = getFieldValidationRules(
					config.fieldKey as BackgroundTabFieldKey,
				);

				return {
					label: config.label,
					value: (
						<EditableField
							name={config.fieldKey as BackgroundTabFieldKey}
							inputType={config.inputType ?? "text"}
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
					fieldSource,
				};
			},
		[
			originalValues,
			loadingStates,
			canEdit,
			getSaveStatus,
			handleEditComplete,
			suggestions,
			guestOwnerEdits,
			data,
			countryCode,
			phoneNumber,
			isFieldDirty,
			getOriginalValue,
			clearedChildFields,
			userNameMap,
		],
	);

	// Render business details section
	const businessDetails = useMemo(
		() =>
			BACKGROUND_TAB_FIELD_CONFIGS.filter(
				(config) => config.section === "businessDetails",
			).map(renderField),
		[renderField],
	);

	// Render industry section
	const industryDetails = useMemo(
		() =>
			BACKGROUND_TAB_FIELD_CONFIGS.filter(
				(config) => config.section === "industry",
			).map(renderField),
		[renderField],
	);

	return {
		businessDetails,
		industryDetails,
	};
}
