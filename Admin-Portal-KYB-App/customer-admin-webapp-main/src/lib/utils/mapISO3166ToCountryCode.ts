import COUNTRIES from "@/constants/Countries";

const ISO3166_TO_COUNTRY_CODE_MAP = {
	[COUNTRIES.UK]: "UK",
	[COUNTRIES.CANADA]: "CA",
	[COUNTRIES.USA]: "USA",
};

export const mapISO3166ToCountryCode = (
	code: keyof typeof COUNTRIES | string,
): string | null => {
	const key = code.toUpperCase() as keyof typeof ISO3166_TO_COUNTRY_CODE_MAP;
	return ISO3166_TO_COUNTRY_CODE_MAP[key] ?? null;
};
