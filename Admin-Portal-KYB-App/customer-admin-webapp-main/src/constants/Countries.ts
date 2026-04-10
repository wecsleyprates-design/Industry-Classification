import type { ISO3166 } from "@/types/ISO3166";

export const COUNTRIES: Record<
	"USA" | "CANADA" | "UK" | "PUERTO_RICO" | "AUSTRALIA" | "NEW_ZEALAND",
	ISO3166
> = {
	USA: "US",
	CANADA: "CA",
	UK: "GB",
	PUERTO_RICO: "PR",
	AUSTRALIA: "AU",
	NEW_ZEALAND: "NZ",
};

export default COUNTRIES;
