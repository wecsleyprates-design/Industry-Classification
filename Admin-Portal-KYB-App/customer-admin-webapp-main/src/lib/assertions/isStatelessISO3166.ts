import type { ISO3166 } from "@/types/ISO3166";

import COUNTRIES from "@/constants/Countries";

const STATELESS_ISO3166_CODES = [COUNTRIES.UK];

export const isStatelessISO3166 = (
	country: string | null | undefined,
): country is ISO3166 => {
	if (!country) return false;
	return STATELESS_ISO3166_CODES.includes(country as ISO3166);
};
