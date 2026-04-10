import type { ISO3166 } from "@/types/ISO3166";

import COUNTRIES from "@/constants/Countries";

export const isISO3166 = (code: string): code is ISO3166 => {
	return (Object.values(COUNTRIES) as string[]).includes(code);
};
