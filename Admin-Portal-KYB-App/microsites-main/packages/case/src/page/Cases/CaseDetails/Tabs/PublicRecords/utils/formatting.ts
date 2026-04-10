export const formatPercentageFromDecimal = (decimal?: number | null) => {
	if (decimal === undefined || decimal === null) return;
	return `(${decimal * 100}%)`;
};
