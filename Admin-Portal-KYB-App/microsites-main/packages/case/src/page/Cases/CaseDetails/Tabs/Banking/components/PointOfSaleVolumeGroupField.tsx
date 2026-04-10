import React, { useCallback, useContext, useRef, useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { UpdateBadge } from "@/components/EditableField/components/UpdateBadge";
import {
	getBaseInputClasses,
	getInputStyle,
} from "@/components/EditableField/constants";
import { cn } from "@/lib/utils";
import type {
	ProcessingHistoryFieldKey,
	ProcessingHistoryFormValues,
} from "../schemas/processingHistorySchema";

const POS_FIELD_KEYS: ProcessingHistoryFieldKey[] = [
	"pos_card_swiped",
	"pos_card_typed",
	"pos_ecommerce",
	"pos_mail_telephone",
];

// Context to share edit state across all POS fields
const PointOfSaleEditContext = React.createContext<{
	isGroupEditing: boolean;
	setIsGroupEditing: (value: boolean) => void;
	handleEnterEditMode: (e?: React.MouseEvent | React.KeyboardEvent) => void;
	handleExitEditMode: () => void;
}>({
	isGroupEditing: false,
	setIsGroupEditing: () => {},
	handleEnterEditMode: () => {},
	handleExitEditMode: () => {},
});

interface PointOfSaleVolumeGroupFieldProps {
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
	fields: Array<{
		fieldKey: ProcessingHistoryFieldKey;
		label: string;
	}>;
}

// Individual field component that uses shared context
interface PointOfSaleFieldItemProps {
	fieldKey: ProcessingHistoryFieldKey;
	label: string;
	editingEnabled: boolean;
	getSaveStatus: (
		fieldKey: ProcessingHistoryFieldKey,
	) => "idle" | "saving" | "saved" | "error";
	getOriginalValue: (
		fieldKey: ProcessingHistoryFieldKey,
	) => string | string[];
}

const PointOfSaleFieldItem: React.FC<PointOfSaleFieldItemProps> = ({
	fieldKey,
	label,
	editingEnabled,
	getSaveStatus,
	getOriginalValue,
}) => {
	const { control, trigger, clearErrors, watch } =
		useFormContext<ProcessingHistoryFormValues>();
	const {
		isGroupEditing,
		setIsGroupEditing,
		handleEnterEditMode,
		handleExitEditMode,
	} = useContext(PointOfSaleEditContext);

	const { field } = useController({
		name: fieldKey,
		control,
	});

	const value = String(field.value ?? "");
	const originalValue = getOriginalValue(fieldKey);
	const saveStatus = getSaveStatus(fieldKey);
	const hasChanged = String(originalValue) !== value;

	// Watch all POS fields for validation
	const formValues = watch();
	const swiped = Number(formValues.pos_card_swiped) || 0;
	const typed = Number(formValues.pos_card_typed) || 0;
	const ecommerce = Number(formValues.pos_ecommerce) || 0;
	const mailTelephone = Number(formValues.pos_mail_telephone) || 0;
	const sum = swiped + typed + ecommerce + mailTelephone;

	// Check if sum is valid (100% or 0%)
	const isValidSum = sum === 100 || sum === 0;
	const hasError = isGroupEditing && !isValidSum;

	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Format display value
	const formatDisplayValue = (val: string): string => {
		const num = Number(val) || 0;
		return `${num}%`;
	};

	const displayValue = formatDisplayValue(value);

	// Handle input change
	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue =
				e.target.value === ""
					? ""
					: String(parseFloat(e.target.value) || 0);
			field.onChange(newValue);
			// Trigger validation for all POS fields
			void trigger("pos_card_swiped" as any);
			void trigger("pos_card_typed" as any);
			void trigger("pos_ecommerce" as any);
			void trigger("pos_mail_telephone" as any);
		},
		[field, trigger],
	);

	// Handle blur - delegate to context's handleExitEditMode
	const handleBlur = useCallback(
		(e: React.FocusEvent) => {
			const relatedTarget = e.relatedTarget as Node | null;
			if (
				relatedTarget &&
				containerRef.current?.contains(relatedTarget)
			) {
				return;
			}
			setTimeout(() => {
				if (!containerRef.current?.contains(document.activeElement)) {
					// Check if any POS field is still focused
					const anyFocused = POS_FIELD_KEYS.some((key) => {
						const input = document.querySelector(
							`input[name="${key}"]`,
						) as HTMLInputElement;
						return input === document.activeElement;
					});

					if (!anyFocused && isValidSum) {
						handleExitEditMode();
					}
				}
			}, 100);
		},
		[isValidSum, handleExitEditMode],
	);

	// Handle keyboard
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				field.onChange(originalValue);
				setIsGroupEditing(false);
				clearErrors();
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (isValidSum) {
					handleExitEditMode();
				}
			}
		},
		[
			field,
			originalValue,
			setIsGroupEditing,
			clearErrors,
			isValidSum,
			handleExitEditMode,
		],
	);

	return (
		<div ref={containerRef} className="relative min-h-[24px]">
			{/* Display Mode */}
			{!isGroupEditing && (
				<div
					className={cn(
						"group flex items-center gap-1",
						editingEnabled &&
							"cursor-pointer hover:bg-gray-50 rounded-md px-1 -mx-1",
					)}
					onClick={handleEnterEditMode}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							handleEnterEditMode(e);
						}
					}}
					tabIndex={editingEnabled ? 0 : -1}
					role={editingEnabled ? "button" : undefined}
					aria-label={editingEnabled ? `Edit ${label}` : undefined}
				>
					<span className="text-sm text-gray-900">
						{displayValue}
					</span>
					{editingEnabled && (
						<PencilSquareIcon
							className="h-3.5 w-3.5 text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
							aria-hidden="true"
						/>
					)}
					<UpdateBadge
						saveStatus={saveStatus}
						showUpdatedBadge={hasChanged}
					/>
				</div>
			)}

			{/* Edit Mode */}
			{isGroupEditing && (
				<div className="flex flex-col">
					<input
						ref={inputRef}
						type="number"
						name={fieldKey}
						value={value}
						onChange={handleInputChange}
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
						disabled={!editingEnabled}
						placeholder="Enter percentage..."
						min={0}
						max={100}
						step={0.01}
						className={cn(
							getBaseInputClasses(hasError),
							getInputStyle(80),
						)}
						aria-label={label}
					/>
					{hasError && (
						<p className="mt-1 text-xs text-red-500 whitespace-nowrap">
							Sum must be 100% or 0%
						</p>
					)}
				</div>
			)}
		</div>
	);
};

// Provider component that wraps the card content
export const PointOfSaleEditProvider: React.FC<{
	children: React.ReactNode;
	editingEnabled: boolean;
	getOriginalValue?: (
		fieldKey: ProcessingHistoryFieldKey,
	) => string | string[];
	onEditComplete?: (
		fieldKey: ProcessingHistoryFieldKey,
		originalValue: string | string[],
		newValue: string | string[],
	) => void;
}> = ({ children, editingEnabled, getOriginalValue, onEditComplete }) => {
	const { clearErrors, getValues } =
		useFormContext<ProcessingHistoryFormValues>();

	// Group edit mode state - shared across all fields
	const [isGroupEditing, setIsGroupEditing] = useState(false);

	// Handle entering edit mode - all fields enter together
	const handleEnterEditMode = useCallback(
		(e?: React.MouseEvent | React.KeyboardEvent) => {
			if (!editingEnabled || isGroupEditing) return;
			e?.preventDefault();
			e?.stopPropagation();
			setIsGroupEditing(true);
			clearErrors();
		},
		[editingEnabled, isGroupEditing, clearErrors],
	);

	// Handle exiting edit mode - save ALL changed POS fields
	const handleExitEditMode = useCallback(() => {
		setIsGroupEditing(false);

		if (!onEditComplete || !getOriginalValue) return;

		// Get current form values for all POS fields
		const formValues = getValues();

		// Call onEditComplete for each changed POS field
		POS_FIELD_KEYS.forEach((fieldKey) => {
			const originalValue = getOriginalValue(fieldKey);
			const currentValue = String(formValues[fieldKey] ?? "");

			if (String(originalValue) !== currentValue) {
				onEditComplete(fieldKey, originalValue, currentValue);
			}
		});
	}, [getOriginalValue, onEditComplete, getValues]);

	return (
		<PointOfSaleEditContext.Provider
			value={{
				isGroupEditing,
				setIsGroupEditing,
				handleEnterEditMode,
				handleExitEditMode,
			}}
		>
			{children}
		</PointOfSaleEditContext.Provider>
	);
};

// Individual field component that can be used in field rows
export const PointOfSaleField: React.FC<PointOfSaleFieldItemProps> = (
	props,
) => {
	return <PointOfSaleFieldItem {...props} />;
};

// Legacy export for backwards compatibility
export const PointOfSaleVolumeGroupField: React.FC<
	PointOfSaleVolumeGroupFieldProps
> = ({
	editingEnabled,
	getSaveStatus,
	getOriginalValue,
	onEditComplete,
	fields,
}) => {
	return (
		<PointOfSaleEditProvider
			editingEnabled={editingEnabled}
			getOriginalValue={getOriginalValue}
			onEditComplete={onEditComplete}
		>
			{fields.map((field) => (
				<PointOfSaleFieldItem
					key={field.fieldKey}
					fieldKey={field.fieldKey}
					label={field.label}
					editingEnabled={editingEnabled}
					getSaveStatus={getSaveStatus}
					getOriginalValue={getOriginalValue}
				/>
			))}
		</PointOfSaleEditProvider>
	);
};
