import React, { useCallback, useMemo } from "react";
import DatePicker, { DateObject } from "react-multi-date-picker";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { ConditionValue } from "@/types/workflows";
import { baseInputStyles } from "./shared";

interface DateInputProps {
	value: ConditionValue;
	onChange: (value: ConditionValue) => void;
	disabled?: boolean;
	className?: string;
	hasError?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({
	value,
	onChange,
	disabled,
	hasError = false,
}) => {
	const dateValue = useMemo(() => {
		if (value === null || value === undefined || value === "") return null;
		const dateStr = String(value);
		if (!dateStr) return null;
		return new DateObject(dateStr);
	}, [value]);

	const displayValue = useMemo(() => {
		if (!dateValue) return "Select date";
		return dateValue.format("YYYY-MM-DD");
	}, [dateValue]);

	const handleChange = useCallback(
		(date: DateObject | null) => {
			if (!date) {
				onChange(null);
				return;
			}
			const formatted = date.format("YYYY-MM-DD");
			onChange(formatted);
		},
		[onChange],
	);

	const showError = hasError && !dateValue;

	return (
		<DatePicker
			value={dateValue}
			onChange={handleChange}
			format="YYYY-MM-DD"
			disabled={disabled}
			editable={false}
			onOpenPickNewDate={false}
			render={(_, openCalendar) => (
				<div
					onClick={() => {
						if (!disabled) openCalendar();
					}}
					className={cn(
						baseInputStyles,
						"w-full xl:w-[150px] cursor-pointer flex items-center justify-between",
						disabled && "cursor-not-allowed opacity-50",
						!dateValue && "text-gray-400",
						showError && "border-red-300 bg-red-50",
					)}
				>
					<span className="truncate">{displayValue}</span>
					<ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
				</div>
			)}
		/>
	);
};
