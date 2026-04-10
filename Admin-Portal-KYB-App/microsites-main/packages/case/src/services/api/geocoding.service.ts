import axios from "axios";
import { api } from "@/lib/api";
import type { GeocodingResponse } from "@/types/geographic-coordinates";

/**
 * Type guard to validate that a value conforms to GeocodingResponse structure
 */
function isGeocodingResponse(value: unknown): value is GeocodingResponse {
	return (
		typeof value === "object" &&
		value !== null &&
		"status" in value &&
		typeof (value as { status: unknown }).status === "string" &&
		"results" in value &&
		Array.isArray((value as { results: unknown }).results)
	);
}

/**
 * Geocodes an address using the backend geocoding endpoint.
 * The backend proxies requests to Google Maps Geocoding API,
 * avoiding referer restriction issues.
 *
 * @param address - The address string to geocode
 * @returns Promise resolving to GeocodingResponse
 * @throws Will throw if the backend returns an error or if Google API returns an error status
 */
export const geocodeAddress = async (
	address: string,
): Promise<GeocodingResponse> => {
	try {
		const response = await api.get<{
			status: string;
			data: GeocodingResponse;
			message?: string;
		}>("/integration/api/v1/geocoding", {
			params: {
				address,
			},
		});

		// Backend returns jsend format: { status: "success", data: GeocodingResponse, message: "..." }
		return response.data.data;
	} catch (error) {
		// If backend returns a fail response (jsend), extract the data from the error response
		if (axios.isAxiosError(error) && error.response?.data?.data) {
			const errorData = error.response.data.data;
			// Validate that the error data actually conforms to GeocodingResponse structure
			if (isGeocodingResponse(errorData)) {
				// Backend returned a fail response with Google API error data
				// Return it so the frontend can handle it (extractGeocodingDetails will check status !== "OK")
				return errorData;
			}
		}
		// Re-throw other errors (network, timeout, invalid response structure, etc.)
		throw error;
	}
};
