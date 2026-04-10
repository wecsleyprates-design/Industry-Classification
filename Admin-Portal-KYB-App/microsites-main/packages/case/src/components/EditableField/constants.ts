import { cn } from "@/lib/utils";

/** Check if a value is empty (null, undefined, or empty string) */
export const isEmpty = (value: unknown): boolean =>
	value === null || value === undefined || value === "";

/** Minimum input width in pixels */
export const MIN_INPUT_WIDTH = 300;

/** Get base input classes with optional validation error styling */
export const getBaseInputClasses = (hasError: boolean) =>
	cn(
		"flex h-10 rounded-md border bg-white px-3 py-2 text-sm",
		"transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
		"disabled:cursor-not-allowed disabled:opacity-50",
		hasError
			? "border-red-500 focus-visible:ring-red-500"
			: "border-gray-300",
	);

/** Get input style object with calculated width */
export const getInputStyle = (inputWidth: number | undefined) => ({
	width: inputWidth ? `${inputWidth}px` : `${MIN_INPUT_WIDTH}px`,
	minWidth: `${MIN_INPUT_WIDTH}px`,
});
