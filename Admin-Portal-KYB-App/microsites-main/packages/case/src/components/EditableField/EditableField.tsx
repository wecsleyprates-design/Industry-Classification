import React, { memo, useCallback, useEffect, useId, useRef } from "react";
import {
	type FieldPath,
	type FieldValues,
	type RegisterOptions,
	useController,
	useFormContext,
} from "react-hook-form";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { GoogleAddressAutocomplete } from "@/components/GoogleAddressAutocomplete";
import { cn } from "@/lib/utils";
import { SuggestionsDropdown } from "./components/SuggestionsDropdown";
import { UpdateBadge } from "./components/UpdateBadge";
import { getBaseInputClasses, getInputStyle, isEmpty } from "./constants";
import {
	useConditionalVisibility,
	useEditMode,
	useInputMeasurement,
	useSuggestions,
} from "./hooks";
import type {
	EditableFieldInputType,
	SaveStatus,
	SuggestionGroup,
	SuggestionOption,
} from "./types";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import type { FieldSource } from "@/page/Cases/CaseDetails/components/fieldSource.types";
import { Skeleton } from "@/ui/skeleton";

export interface EditableFieldProps<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
	/** The field name (must match form schema) */
	name: TName;
	/** The type of input to render in edit mode */
	inputType: EditableFieldInputType;
	/** Optional suggestions to render as selectable options (flat list) */
	suggestions?: SuggestionOption[];
	/** Optional grouped suggestions with titles */
	suggestionGroups?: SuggestionGroup[];
	/** Placeholder text for the input */
	placeholder?: string;
	/** Whether the field is disabled */
	disabled?: boolean;
	/** Whether inline editing is enabled (controlled by permission check) */
	editingEnabled?: boolean;
	/** Optional label for accessibility */
	label?: string;
	/** Optional className for the container */
	className?: string;
	/** Optional className for the display mode text */
	displayClassName?: string;
	/** Optional format function for display value */
	formatDisplayValue?: (value: string) => string;
	/** Optional custom renderer for display value (returns ReactNode, overrides formatDisplayValue) */
	renderDisplayValue?: (value: string) => React.ReactNode;
	/** Whether to show the "Updated" badge when modified */
	showUpdatedBadge?: boolean;
	/** Save status of the field ('idle' | 'saving' | 'saved' | 'error') */
	saveStatus?: SaveStatus;
	/** Min value for number inputs */
	min?: number;
	/** Max value for number inputs */
	max?: number;
	/** Step for number inputs */
	step?: number;
	/** Whether to show location pin icon in suggestions (for address fields) */
	showSuggestionIcon?: boolean;
	/** Callback when edit is complete (on blur) - for recording the edit */
	onEditComplete?: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
	/** Original value for comparison (to detect changes) - overrides defaultValues */
	originalValue?: string;
	/** Only show this field when the specified field is dirty/modified */
	showWhenDirty?: FieldPath<TFieldValues>;
	/** Only show this field when the specified field has a value */
	showWhenHasValue?: FieldPath<TFieldValues>;
	/** Validation rules for the field (react-hook-form RegisterOptions) */
	rules?: RegisterOptions<TFieldValues, TName>;
	/** Whether the field data is still loading (shows skeleton) */
	isLoading?: boolean;
	/** Custom skeleton width class (e.g., "w-32", "w-40") */
	skeletonWidth?: string;
	/** When true, the input starts empty on edit to avoid exposing masked/sensitive values */
	clearEditValue?: boolean;
	/** Callback when the field enters or exits edit mode */
	onEditingChange?: (isEditing: boolean) => void;
	/** Source metadata for the field value (shows highlight + tooltip) */
	fieldSource?: FieldSource;
}

/**
 * A react-hook-form integrated inline editing component.
 *
 * This component uses `useController` to connect to the form context,
 * providing automatic dirty state tracking, validation, and value management.
 *
 * Features:
 * - Click to edit with smooth transition
 * - Suggestions dropdown with grouped options
 * - "Updated" badge for saved changes
 * - Validation errors from form schema
 */
function EditableFieldInner<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	name,
	inputType,
	suggestions,
	suggestionGroups,
	placeholder = "Enter value...",
	disabled = false,
	editingEnabled = true,
	label,
	className,
	displayClassName,
	formatDisplayValue,
	renderDisplayValue,
	showUpdatedBadge = true,
	saveStatus = "idle",
	min,
	max,
	step,
	showSuggestionIcon = false,
	onEditComplete,
	originalValue: originalValueProp,
	showWhenDirty,
	showWhenHasValue,
	rules,
	isLoading = false,
	skeletonWidth = "w-24",
	clearEditValue,
	onEditingChange,
	fieldSource,
}: EditableFieldProps<TFieldValues, TName>) {
	// ============================================
	// React Hook Form
	// ============================================
	const { control, formState, getValues, trigger, clearErrors } =
		useFormContext<TFieldValues>();
	const {
		field,
		fieldState: { error },
	} = useController({ name, control, rules });

	// Original value from prop (comes from API response)
	const originalValue = originalValueProp ?? "";

	// Current value from RHF - fallback to originalValue when form hasn't been populated yet
	const formValue = String(field.value ?? "");
	const value = field.value !== undefined ? formValue : originalValue || "";

	// ============================================
	// Refs
	// ============================================
	const inputRef = useRef<
		HTMLInputElement | HTMLSelectElement | HTMLButtonElement | null
	>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const measureRef = useRef<HTMLSpanElement | null>(null);
	const suggestionRefs = useRef<Array<HTMLDivElement | HTMLLIElement | null>>(
		[],
	);
	const inputId = useId();

	// ============================================
	// Custom Hooks
	// ============================================
	const {
		isEditing,
		setIsEditing,
		editCompletedRef,
		valueBeforeEditRef,
		exitEditMode,
		handleEnterEditMode: baseHandleEnterEditMode,
		updateCurrentValue,
	} = useEditMode({
		field,
		value,
		formValue,
		originalValue,
		editingEnabled,
		disabled,
		hasSuggestions: false, // We'll handle this below
		containerRef,
		trigger,
		clearErrors,
		name,
		onEditComplete,
		clearEditValue,
	});

	const {
		showSuggestions,
		setShowSuggestions,
		focusedSuggestionIndex,
		setFocusedSuggestionIndex,
		flatOptions,
		hasSuggestions,
		handleSuggestionSelect,
	} = useSuggestions({
		suggestions,
		suggestionGroups,
		field,
		isEditing,
		setIsEditing,
		editCompletedRef,
		valueBeforeEditRef,
		name,
		onEditComplete,
	});

	const { inputWidth, renderAbove } = useInputMeasurement({
		measureRef,
		inputRef,
		value,
		placeholder,
		showSuggestions,
		isEditing,
		optionsCount: flatOptions.length,
	});

	const isVisible = useConditionalVisibility({
		showWhenDirty,
		showWhenHasValue,
		formState,
		getValues,
	});

	useEffect(() => {
		onEditingChange?.(isEditing);
	}, [isEditing, onEditingChange]);

	// ============================================
	// Event Handlers
	// ============================================

	// Wrap handleEnterEditMode to also show suggestions
	const handleEnterEditMode = useCallback(
		(e?: React.MouseEvent | React.KeyboardEvent) => {
			baseHandleEnterEditMode(e);
			if (hasSuggestions) {
				setShowSuggestions(true);
			}
		},
		[baseHandleEnterEditMode, hasSuggestions, setShowSuggestions],
	);

	// Handle input value change
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
			const newValue =
				inputType === "number"
					? e.target.value === ""
						? ""
						: String(parseFloat(e.target.value) || 0)
					: e.target.value;
			field.onChange(newValue);
			void trigger(name);
		},
		[inputType, field, trigger, name],
	);

	// Keyboard handling
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				field.onChange(valueBeforeEditRef.current);
				setIsEditing(false);
				setShowSuggestions(false);
			} else if (e.key === "Enter") {
				if (
					showSuggestions &&
					focusedSuggestionIndex >= 0 &&
					focusedSuggestionIndex < flatOptions.length
				) {
					e.preventDefault();
					handleSuggestionSelect(flatOptions[focusedSuggestionIndex]);
				} else if (inputType !== "dropdown") {
					void exitEditMode();
				}
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				if (!showSuggestions && hasSuggestions) {
					setShowSuggestions(true);
					setFocusedSuggestionIndex(0);
				} else if (showSuggestions) {
					setFocusedSuggestionIndex((i) =>
						Math.min(i + 1, flatOptions.length - 1),
					);
				}
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				if (showSuggestions) {
					setFocusedSuggestionIndex((i) => Math.max(i - 1, 0));
				}
			}
		},
		[
			field,
			inputType,
			showSuggestions,
			focusedSuggestionIndex,
			flatOptions,
			hasSuggestions,
			exitEditMode,
			handleSuggestionSelect,
			setIsEditing,
			setShowSuggestions,
			setFocusedSuggestionIndex,
			valueBeforeEditRef,
		],
	);

	// Handle blur
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
					void exitEditMode();
				}
			}, 100);
		},
		[exitEditMode],
	);

	// ============================================
	// Early return for visibility
	// ============================================
	if (!isVisible) return null;

	// ============================================
	// Render helpers
	// ============================================
	const displayValue = renderDisplayValue
		? renderDisplayValue(value)
		: formatDisplayValue
			? formatDisplayValue(value)
			: isEmpty(value)
				? VALUE_NOT_AVAILABLE
				: value;
	const validationError = error?.message ?? null;
	const baseInputClasses = getBaseInputClasses(!!validationError);
	const inputStyle = getInputStyle(inputWidth);

	const renderInput = () => {
		switch (inputType) {
			case "dropdown": {
				const dropdownDisplayValue = isEmpty(value)
					? VALUE_NOT_AVAILABLE
					: value;
				return (
					<button
						ref={inputRef as React.RefObject<HTMLButtonElement>}
						type="button"
						id={inputId}
						onClick={() => {
							setShowSuggestions(!showSuggestions);
						}}
						onKeyDown={handleKeyDown}
						onBlur={handleBlur}
						disabled={disabled}
						className={cn(
							baseInputClasses,
							"text-left justify-between",
						)}
						style={inputStyle}
						aria-label={label}
						aria-expanded={showSuggestions}
						aria-haspopup="listbox"
					>
						<span className="truncate">{dropdownDisplayValue}</span>
						<svg
							className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
				);
			}

			case "date": {
				// Get today's date in YYYY-MM-DD format to prevent future dates
				const today = new Date().toISOString().split("T")[0];
				return (
					<input
						ref={inputRef as React.RefObject<HTMLInputElement>}
						type="date"
						id={inputId}
						value={value}
						onChange={handleChange}
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
						disabled={disabled}
						max={today}
						className={cn(
							baseInputClasses,
							"w-auto min-w-0",
							"[&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer",
						)}
						aria-label={label}
					/>
				);
			}

			case "number":
				return (
					<input
						ref={inputRef as React.RefObject<HTMLInputElement>}
						type="number"
						id={inputId}
						value={value}
						onChange={handleChange}
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
						disabled={disabled}
						placeholder={placeholder}
						min={min}
						max={max}
						step={step}
						className={baseInputClasses}
						style={inputStyle}
						aria-label={label}
					/>
				);

			case "address":
				return (
					<GoogleAddressAutocomplete
						value={value}
						onChange={(newValue) => {
							// Update the ref immediately so exitEditMode sees the latest value
							updateCurrentValue(newValue);
							field.onChange(newValue);
							void trigger(name);
						}}
						onBlur={() => {
							// Use timeout like other inputs to allow pac-container detection
							setTimeout(() => {
								void exitEditMode();
							}, 150);
						}}
						placeholder={placeholder}
						disabled={disabled}
						className={baseInputClasses}
						hasError={!!validationError}
					/>
				);

			case "text":
			default:
				return (
					<input
						ref={inputRef as React.RefObject<HTMLInputElement>}
						type="text"
						id={inputId}
						value={value}
						onChange={handleChange}
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
						disabled={disabled}
						placeholder={placeholder}
						className={baseInputClasses}
						style={inputStyle}
						aria-label={label}
						autoComplete="off"
					/>
				);
		}
	};

	// Show skeleton while loading
	if (isLoading) {
		return <Skeleton className={cn("h-4", skeletonWidth)} />;
	}

	return (
		<div
			ref={containerRef}
			className={cn("relative overflow-visible", className)}
		>
			{/* Hidden span for measuring text width */}
			<span
				ref={measureRef}
				className="invisible absolute whitespace-pre text-sm"
				aria-hidden="true"
			>
				{isEmpty(value) ? placeholder : value}
			</span>

			{/* Display Mode */}
			<div
				className={cn(
					"group flex items-center gap-1",
					!isEditing &&
						editingEnabled &&
						!disabled &&
						"cursor-pointer hover:bg-gray-50 rounded-md px-1 -mx-1",
					isEditing && "invisible",
					displayClassName,
				)}
				onClick={(e) => {
					if (!isEditing) {
						handleEnterEditMode(e);
					}
				}}
				onKeyDown={(e) => {
					if (!isEditing && (e.key === "Enter" || e.key === " "))
						handleEnterEditMode(e);
				}}
				tabIndex={!isEditing && editingEnabled && !disabled ? 0 : -1}
				role={
					!isEditing && editingEnabled && !disabled
						? "button"
						: undefined
				}
				aria-label={
					!isEditing && editingEnabled && !disabled
						? label
							? `Edit ${label}`
							: "Edit field"
						: undefined
				}
			>
				<span className="text-sm font-normal text-gray-800">
					{displayValue}
				</span>
				{/* Edit icon - shown on hover when editing is enabled */}
				{editingEnabled && !disabled && !isEditing && (
					<PencilSquareIcon
						className="h-3.5 w-3.5 text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
						aria-hidden="true"
					/>
				)}
				<UpdateBadge
					saveStatus={saveStatus}
					showUpdatedBadge={showUpdatedBadge}
				/>
			</div>

			{/* Edit Mode */}
			{isEditing && (
				<div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
					{validationError && showSuggestions && !renderAbove && (
						<p className="mb-1 text-xs text-red-500 whitespace-nowrap">
							{validationError}
						</p>
					)}
					<div className="flex-1">{renderInput()}</div>
					<SuggestionsDropdown
						show={showSuggestions}
						flatOptions={flatOptions}
						suggestionGroups={suggestionGroups}
						value={value}
						focusedIndex={focusedSuggestionIndex}
						renderAbove={renderAbove}
						showIcon={showSuggestionIcon}
						onSelect={handleSuggestionSelect}
						onHover={setFocusedSuggestionIndex}
						suggestionRefs={suggestionRefs}
					/>
					{validationError && (!showSuggestions || renderAbove) && (
						<p className="mt-1 text-xs text-red-500 whitespace-nowrap">
							{validationError}
						</p>
					)}
				</div>
			)}
		</div>
	);
}

// Memoize for performance
export const EditableField = memo(
	EditableFieldInner,
) as typeof EditableFieldInner;

export default EditableField;
