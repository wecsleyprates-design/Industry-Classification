import { useCallback, useEffect, useRef, useState } from "react";
import type {
	FieldPath,
	FieldValues,
	UseControllerReturn,
} from "react-hook-form";

// Tracks pac-container clicks via localStorage (shared across module federation chunks)
const PAC_CLICK_STORAGE_KEY = "__editMode_lastPacClickTime";

function getLastPacClickTime(): number {
	try {
		const value = localStorage.getItem(PAC_CLICK_STORAGE_KEY);
		return value ? parseInt(value, 10) : 0;
	} catch {
		return 0;
	}
}

function setLastPacClickTime(time: number): void {
	try {
		localStorage.setItem(PAC_CLICK_STORAGE_KEY, time.toString());
	} catch {
		// localStorage might not be available
	}
}

export interface UseEditModeParams<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
	/** Field controller from useController */
	field: UseControllerReturn<TFieldValues, TName>["field"];
	/** Current field value */
	value: string;
	/** Form value from RHF */
	formValue: string;
	/** Original value from API */
	originalValue: string;
	/** Whether editing is enabled */
	editingEnabled: boolean;
	/** Whether field is disabled */
	disabled: boolean;
	/** Whether field has suggestions */
	hasSuggestions: boolean;
	/** Container ref for click outside detection */
	containerRef: React.RefObject<HTMLDivElement | null>;
	/** Callback to trigger validation */
	trigger: (name: TName) => Promise<boolean>;
	/** Callback to clear errors */
	clearErrors: (name: TName) => void;
	/** Field name */
	name: TName;
	/** Callback when edit is complete */
	onEditComplete?: (
		fieldKey: string,
		originalValue: string,
		newValue: string,
	) => void;
	/** When true, the input starts empty on edit (sensitive fields like SSN) */
	clearEditValue?: boolean;
}

export interface UseEditModeReturn {
	/** Whether currently in edit mode */
	isEditing: boolean;
	/** Set editing state */
	setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
	/** Ref to track if edit was completed (e.g., from suggestion select) */
	editCompletedRef: React.MutableRefObject<boolean>;
	/** Ref to track value when edit mode started */
	valueBeforeEditRef: React.MutableRefObject<string>;
	/** Exit edit mode and validate */
	exitEditMode: () => Promise<void>;
	/** Enter edit mode */
	handleEnterEditMode: (e?: React.MouseEvent | React.KeyboardEvent) => void;
	/** Update the current value ref directly (for async updates like Google Places) */
	updateCurrentValue: (newValue: string) => void;
}

/**
 * Hook to manage edit mode state and transitions.
 * Handles entering/exiting edit mode, validation on exit, and click-outside detection.
 */
export function useEditMode<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	field,
	value,
	formValue,
	originalValue,
	editingEnabled,
	disabled,
	containerRef,
	trigger,
	clearErrors,
	name,
	onEditComplete,
	clearEditValue,
}: UseEditModeParams<TFieldValues, TName>): UseEditModeReturn {
	const [isEditing, setIsEditing] = useState(false);
	const editCompletedRef = useRef(false);
	const valueBeforeEditRef = useRef<string>(value);
	// Track the current value in a ref that's always up-to-date
	// This is needed because field.value can be stale in async scenarios (like Google Places)
	const currentValueRef = useRef<string>(value);
	// Ref to hold the latest exitEditMode function to avoid effect re-runs
	const exitEditModeRef = useRef<(() => Promise<void>) | undefined>(
		undefined,
	);
	const wasClearedOnEditRef = useRef(false);

	// Exit edit mode and notify parent if value changed (only if valid)
	const exitEditMode = useCallback(async () => {
		setIsEditing(false);

		// Skip if edit was already completed (e.g., from suggestion select)
		if (editCompletedRef.current) return;

		// Trigger RHF validation
		field.onBlur();

		// Get the value we should revert to (the value when edit mode started)
		const revertValue = valueBeforeEditRef.current;

		// Read current value from ref to avoid stale closure issues
		// This is important for async updates like Google Places Autocomplete
		// where field.value might not reflect the latest onChange call
		const currentValue = currentValueRef.current;

		// If the field was cleared on edit entry and the user didn't type anything,
		// restore the original value silently (no change recorded)
		if (wasClearedOnEditRef.current && currentValue === "") {
			field.onChange(revertValue);
			wasClearedOnEditRef.current = false;
			return;
		}
		wasClearedOnEditRef.current = false;

		// Validate field before calling onEditComplete
		const isValid = await trigger(name);

		if (!isValid) {
			// Validation failed - revert to the value before editing started
			field.onChange(revertValue);
			return;
		}

		// Only notify parent if value changed AND validation passed
		if (onEditComplete && currentValue !== revertValue) {
			editCompletedRef.current = true;
			onEditComplete(name as string, revertValue, currentValue);
		}
	}, [field, onEditComplete, name, trigger]);

	// Keep ref updated with latest exitEditMode
	useEffect(() => {
		exitEditModeRef.current = exitEditMode;
	}, [exitEditMode]);

	// Keep currentValueRef always up-to-date with the latest value
	useEffect(() => {
		currentValueRef.current = value;
	}, [value]);

	// Method to update current value directly (for async updates like Google Places)
	const updateCurrentValue = useCallback((newValue: string) => {
		currentValueRef.current = newValue;
	}, []);

	// Click outside detection
	useEffect(() => {
		if (!isEditing) return;

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			const now = Date.now();
			const timeSinceLastPacClick = now - getLastPacClickTime();

			// Skip exit for Google Places dropdown clicks (rendered outside container)
			if (target.closest(".pac-container")) {
				setLastPacClickTime(now);
				return;
			}

			// Skip exit if pac-container was clicked recently (dropdown closes after selection)
			if (timeSinceLastPacClick < 500) {
				return;
			}

			if (
				containerRef.current &&
				!containerRef.current.contains(target)
			) {
				void exitEditModeRef.current?.();
			}
		};

		// Small delay to prevent the click that opened edit mode from immediately closing it
		const timeoutId = setTimeout(() => {
			document.addEventListener("mousedown", handleClickOutside);
		}, 50);

		return () => {
			clearTimeout(timeoutId);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isEditing, containerRef]);

	// Enter edit mode
	const handleEnterEditMode = useCallback(
		(e?: React.MouseEvent | React.KeyboardEvent) => {
			e?.stopPropagation();
			e?.preventDefault();
			if (!editingEnabled || disabled) return;

			// Clear any existing validation errors when entering edit mode
			clearErrors(name);

			// Sync form value with displayed value if form is empty but we have original value
			if (!formValue && originalValue) {
				field.onChange(originalValue);
			}

			// Capture current value before entering edit mode (to revert to on validation failure)
			valueBeforeEditRef.current = value;
			editCompletedRef.current = false;

			// For sensitive fields: start with an empty input so the masked value isn't exposed
			wasClearedOnEditRef.current = !!clearEditValue;
			if (clearEditValue) {
				field.onChange("");
			}

			setIsEditing(true);
		},
		[
			editingEnabled,
			disabled,
			value,
			formValue,
			originalValue,
			field,
			clearErrors,
			name,
			clearEditValue,
		],
	);

	return {
		isEditing,
		setIsEditing,
		editCompletedRef,
		valueBeforeEditRef,
		exitEditMode,
		handleEnterEditMode,
		updateCurrentValue,
	};
}
