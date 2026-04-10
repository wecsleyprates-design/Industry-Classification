export const formatCapitalCase = (str: string) => {
	return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};
