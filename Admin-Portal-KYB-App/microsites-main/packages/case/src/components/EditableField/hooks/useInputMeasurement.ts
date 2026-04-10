import { useEffect, useState } from "react";
import { MIN_INPUT_WIDTH } from "../constants";

export interface UseInputMeasurementParams {
	/** Ref to the measurement span */
	measureRef: React.RefObject<HTMLSpanElement | null>;
	/** Ref to the input element */
	inputRef: React.RefObject<
		HTMLInputElement | HTMLSelectElement | HTMLButtonElement | null
	>;
	/** Current value for measurement */
	value: string;
	/** Placeholder text for measurement */
	placeholder: string;
	/** Whether suggestions dropdown is visible */
	showSuggestions: boolean;
	/** Whether currently in edit mode */
	isEditing: boolean;
	/** Number of options in dropdown */
	optionsCount: number;
}

export interface UseInputMeasurementReturn {
	/** Calculated input width */
	inputWidth: number | undefined;
	/** Whether dropdown should render above input */
	renderAbove: boolean;
}

/**
 * Hook to measure input width and determine dropdown position.
 */
export function useInputMeasurement({
	measureRef,
	inputRef,
	value,
	placeholder,
	showSuggestions,
	isEditing,
	optionsCount,
}: UseInputMeasurementParams): UseInputMeasurementReturn {
	const [inputWidth, setInputWidth] = useState<number | undefined>(undefined);
	const [renderAbove, setRenderAbove] = useState(false);

	// Measure text width for dynamic input sizing
	useEffect(() => {
		if (measureRef.current) {
			const width = measureRef.current.offsetWidth;
			setInputWidth(Math.max(width + 40, MIN_INPUT_WIDTH));
		}
	}, [value, placeholder, measureRef]);

	// Focus input when entering edit mode
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			if (inputRef.current instanceof HTMLInputElement) {
				inputRef.current.select();
			}
		}
	}, [isEditing, inputRef]);

	// Determine if dropdown should render above or below
	useEffect(() => {
		if (showSuggestions && inputRef.current) {
			const rect = inputRef.current.getBoundingClientRect();
			const spaceBelow = window.innerHeight - rect.bottom;
			const estimatedHeight = Math.min(optionsCount * 40 + 16, 240);
			setRenderAbove(spaceBelow < estimatedHeight);
		}
	}, [showSuggestions, optionsCount, inputRef]);

	return {
		inputWidth,
		renderAbove,
	};
}
