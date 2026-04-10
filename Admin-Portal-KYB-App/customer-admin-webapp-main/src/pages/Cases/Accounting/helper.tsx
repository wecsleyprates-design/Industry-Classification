// check if all records for a key are null
export const checkAllRecordsNull = (
	data: {
		total_items: number;
		total_pages: number;
		records: any[];
	},
	key: string,
) => {
	const record = data?.records?.find((item: any) => item.key === key);

	if (!record) {
		return false;
	}

	return Object.entries(record).every(([year, value]) => {
		return year === "key" || value === "$0.00";
	});
};

export const getRecordByKey = (key: string, records: any[]) => {
	return records?.find((record) => record?.key === key) ?? [];
};

export const convertKeyToCamelCase = (key: string) => {
	if (key === "total_checking_savings") return "Total Checking/Savings";
	if (key === "total_liabilities_and_equity")
		return "Total Liabilities & Equity";
	if (key === "total_revenue") return "Total Income";

	return key
		?.split("_")
		?.map((word, index) => {
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join(" ");
};

// Helper function to create an empty year object
export const createEmptyYearObject = (
	incomeStatementData: Record<string, any>,
) => {
	const yearObject: Record<string, string> = {};
	const years = incomeStatementData?.data?.map((item: any) => item.year);
	years?.forEach((year: string | number) => {
		yearObject[year] = "$0.00"; // Default value for each year
	});
	return yearObject;
};
