import React, { useCallback, useMemo } from "react";
import { useController, useFormContext } from "react-hook-form";
import {
	MultiSelectDropdownField,
	type MultiSelectOption,
} from "@/components/EditableField/components/MultiSelectDropdownField";
import type { ProcessingHistoryFormValues } from "../schemas/processingHistorySchema";

import type { FieldSource } from "@/page/Cases/CaseDetails/components/fieldSource.types";

const MONTH_OPTIONS: MultiSelectOption[] = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
].map((m) => ({ label: m, value: m }));

interface MultiSelectMonthsFieldProps {
	name: "seasonal_high_volume_months";
	editingEnabled: boolean;
	originalValue: string[];
	onEditComplete?: (
		fieldKey: string,
		originalValue: string[],
		newValue: string[],
	) => void;
	disabled?: boolean;
	fieldSource?: FieldSource;
}

export const MultiSelectMonthsField: React.FC<MultiSelectMonthsFieldProps> = ({
	name,
	editingEnabled,
	originalValue,
	onEditComplete,
	disabled = false,
	fieldSource,
}) => {
	const { control } = useFormContext<ProcessingHistoryFormValues>();
	const { field } = useController({ name, control });

	const selectedValues: string[] = useMemo(
		() => (Array.isArray(field.value) ? field.value : []),
		[field.value],
	);

	const handleChange = useCallback(
		(values: string[]) => {
			field.onChange(values);
		},
		[field],
	);

	const handleEditComplete = useCallback(
		(original: string[], newValue: string[]) => {
			onEditComplete?.(name, original, newValue);
		},
		[name, onEditComplete],
	);

	return (
		<MultiSelectDropdownField
			options={MONTH_OPTIONS}
			selectedValues={selectedValues}
			onChange={handleChange}
			onEditComplete={handleEditComplete}
			originalValue={originalValue ?? []}
			editingEnabled={editingEnabled}
			disabled={disabled}
			fieldSource={fieldSource}
			ariaLabel="Select months"
			placeholder="Select months..."
		/>
	);
};
