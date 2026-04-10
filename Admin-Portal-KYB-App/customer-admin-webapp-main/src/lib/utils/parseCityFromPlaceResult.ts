export const parseCityFromPlaceResult = (
	place:
		| Pick<
				google.maps.places.PlaceResult,
				"address_components" | "formatted_address" | "adr_address"
		  >
		| undefined,
): string | null => {
	if (!place) return null;

	const components = place.address_components ?? [];

	const findAll = (types: string[]) =>
		components.find((c) => types.every((t) => c.types.includes(t)))
			?.long_name ?? null;

	const findOne = (type: string) =>
		components.find((c) => c.types.includes(type))?.long_name ?? null;

	const country = findOne("country");
	const isUS =
		country === "United States" || country === "US" || country === "USA";

	//
	// 1. LOCALITY — canonical city field (strong)
	//
	const locality = findOne("locality");
	if (locality) return locality;

	//
	// 2. POSTAL_TOWN — UK, Ireland, Hong Kong (strong)
	//
	const postalTown = findOne("postal_town");
	if (postalTown) return postalTown;

	//
	// 3. ADR locality <span>
	//
	if (place.adr_address) {
		const match = place.adr_address.match(
			/<span class="locality">([^<]+)<\/span>/,
		);
		if (match) return match[1];
	}

	//
	// 4. SUBLOCALITY (avoid in US)
	//
	if (!isUS) {
		const sublocality =
			findAll(["sublocality", "political"]) ||
			findAll(["sublocality_level_1", "political"]) ||
			findOne("sublocality") ||
			findOne("sublocality_level_1");

		if (sublocality) return sublocality;
	}

	//
	// 5. AAL3 as fallback (non-US only)
	//    Not accurate for US addresses -- will return "Manhattan" instead of "New York"
	//    Often districts/communes functioning as city equivalents.
	//
	if (!isUS) {
		const aal3 = findOne("administrative_area_level_3");
		if (aal3) return aal3;
	}

	//
	// 6. NEIGHBORHOOD (weak)
	//
	const neighborhood = findAll(["neighborhood", "political"]);
	if (neighborhood) return neighborhood;

	//
	// 7. Fallback to admin levels outside of US
	//
	if (!isUS) {
		// Sometimes works as a city (e.g., Japan "shi" / France arrondissements)
		const aal2 = findOne("administrative_area_level_2");
		if (aal2) return aal2;

		// Not really a city, but better than nothing as a last fallback
		const aal1 = findOne("administrative_area_level_1");
		if (aal1) return aal1;
	}

	//
	// 8. Parse formatted_address (e.g. "Street, City, State, Country") (weak)
	//
	if (place.formatted_address) {
		const parts = place.formatted_address.split(",");
		if (parts.length >= 3) {
			return parts[1].trim();
		}
	}

	return null;
};
