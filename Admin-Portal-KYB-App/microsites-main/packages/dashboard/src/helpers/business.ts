import { type BusinessLocation } from "@/ui/business-location-google-map";

interface AddressSource {
	submitted?: boolean;
	full_address: string;
}

/**
 * Gets the primary business address from an array of address sources
 * Logic:
 * 1. If there's a submitted address (submitted=true), return that address
 * 2. Otherwise, return the first address in the array if available
 * 3. If no addresses are available, return "N/A"
 *
 * @param addressSources - Array of address sources
 * @param defaultValue - Optional default value if no address is found (defaults to "N/A")
 * @returns The primary business address string
 */
export const getPrimaryBusinessAddress = (
	addressSources: AddressSource[],
	defaultValue: string = "N/A",
): string => {
	if (!addressSources?.length) return defaultValue;

	const submittedAddress = addressSources.find((source) => source.submitted);
	return submittedAddress?.full_address ?? addressSources[0].full_address;
};

/**
 * Extracts formatted address and coordinates from a Google Geocoding API response
 *
 * @param response - The response object from Google Geocoding API
 * @returns An object containing formatted address and coordinates, or null if the geocoding failed
 *          - formattedAddress: Human-readable address string
 *          - latitude: Geographic latitude coordinate
 *          - longitude: Geographic longitude coordinate
 */
export const extractGeocodingDetails = (
	response: Record<string, any>,
): { formattedAddress: string; latitude: number; longitude: number } | null => {
	if (response.status !== "OK" || response.results.length === 0) {
		console.error("Geocoding API error or no results found.");
		return null;
	}

	const result = response.results[0];
	const { formatted_address: formattedAddress, geometry } = result;
	const { lat, lng } = geometry.location;

	return {
		formattedAddress,
		latitude: lat,
		longitude: lng,
	};
};

/**
 * Maps geocoding details to BusinessLocation format
 *
 * @param geocodingDetails - The extracted geocoding details
 * @param businessName - The name of the business
 * @param businessAddress - The business address string
 * @returns BusinessLocation object or null if geocoding details are not available
 */
export const mapToBusinessLocation = (
	geocodingDetails: ReturnType<typeof extractGeocodingDetails>,
	businessName: string,
	businessAddress: string,
): BusinessLocation | null => {
	if (!geocodingDetails) return null;

	return {
		id: geocodingDetails.formattedAddress,
		position: {
			lat: geocodingDetails.latitude,
			lng: geocodingDetails.longitude,
		},
		name: businessName,
		description: businessAddress,
	};
};
