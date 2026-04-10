import { useState } from "react";
import { type Libraries, useJsApiLoader } from "@react-google-maps/api";

import { envConfig } from "@/config/envConfig";

const library: Libraries = ["places"];

export const useGoogleAutoComplete = () => {
	const { isLoaded } = useJsApiLoader({
		googleMapsApiKey: `${String(envConfig.VITE_GOOGLE_MAPS_API_KEY)}`,
		libraries: library,
	});

	const [searchResult, setSearchResult] = useState<
		google.maps.places.Autocomplete | undefined
	>();

	const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
		setSearchResult(autocomplete);
	};

	const companySearchOptions = {
		types: ["establishment"],
		fields: ["place_id", "address_components", "name", "website"],
	};

	return {
		isLoaded,
		onLoad,
		searchResult,
		setSearchResult,
		companySearchOptions,
	};
};
