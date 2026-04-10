import currency from "currency.js";
import dayjs from "dayjs";
import { isNumericString } from "@/lib/assertions";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { formatCurrency } from "@/helpers";

/**
 * Calculate business age from formation date
 */
export const getBusinessAge = (formationDate: string): string => {
	const years = dayjs().diff(dayjs(formationDate), "years");
	const months = dayjs().diff(dayjs(formationDate), "months");
	const days = dayjs().diff(dayjs(formationDate), "days");

	if (years > 0) {
		return `${years} ${years === 1 ? "year" : "years"}`;
	} else if (months > 0) {
		return `${months} ${months === 1 ? "month" : "months"}`;
	} else {
		return `${days} ${days === 1 ? "day" : "days"}`;
	}
};

/**
 * Format a formation date into `MM/DD/YYYY (X years)` for display.
 * Returns an empty string if no formationDate is provided.
 */
export const formatFormationDateWithAge = (formationDate?: string): string => {
	if (!formationDate) return "";
	return `${dayjs(formationDate).format("MM/DD/YYYY")} (${getBusinessAge(
		formationDate,
	)})`;
};

/**
 * Convert boolean value to display string
 */
export const getBooleanDisplayValue = (value?: boolean): string => {
	if (typeof value !== "boolean") return VALUE_NOT_AVAILABLE;
	return value ? "Yes" : "No";
};

/**
 * Convert currency value to display string
 */
export const getCurrencyDisplayValue = (value?: unknown): string => {
	if (typeof value === "number" || isNumericString(value)) {
		return formatCurrency(currency(value).value);
	}

	return VALUE_NOT_AVAILABLE;
};
