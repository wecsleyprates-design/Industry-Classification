export const isObjectWithKeys = <T extends object>(
	obj: unknown,
	keys: Array<keyof T>,
): obj is T => {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}

	return keys.every((key) => key in obj);
};

export const isNumericString = (
	value: unknown,
): value is `${number}` | `${number}.${number}` => {
	if (typeof value !== "string" || value === null || value === undefined)
		return false;
	if (value.trim() === "") return false;

	const regex = /^-?\d+(\.\d+)?$/;
	return regex.test(value);
};
