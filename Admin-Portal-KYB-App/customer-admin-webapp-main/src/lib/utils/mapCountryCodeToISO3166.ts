import type { ISO3166 } from "@/types/ISO3166";

import COUNTRIES from "@/constants/Countries";

const COUNTRY_CODE_TO_ISO3166_MAP: Record<string, ISO3166> = {
	UK: COUNTRIES.UK,
	CA: COUNTRIES.CANADA,
	USA: COUNTRIES.USA,
	PR: COUNTRIES.PUERTO_RICO,
	AU: COUNTRIES.AUSTRALIA,
	NZ: COUNTRIES.NEW_ZEALAND,
};

export const mapCountryCodeToISO3166 = (
	code: keyof typeof COUNTRIES | string,
): ISO3166 | null => {
	const key = code.toUpperCase() as keyof typeof COUNTRY_CODE_TO_ISO3166_MAP;
	return COUNTRY_CODE_TO_ISO3166_MAP[key] ?? null;
};
