import type { ReactNode } from "react";
import { useMemo } from "react";
import {
	EditableField,
	type SuggestionOption,
} from "@/components/EditableField";
import type {
	FieldOverridesMap,
	FieldSource,
} from "../../../../components/fieldSource.types";
import {
	type FieldOverrideInfo,
	resolveCompoundFieldSource,
} from "../../../../components/fieldSource.utils";
import type {
	FieldConfig,
	FieldRenderProps,
	LoadingStateKey,
} from "../../config/OverviewTab/fieldConfigs";
import { OVERVIEW_TAB_FIELD_CONFIGS } from "../../config/OverviewTab/fieldConfigs";
import type { OverviewTabFieldKey } from "../../schemas/OverviewTab/overviewTabSchema";
import {
	getFieldValidationRules,
	type ValidationContext,
} from "../../utils/OverviewTab/validation";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Skeleton } from "@/ui/skeleton";

type Detail = {
	label: ReactNode;
	value: ReactNode;
	fieldSource?: FieldSource;
};

interface UseOverviewFieldRendererParams {
	owner: any;
	loadingStates: Record<LoadingStateKey, boolean>;
	canEdit: boolean;
	getSaveStatus: (fieldKey: string) => "idle" | "saving" | "saved" | "error";
	handleEditComplete: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
	guestOwnerEdits: string[];
	isFieldDirty?: (fieldKey: OverviewTabFieldKey) => boolean;
	getOriginalValue?: (fieldKey: OverviewTabFieldKey) => string;
	suggestionOverrides?: Record<string, SuggestionOption[]>;
	validationContext?: ValidationContext;
	ownersSubmittedOverrideInfo?: FieldOverrideInfo | null;
	/** Field keys edited by internal users in the current session */
	internallyEditedFields?: string[];
	userNameMap?: Map<string, string>;
	/** Owner ID for building fieldOverrides lookup keys */
	ownerId?: string;
	/** Per-owner-per-field override entries from the backend */
	fieldOverridesMap?: FieldOverridesMap | null;
	/** Overrides SSN display masking (BEST_87 + READ_SSN gating) */
	ssnFormatDisplayValue?: (val: string) => string;
}

export function useOverviewFieldRenderer({
	owner,
	loadingStates,
	canEdit,
	getSaveStatus,
	handleEditComplete,
	guestOwnerEdits,
	isFieldDirty,
	getOriginalValue,
	suggestionOverrides,
	validationContext,
	ownersSubmittedOverrideInfo,
	internallyEditedFields = [],
	userNameMap = new Map(),
	ownerId,
	fieldOverridesMap,
	ssnFormatDisplayValue,
}: UseOverviewFieldRendererParams): { overviewDetails: Detail[] } {
	const getFieldSource = (config: FieldConfig): FieldSource =>
		resolveCompoundFieldSource({
			fieldKey: config.fieldKey,
			ownerId,
			isApplicantProvided: config.getInternallyProvided(guestOwnerEdits),
			internallyEditedFields,
			fieldOverridesMap,
			factLevelOverride: ownersSubmittedOverrideInfo,
			userNameMap,
		});

	const renderField = useMemo(
		() =>
			(config: FieldConfig): Detail => {
				const loading = loadingStates[config.loadingStateKey];
				const originalValue = config.getOriginalValue(owner);
				const saveStatus = getSaveStatus(config.fieldKey);
				const suggestions =
					suggestionOverrides?.[config.fieldKey] ??
					config.suggestions;

				const fieldSource = getFieldSource(config);

				if (loading && (!config.editable || config.customRenderer)) {
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

				if (!config.editable) {
					const displayValue = originalValue || VALUE_NOT_AVAILABLE;
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
						suggestions,
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
					config.fieldKey as OverviewTabFieldKey,
					validationContext,
				);

				const displayFormatter =
					config.fieldKey === "ssn" && ssnFormatDisplayValue
						? ssnFormatDisplayValue
						: config.formatDisplayValue;

				return {
					label: config.label,
					value: (
						<EditableField
							name={config.fieldKey as OverviewTabFieldKey}
							inputType={config.inputType ?? "text"}
							onEditComplete={handleEditComplete}
							editingEnabled={canEdit}
							saveStatus={saveStatus}
							placeholder={config.placeholder}
							label={labelText}
							suggestions={suggestions}
							formatDisplayValue={displayFormatter}
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
			owner,
			loadingStates,
			canEdit,
			getSaveStatus,
			handleEditComplete,
			guestOwnerEdits,
			isFieldDirty,
			getOriginalValue,
			suggestionOverrides,
			validationContext,
			ownersSubmittedOverrideInfo,
			internallyEditedFields,
			userNameMap,
			ownerId,
			fieldOverridesMap,
			ssnFormatDisplayValue,
		],
	);

	// Render all overview fields
	const overviewDetails = useMemo(
		() => OVERVIEW_TAB_FIELD_CONFIGS.map(renderField),
		[renderField],
	);

	return {
		overviewDetails,
	};
}
