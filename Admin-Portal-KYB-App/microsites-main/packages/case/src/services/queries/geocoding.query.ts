import { useQuery } from "@tanstack/react-query";
import { geocodeAddress } from "@/services/api/geocoding.service";
import type { GeocodingResponse } from "@/types/geographic-coordinates";

import { VALUE_NOT_AVAILABLE } from "@/constants";

export const useGeocoding = (address: string) => {
	return useQuery<GeocodingResponse>({
		queryKey: ["geocoding", address],
		queryFn: async () => await geocodeAddress(address),
		enabled: address !== VALUE_NOT_AVAILABLE && Boolean(address),
		retry: false,
	});
};
