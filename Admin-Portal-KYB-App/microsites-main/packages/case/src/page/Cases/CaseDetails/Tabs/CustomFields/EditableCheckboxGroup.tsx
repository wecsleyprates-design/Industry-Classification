import React, { useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
	MultiSelectDropdownField,
	type MultiSelectOption,
} from "@/components/EditableField/components/MultiSelectDropdownField";
import type { SaveStatus } from "@/components/EditableField/types";
import type { CustomFieldKey } from "./hooks";

import type { FieldSource } from "@/page/Cases/CaseDetails/components/fieldSource.types";

interface CheckboxItem {
	label: string;
	value: string;
	/** Display label for checkbox options (e.g. " Yes", " Legal Name"). Set by the template builder. */
	checkbox_type?: string;
	/** Optional input type rendered alongside the option (e.g. "number"). Null for most options. */
	input_type?: string;
	checked?: boolean;
}

function parseCheckboxItems(raw: string): CheckboxItem[] {
	try {
		const parsed = JSON.parse(raw || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

interface EditableCheckboxGroupProps {
	fieldId: string;
	editingEnabled: boolean;
	saveStatus: SaveStatus;
	originalValue: string;
	onEditComplete: (
		fieldKey: CustomFieldKey,
		originalValue: string,
		newValue: string,
	) => void;
	fieldSource?: FieldSource;
}

/**
 * Wraps MultiSelectDropdownField for custom field checkboxes.
 * Bridges the form's JSON string format ([{label, value, checked}])
 * with the multi-select's string[] interface.
 */
export const EditableCheckboxGroup: React.FC<EditableCheckboxGroupProps> = ({
	fieldId,
	editingEnabled,
	saveStatus,
	originalValue,
	onEditComplete,
	fieldSource,
}) => {
	const { setValue } = useFormContext();
	const rawValue = (useWatch({ name: fieldId }) as string) ?? "";

	const items = useMemo(() => parseCheckboxItems(rawValue), [rawValue]);

	const options: MultiSelectOption[] = useMemo(
		() => items.map((item) => ({ label: item.label, value: item.value })),
		[items],
	);

	const selectedValues = useMemo(
		() => items.filter((item) => item.checked).map((item) => item.value),
		[items],
	);

	const originalSelectedValues = useMemo(() => {
		const origItems = parseCheckboxItems(originalValue);
		return origItems
			.filter((item) => item.checked)
			.map((item) => item.value);
	}, [originalValue]);

	const handleChange = useCallback(
		(newSelectedValues: string[]) => {
			const selectedSet = new Set(newSelectedValues);
			const updatedItems = items.map((item) => ({
				...item,
				checked: selectedSet.has(item.value),
			}));
			setValue(fieldId, JSON.stringify(updatedItems), {
				shouldDirty: true,
			});
		},
		[items, fieldId, setValue],
	);

	const handleEditComplete = useCallback(
		(_original: string[], _newValue: string[]) => {
			const currentRaw = JSON.stringify(
				items.map((item) => ({
					...item,
					checked: _newValue.includes(item.value),
				})),
			);
			onEditComplete(fieldId, originalValue, currentRaw);
		},
		[items, fieldId, originalValue, onEditComplete],
	);

	return (
		<MultiSelectDropdownField
			options={options}
			selectedValues={selectedValues}
			onChange={handleChange}
			onEditComplete={handleEditComplete}
			originalValue={originalSelectedValues}
			editingEnabled={editingEnabled}
			fieldSource={fieldSource}
			saveStatus={saveStatus}
			placeholder="Select options..."
		/>
	);
};
