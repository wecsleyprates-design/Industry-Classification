/**
 * Normalizes a string by removing accents and diacritical marks.
 * For example: "QUÉBEC" becomes "QUEBEC"
 */
export const normalizeString = (str: string): string => {
	return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};
