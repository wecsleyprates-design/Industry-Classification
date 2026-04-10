import React from "react";
import { cn } from "@/lib/utils";
import type { ConditionOperator } from "@/types/workflows";
import { OPERATOR_LABELS } from "../RuleBuilder/constants";

const getOperatorLabel = (operator: string): string => {
	const key = operator as ConditionOperator;
	return OPERATOR_LABELS[key] ?? operator;
};

export const OperatorBadge = ({ operator }: { operator: string }) => {
	return (
		<span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold tracking-wide">
			{getOperatorLabel(operator)}
		</span>
	);
};

export const ConnectorBadge = ({ operator }: { operator: string }) => {
	const isOr = operator === "OR";

	return (
		<div className="flex justify-center items-center my-3 relative h-6">
			<div className="absolute left-0 right-0 top-1/2 h-px bg-gray-200" />
			<span
				className={cn(
					"px-3 py-1 rounded-full text-[10px] font-bold uppercase z-10 leading-none shadow-sm text-white",
					isOr ? "bg-orange-500" : "bg-slate-600",
				)}
			>
				{operator}
			</span>
		</div>
	);
};

const ARRAY_EMPTY_OPERATORS = ["ARRAY_IS_EMPTY", "ARRAY_IS_NOT_EMPTY"] as const;

const isArrayEmptyOperator = (operator?: string): boolean => {
	return (
		operator !== undefined &&
		ARRAY_EMPTY_OPERATORS.includes(
			operator as (typeof ARRAY_EMPTY_OPERATORS)[number],
		)
	);
};

const formatDisplayValue = (value: unknown, operator?: string): string => {
	if (value === null && isArrayEmptyOperator(operator)) {
		return "empty";
	}
	return String(value);
};

export const ValueBadge = ({
	value,
	operator,
}: {
	value: unknown;
	operator?: string;
}) => {
	const displayValue = formatDisplayValue(value, operator);

	return (
		<span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm font-medium">
			{displayValue}
		</span>
	);
};

export const FieldBadge = ({ field }: { field: string }) => {
	return (
		<span className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded shadow-sm">
			{field}
		</span>
	);
};
