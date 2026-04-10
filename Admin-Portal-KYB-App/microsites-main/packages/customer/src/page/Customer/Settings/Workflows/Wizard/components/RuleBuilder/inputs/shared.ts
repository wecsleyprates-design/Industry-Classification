import type {
	AttributeDataType,
	ConditionOperator,
	ConditionValue,
} from "@/types/workflows";

export const baseInputStyles =
	"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-gray-800 transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

export const errorInputStyles = "border-red-300 focus-visible:ring-red-500";

export const validateWithRegex = (
	val: string,
	pattern: string | null | undefined,
): boolean => {
	if (!pattern || val === "") return true;
	try {
		const regex = new RegExp(pattern);
		return regex.test(val);
	} catch {
		return true;
	}
};

export const validateNumber = (val: string): boolean => {
	if (val === "" || val === "-") return true;
	return !isNaN(Number(val)) && isFinite(Number(val));
};

export const getDisplayValue = (val: ConditionValue): string => {
	if (val === null || val === undefined) return "";
	if (typeof val === "boolean") return val ? "true" : "false";
	return String(val);
};

export interface BaseInputProps {
	value: ConditionValue;
	onChange: (value: ConditionValue) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	validationRegex?: string | null;
	dataType?: AttributeDataType | null;
	hasError?: boolean;
}

export interface ValueInputProps extends BaseInputProps {
	operator: ConditionOperator | "";
}
