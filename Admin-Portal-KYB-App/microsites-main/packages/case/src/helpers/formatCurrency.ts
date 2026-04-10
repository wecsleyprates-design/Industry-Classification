export const formatCurrency = (
	value: number,
	{
		currency = "USD",
		minimumFractionDigits = 2,
		maximumFractionDigits = 2,
	}: {
		currency?: string;
		minimumFractionDigits?: number;
		maximumFractionDigits?: number;
	} = {},
) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits,
		maximumFractionDigits,
	}).format(value);
};
