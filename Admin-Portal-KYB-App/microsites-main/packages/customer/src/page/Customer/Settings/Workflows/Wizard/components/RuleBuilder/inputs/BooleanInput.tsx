import React, { useCallback, useMemo } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { ConditionValue } from "@/types/workflows";
import { baseInputStyles } from "./shared";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

interface BooleanInputProps {
	value: ConditionValue;
	onChange: (value: ConditionValue) => void;
	disabled?: boolean;
	className?: string;
	hasError?: boolean;
}

export const BooleanInput: React.FC<BooleanInputProps> = ({
	value,
	onChange,
	disabled,
	className,
	hasError = false,
}) => {
	const displayValue = useMemo(() => {
		if (value === true) return "True";
		if (value === false) return "False";
		return "";
	}, [value]);

	const handleSelect = useCallback(
		(selectedValue: boolean) => {
			onChange(selectedValue);
		},
		[onChange],
	);

	const showError = hasError && value !== true && value !== false;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild disabled={disabled}>
				<button
					type="button"
					className={cn(
						baseInputStyles,
						"flex items-center justify-between cursor-pointer",
						disabled && "cursor-not-allowed",
						showError && "border-red-300 bg-red-50",
						className,
					)}
				>
					<span className={displayValue ? "text-gray-800" : "text-gray-400"}>
						{displayValue || "Select..."}
					</span>
					<ChevronDownIcon className="h-4 w-4 text-gray-400" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-[8rem]">
				<DropdownMenuItem
					onClick={() => {
						handleSelect(true);
					}}
					selected={value === true}
				>
					True
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						handleSelect(false);
					}}
					selected={value === false}
				>
					False
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
