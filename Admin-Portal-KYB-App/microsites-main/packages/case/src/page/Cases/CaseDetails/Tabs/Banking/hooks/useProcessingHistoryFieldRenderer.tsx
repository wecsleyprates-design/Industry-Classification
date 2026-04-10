import React, { useMemo } from "react";
import type { SuggestionGroup } from "@/components/EditableField";
import { EditableField } from "@/components/EditableField";
import { DisplayFieldValue } from "../../../components/DisplayFieldValue";
import { SYSTEM_SOURCE } from "../../../components/fieldSource.types";
import { MultiSelectMonthsField } from "../components/MultiSelectMonthsField";
import { PointOfSaleField } from "../components/PointOfSaleVolumeGroupField";
import type { ProcessingHistoryFieldConfig } from "../config/processingHistoryFieldConfigs";
import { getFieldConfigsForSection } from "../config/processingHistoryFieldConfigs";
import type { ProcessingHistoryFieldKey } from "../schemas/processingHistorySchema";
import { getFieldValidationRules } from "../utils/validation";
import type { FieldSourceMap } from "./useProcessingHistoryEditState";

interface UseProcessingHistoryFieldRendererParams {
	editingEnabled: boolean;
	getSaveStatus: (
		fieldKey: ProcessingHistoryFieldKey,
	) => "idle" | "saving" | "saved" | "error";
	getOriginalValue: (
		fieldKey: ProcessingHistoryFieldKey,
	) => string | string[];
	onEditComplete: (
		fieldKey: ProcessingHistoryFieldKey,
		originalValue: string | string[],
		newValue: string | string[],
	) => void;
	suggestions?: SuggestionGroup[];
	fieldSourceMap?: FieldSourceMap;
}

type FieldRow = {
	label: string;
	field: React.ReactNode;
};

/**
 * Hook that renders field configurations into field rows for each section.
 */
export function useProcessingHistoryFieldRenderer({
	editingEnabled,
	getSaveStatus,
	getOriginalValue,
	onEditComplete,
	suggestions,
	fieldSourceMap,
}: UseProcessingHistoryFieldRendererParams) {
	const renderField = useMemo(
		() =>
			(config: ProcessingHistoryFieldConfig): FieldRow => {
				const originalValue = getOriginalValue(
					config.fieldKey as ProcessingHistoryFieldKey,
				);
				const saveStatus = getSaveStatus(
					config.fieldKey as ProcessingHistoryFieldKey,
				);
				const fieldSource =
					fieldSourceMap?.[config.fieldKey] ?? SYSTEM_SOURCE;

				if (config.customRenderer === "multiSelectMonths") {
					return {
						label: config.label,
						field: (
							<DisplayFieldValue
								fieldSource={fieldSource}
								value={
									<MultiSelectMonthsField
										name={
											config.fieldKey as "seasonal_high_volume_months"
										}
										editingEnabled={editingEnabled}
										originalValue={
											(originalValue as string[]) || []
										}
										onEditComplete={(
											fieldKey,
											originalValue,
											newValue,
										) => {
											onEditComplete(
												fieldKey as ProcessingHistoryFieldKey,
												originalValue,
												newValue,
											);
										}}
										fieldSource={fieldSource}
									/>
								}
							/>
						),
					};
				}

				const validationRules = getFieldValidationRules(
					config.fieldKey,
				);

				return {
					label: config.label,
					field: (
						<DisplayFieldValue
							fieldSource={fieldSource}
							value={
								<EditableField
									name={config.fieldKey}
									inputType={config.inputType ?? "text"}
									onEditComplete={(
										fieldKey,
										originalValue,
										newValue,
									) => {
										onEditComplete(
											fieldKey as ProcessingHistoryFieldKey,
											originalValue,
											newValue,
										);
									}}
									editingEnabled={editingEnabled}
									saveStatus={saveStatus}
									placeholder={config.placeholder}
									formatDisplayValue={
										config.formatDisplayValue
									}
									originalValue={originalValue as string}
									rules={validationRules}
									suggestionGroups={suggestions}
									fieldSource={fieldSource}
									{...config.additionalProps}
								/>
							}
						/>
					),
				};
			},
		[
			editingEnabled,
			getSaveStatus,
			getOriginalValue,
			onEditComplete,
			suggestions,
			fieldSourceMap,
		],
	);

	// Render fields for each section
	const generalFields = useMemo(
		() => getFieldConfigsForSection("general").map(renderField),
		[renderField],
	);

	const seasonalFields = useMemo(
		() => getFieldConfigsForSection("seasonal").map(renderField),
		[renderField],
	);

	const cardFields = useMemo(
		() => getFieldConfigsForSection("card").map(renderField),
		[renderField],
	);

	const amexFields = useMemo(
		() => getFieldConfigsForSection("amex").map(renderField),
		[renderField],
	);

	const pointOfSaleFields = useMemo(() => {
		const posConfigs = getFieldConfigsForSection("pointOfSale");

		// Use individual field components for Point of Sale Volume
		// Each field is rendered as a separate row but shares edit state via context
		return posConfigs.map((config) => ({
			label: config.label,
			field: (
				<DisplayFieldValue
					fieldSource={
						fieldSourceMap?.[config.fieldKey] ?? SYSTEM_SOURCE
					}
					value={
						<PointOfSaleField
							fieldKey={
								config.fieldKey as ProcessingHistoryFieldKey
							}
							label={config.label}
							editingEnabled={editingEnabled}
							getSaveStatus={getSaveStatus}
							getOriginalValue={getOriginalValue}
						/>
					}
				/>
			),
		}));
	}, [editingEnabled, getSaveStatus, getOriginalValue, fieldSourceMap]);

	return {
		generalFields,
		seasonalFields,
		cardFields,
		amexFields,
		pointOfSaleFields,
	};
}
