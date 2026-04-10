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
} from "../../config/WebsiteTab/fieldConfigs";
import { WEBSITE_TAB_FIELD_CONFIGS } from "../../config/WebsiteTab/fieldConfigs";
import type { WebsiteTabFieldKey } from "../../schemas/WebsiteTab/websiteTabSchema";
import { getFieldValidationRules } from "../../utils/WebsiteTab/validation";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Skeleton } from "@/ui/skeleton";

type Detail = {
	label: ReactNode;
	value: ReactNode;
	fieldSource?: FieldSource;
};

interface UseWebsiteTabFieldRendererParams {
	originalValues: Record<string, string>;
	loadingStates: Record<LoadingStateKey, boolean>;
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
	/** Check if a field is dirty (from react-hook-form) */
	isFieldDirty?: (fieldKey: WebsiteTabFieldKey) => boolean;
	/** Get original value for a field (from react-hook-form) */
	getOriginalValue?: (fieldKey: WebsiteTabFieldKey) => string;
	userNameMap?: Map<string, string>;
}

/**
 * Hook that renders field configurations into Details arrays for each section.
 * This is the core rendering logic that converts declarative configs into UI.
 */
export function useWebsiteTabFieldRenderer({
	originalValues,
	loadingStates,
	canEdit,
	getSaveStatus,
	handleEditComplete,
	suggestions,
	guestOwnerEdits,
	data,
	isFieldDirty,
	getOriginalValue,
	userNameMap = new Map(),
}: UseWebsiteTabFieldRendererParams) {
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
						skeletonWidth: config.skeletonWidth,
					};
					return {
						label: config.label,
						value: config.customRenderer(renderProps),
						fieldSource,
					};
				}

				if (!config.editable || config.getDisplayValue) {
					const displayValue = config.getDisplayValue
						? config.getDisplayValue(data)
						: originalValue || VALUE_NOT_AVAILABLE;
					return {
						label: config.label,
						value: displayValue,
						fieldSource,
					};
				}

				const labelText =
					typeof config.label === "string" ? config.label : "Field";

				const validationRules = getFieldValidationRules(
					config.fieldKey as WebsiteTabFieldKey,
				);

				return {
					label: config.label,
					value: (
						<EditableField
							name={config.fieldKey as WebsiteTabFieldKey}
							inputType={config.inputType ?? "text"}
							onEditComplete={handleEditComplete}
							editingEnabled={true}
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
			isFieldDirty,
			getOriginalValue,
			userNameMap,
		],
	);

	// Render website details section
	const websiteDetails = useMemo(
		() =>
			WEBSITE_TAB_FIELD_CONFIGS.filter(
				(config) => config.section === "websiteDetails",
			).map(renderField),
		[renderField],
	);

	return {
		websiteDetails,
	};
}
