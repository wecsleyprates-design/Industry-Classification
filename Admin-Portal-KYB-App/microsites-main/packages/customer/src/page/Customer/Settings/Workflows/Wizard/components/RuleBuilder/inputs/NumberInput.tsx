import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ConditionValue } from "@/types/workflows";
import {
	baseInputStyles,
	errorInputStyles,
	getDisplayValue,
	validateNumber,
	validateWithRegex,
} from "./shared";

interface NumberInputProps {
	value: ConditionValue;
	onChange: (value: ConditionValue) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	validationRegex?: string | null;
	hasError?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
	value,
	onChange,
	placeholder,
	disabled,
	className,
	validationRegex,
	hasError = false,
}) => {
	const [localValue, setLocalValue] = useState(() => getDisplayValue(value));
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLocalValue(getDisplayValue(value));
	}, [value]);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;
			if (newValue !== "" && !validateNumber(newValue)) {
				return;
			}
			setLocalValue(newValue);
			if (error) setError(null);
		},
		[error],
	);

	const handleBlur = useCallback(() => {
		if (localValue === "") {
			onChange(null);
			setError(null);
			return;
		}

		if (!validateWithRegex(localValue, validationRegex)) {
			setError("Invalid format");
			return;
		}

		const numericValue = Number(localValue);
		onChange(numericValue);
		setError(null);
	}, [localValue, onChange, validationRegex]);

	const hasValidationError = error !== null;
	const showRequiredError =
		hasError && (value === null || value === undefined || value === "");
	const showError = hasValidationError || showRequiredError;

	return (
		<div className="flex flex-col">
			<input
				type="text"
				inputMode="decimal"
				value={localValue}
				onChange={handleChange}
				onBlur={handleBlur}
				placeholder={placeholder}
				disabled={disabled}
				className={cn(
					baseInputStyles,
					showError && errorInputStyles,
					showRequiredError && "bg-red-50",
					className,
				)}
			/>
			{hasValidationError && (
				<span className="text-xs text-red-500 mt-1">{error}</span>
			)}
		</div>
	);
};
