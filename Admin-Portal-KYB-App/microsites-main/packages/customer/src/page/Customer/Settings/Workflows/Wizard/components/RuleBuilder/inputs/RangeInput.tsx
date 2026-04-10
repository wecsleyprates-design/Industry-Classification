import React, { useCallback, useEffect, useMemo, useState } from "react";
import DatePicker, { DateObject } from "react-multi-date-picker";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { AttributeDataType, ConditionValue } from "@/types/workflows";
import {
	baseInputStyles,
	errorInputStyles,
	validateNumber,
	validateWithRegex,
} from "./shared";

interface RangeInputProps {
	value: ConditionValue;
	onChange: (value: ConditionValue) => void;
	disabled?: boolean;
	className?: string;
	validationRegex?: string | null;
	dataType?: AttributeDataType | null;
	hasError?: boolean;
}

const getDisplayValues = (val: ConditionValue): [string, string] => {
	if (!Array.isArray(val) || val.length < 2) return ["", ""];
	return [String(val[0] ?? ""), String(val[1] ?? "")];
};

export const RangeInput: React.FC<RangeInputProps> = ({
	value,
	onChange,
	disabled,
	className,
	validationRegex,
	dataType,
	hasError = false,
}) => {
	const isNumber = dataType === "number";
	const isDate = dataType === "date";

	const [localMin, setLocalMin] = useState(() => getDisplayValues(value)[0]);
	const [localMax, setLocalMax] = useState(() => getDisplayValues(value)[1]);
	const [minError, setMinError] = useState<string | null>(null);
	const [maxError, setMaxError] = useState<string | null>(null);

	useEffect(() => {
		const [min, max] = getDisplayValues(value);
		setLocalMin(min);
		setLocalMax(max);
	}, [value]);

	const handleMinChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;
			if (isNumber && newValue !== "" && !validateNumber(newValue)) {
				return;
			}
			setLocalMin(newValue);
			if (minError) setMinError(null);
		},
		[minError, isNumber],
	);

	const handleMaxChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;
			if (isNumber && newValue !== "" && !validateNumber(newValue)) {
				return;
			}
			setLocalMax(newValue);
			if (maxError) setMaxError(null);
		},
		[maxError, isNumber],
	);

	const validateRange = useCallback(
		(min: string, max: string): boolean => {
			if (min === "" || max === "") return true;

			if (isNumber) {
				const numMin = Number(min);
				const numMax = Number(max);
				return numMin <= numMax;
			}

			if (isDate) {
				return min <= max;
			}

			return true;
		},
		[isNumber, isDate],
	);

	const handleMinBlur = useCallback(() => {
		if (localMin !== "" && !validateWithRegex(localMin, validationRegex)) {
			setMinError("Invalid format");
			return;
		}

		if (!validateRange(localMin, localMax)) {
			setMinError("Must be ≤ end value");
			return;
		}

		const parsedMin =
			localMin === "" ? null : isNumber ? Number(localMin) : localMin;
		const currentMax = Array.isArray(value) ? value[1] : null;
		onChange([parsedMin, currentMax] as Array<string | number>);
		setMinError(null);
		if (maxError === "Must be ≥ start value") setMaxError(null);
	}, [
		localMin,
		localMax,
		onChange,
		value,
		validationRegex,
		isNumber,
		validateRange,
		maxError,
	]);

	const handleMaxBlur = useCallback(() => {
		if (localMax !== "" && !validateWithRegex(localMax, validationRegex)) {
			setMaxError("Invalid format");
			return;
		}

		if (!validateRange(localMin, localMax)) {
			setMaxError("Must be ≥ start value");
			return;
		}

		const parsedMax =
			localMax === "" ? null : isNumber ? Number(localMax) : localMax;
		const currentMin = Array.isArray(value) ? value[0] : null;
		onChange([currentMin, parsedMax] as Array<string | number>);
		setMaxError(null);
		if (minError === "Must be ≤ end value") setMinError(null);
	}, [
		localMax,
		localMin,
		onChange,
		value,
		validationRegex,
		isNumber,
		validateRange,
		minError,
	]);

	const handleDateMinChange = useCallback(
		(date: DateObject | null) => {
			const formatted = date ? date.format("YYYY-MM-DD") : "";
			setLocalMin(formatted);
			if (minError) setMinError(null);

			const currentMax = Array.isArray(value) ? value[1] : null;

			if (formatted && currentMax && formatted > String(currentMax)) {
				setMinError("Must be ≤ end date");
				return;
			}

			onChange([formatted || null, currentMax] as Array<string | number>);
			if (maxError === "Must be ≥ start date") setMaxError(null);
		},
		[onChange, value, minError, maxError],
	);

	const handleDateMaxChange = useCallback(
		(date: DateObject | null) => {
			const formatted = date ? date.format("YYYY-MM-DD") : "";
			setLocalMax(formatted);
			if (maxError) setMaxError(null);

			const currentMin = Array.isArray(value) ? value[0] : null;

			if (formatted && currentMin && formatted < String(currentMin)) {
				setMaxError("Must be ≥ start date");
				return;
			}

			onChange([currentMin, formatted || null] as Array<string | number>);
			if (minError === "Must be ≤ end date") setMinError(null);
		},
		[onChange, value, minError, maxError],
	);

	const minDateValue = useMemo(() => {
		if (!localMin) return null;
		return new DateObject(localMin);
	}, [localMin]);

	const maxDateValue = useMemo(() => {
		if (!localMax) return null;
		return new DateObject(localMax);
	}, [localMax]);

	const minDisplayValue = localMin || "Start date";
	const maxDisplayValue = localMax || "End date";

	const hasMinValidationError = minError !== null;
	const hasMaxValidationError = maxError !== null;
	const isMinEmpty = localMin === "";
	const isMaxEmpty = localMax === "";
	const showMinRequiredError = hasError && isMinEmpty;
	const showMaxRequiredError = hasError && isMaxEmpty;
	const hasMinError = hasMinValidationError || showMinRequiredError;
	const hasMaxError = hasMaxValidationError || showMaxRequiredError;

	if (isDate) {
		return (
			<div className={cn("flex flex-col", className)}>
				<div className="flex flex-col min-[1440px]:flex-row min-[1440px]:items-center gap-1.5 min-[1440px]:gap-2">
					<div className="flex flex-col flex-1 min-[1440px]:flex-initial">
						<DatePicker
							value={minDateValue}
							onChange={handleDateMinChange}
							format="YYYY-MM-DD"
							disabled={disabled}
							maxDate={maxDateValue ?? undefined}
							editable={false}
							onOpenPickNewDate={false}
							render={(_, openCalendar) => (
								<div
									onClick={() => {
										if (!disabled) openCalendar();
									}}
									className={cn(
										baseInputStyles,
										"w-full min-[1440px]:w-[150px] cursor-pointer flex items-center justify-between",
										disabled && "cursor-not-allowed opacity-50",
										hasMinError && errorInputStyles,
										showMinRequiredError && "bg-red-50",
										!localMin && "text-gray-400",
									)}
								>
									<span className="truncate">{minDisplayValue}</span>
									<ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
								</div>
							)}
						/>
						{hasMinValidationError && (
							<span className="text-xs text-red-500 mt-1">{minError}</span>
						)}
					</div>
					<span className="text-sm text-gray-500 font-medium text-center min-[1440px]:text-left">
						TO
					</span>
					<div className="flex flex-col flex-1 min-[1440px]:flex-initial">
						<DatePicker
							value={maxDateValue}
							onChange={handleDateMaxChange}
							format="YYYY-MM-DD"
							disabled={disabled}
							minDate={minDateValue ?? undefined}
							editable={false}
							onOpenPickNewDate={false}
							render={(_, openCalendar) => (
								<div
									onClick={() => {
										if (!disabled) openCalendar();
									}}
									className={cn(
										baseInputStyles,
										"w-full min-[1440px]:w-[150px] cursor-pointer flex items-center justify-between",
										disabled && "cursor-not-allowed opacity-50",
										hasMaxError && errorInputStyles,
										showMaxRequiredError && "bg-red-50",
										!localMax && "text-gray-400",
									)}
								>
									<span className="truncate">{maxDisplayValue}</span>
									<ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
								</div>
							)}
						/>
						{hasMaxValidationError && (
							<span className="text-xs text-red-500 mt-1">{maxError}</span>
						)}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col", className)}>
			<div className="flex flex-col sm:flex-row sm:items-center gap-2">
				<div className="flex flex-col flex-1 sm:flex-initial">
					<input
						type="text"
						inputMode={isNumber ? "decimal" : undefined}
						value={localMin}
						onChange={handleMinChange}
						onBlur={handleMinBlur}
						placeholder="Min"
						disabled={disabled}
						className={cn(
							baseInputStyles,
							"w-full sm:w-24",
							hasMinError && errorInputStyles,
							showMinRequiredError && "bg-red-50",
						)}
					/>
					{hasMinValidationError && (
						<span className="text-xs text-red-500 mt-1">{minError}</span>
					)}
				</div>
				<span className="text-sm text-gray-500 font-medium text-center sm:text-left">
					TO
				</span>
				<div className="flex flex-col flex-1 sm:flex-initial">
					<input
						type="text"
						inputMode={isNumber ? "decimal" : undefined}
						value={localMax}
						onChange={handleMaxChange}
						onBlur={handleMaxBlur}
						placeholder="Max"
						disabled={disabled}
						className={cn(
							baseInputStyles,
							"w-full sm:w-24",
							hasMaxError && errorInputStyles,
							showMaxRequiredError && "bg-red-50",
						)}
					/>
					{hasMaxValidationError && (
						<span className="text-xs text-red-500 mt-1">{maxError}</span>
					)}
				</div>
			</div>
		</div>
	);
};
