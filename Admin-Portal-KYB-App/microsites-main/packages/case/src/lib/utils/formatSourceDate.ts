import { formatDate } from "../helper";

import { DATE_FORMATS } from "@/constants";

/**
 * @description Returns the date in the given format in the source timezone (not localized).
 * @param date - The date to format.
 * @param format - The format to use.
 * @returns The formatted date.
 */
export const formatSourceDate = (
	date: Date | string,
	format = DATE_FORMATS.DEFAULT,
) => {
	return formatDate(date, format, { local: false });
};
